const productionApiBaseUrl = 'https://rayd8-api.onrender.com'

export const CORRELATION_ID_HEADER = 'x-rayd8-correlation-id'

const DEFAULT_TIMEOUT_MS = 15_000

interface ErrorPayload {
  code?: string
  error?: string
}

export interface ApiRequestOptions {
  /** Hard timeout; the request rejects with REQUEST_TIMEOUT when exceeded. */
  timeoutMs?: number
  /** Caller-supplied abort signal (e.g. component unmount). */
  signal?: AbortSignal
  /** Caller-supplied correlation ID for incident stitching; one is minted otherwise. */
  correlationId?: string
}

export class ApiRequestError extends Error {
  code?: string
  status: number
  correlationId?: string

  constructor(message: string, status: number, code?: string, correlationId?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
    this.correlationId = correlationId
  }
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function readViteEnv(key: string): string | undefined {
  try {
    // import.meta.env is undefined under Node/tsx and some SSR contexts.
    const env = (import.meta as { env?: Record<string, string | undefined> })?.env
    return env?.[key]
  } catch {
    return undefined
  }
}

function resolveApiBaseUrl() {
  const configuredApiBaseUrl = readViteEnv('VITE_API_URL')?.trim()

  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl
  }

  if (typeof window !== 'undefined') {
    return isLocalHostname(window.location.hostname) ? 'http://localhost:3001' : productionApiBaseUrl
  }

  return productionApiBaseUrl
}

export const apiBaseUrl = resolveApiBaseUrl()

function mintCorrelationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `r8-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(init?.headers)
  const correlationId = options.correlationId?.trim() || mintCorrelationId()
  headers.set(CORRELATION_ID_HEADER, correlationId)

  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  // Compose the caller's signal with a hard timeout so a stalled connection
  // can never leave the player waiting forever.
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const callerSignal = options.signal
  const onCallerAbort = () => controller.abort()
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort()
    } else {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true })
    }
  }

  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    })
  } catch (error) {
    if (isAbortError(error)) {
      if (timedOut) {
        throw new ApiRequestError('The request timed out. Please try again.', 0, 'REQUEST_TIMEOUT', correlationId)
      }
      throw new ApiRequestError('The request was cancelled.', 0, 'REQUEST_ABORTED', correlationId)
    }
    throw new ApiRequestError('Unable to reach the server. Please try again.', 0, 'NETWORK_ERROR', correlationId)
  } finally {
    clearTimeout(timeoutId)
    callerSignal?.removeEventListener('abort', onCallerAbort)
  }

  // Adopt the server-echoed correlation ID when present (keeps client/server
  // logs stitchable even if an intermediary rewrote the header).
  const serverCorrelationId = response.headers.get(CORRELATION_ID_HEADER) ?? correlationId

  // Edge challenge/error pages (Cloudflare 52x, bot challenges) return HTML
  // with a 200. Never hand that to the player as a successful token payload.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '')
    const looksLikeHtml = /^\s*</.test(text) || contentType.includes('text/html')
    if (looksLikeHtml) {
      throw new ApiRequestError(
        'The session service returned an unexpected response. Please try again.',
        response.status,
        'EDGE_HTML_RESPONSE',
        serverCorrelationId,
      )
    }
  }

  const payload = (await response.json().catch(() => ({}))) as T | ErrorPayload

  if (!response.ok) {
    const payloadError =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Request failed.'
    const payloadCode =
      typeof payload === 'object' &&
      payload !== null &&
      'code' in payload &&
      typeof payload.code === 'string'
        ? payload.code
        : undefined

    throw new ApiRequestError(payloadError, response.status, payloadCode, serverCorrelationId)
  }

  return payload as T
}
