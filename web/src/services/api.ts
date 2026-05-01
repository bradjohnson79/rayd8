const productionApiBaseUrl = 'https://rayd8-api.onrender.com'

interface ErrorPayload {
  code?: string
  error?: string
}

export class ApiRequestError extends Error {
  code?: string
  status: number

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function resolveApiBaseUrl() {
  const configuredApiBaseUrl = import.meta.env.VITE_API_URL?.trim()

  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl
  }

  if (typeof window !== 'undefined') {
    return isLocalHostname(window.location.hostname) ? 'http://localhost:3001' : productionApiBaseUrl
  }

  return productionApiBaseUrl
}

export const apiBaseUrl = resolveApiBaseUrl()

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  token?: string | null,
): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiRequestError('Unable to reach the server. Please try again.', 0, 'NETWORK_ERROR')
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

    throw new ApiRequestError(payloadError, response.status, payloadCode)
  }

  return payload as T
}
