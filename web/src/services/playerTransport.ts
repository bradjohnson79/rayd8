/**
 * Bounded-retry transport for player-critical GETs (playback-token, access).
 *
 * INC-2026-08-06-VIDEO-LOOP: transient failures may be retried, but retries
 * are bounded, backoff-delayed, and NEVER applied to 4xx denials or to
 * REQUEST_TIMEOUT (which already consumed a full timeout budget).
 */
import { ApiRequestError, apiRequest } from './api'

export interface PlayerApiGetOptions {
  maxAttempts?: number
  baseDelayMs?: number
  timeoutMs?: number
  signal?: AbortSignal
  correlationId?: string
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_BASE_DELAY_MS = 400
const DEFAULT_TIMEOUT_MS = 15_000

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(id)
      reject(new ApiRequestError('The request was cancelled.', 0, 'REQUEST_ABORTED'))
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function isRetryable(error: ApiRequestError): boolean {
  // Never retry client denials — they are deterministic.
  if (error.status >= 400 && error.status < 500) {
    return false
  }
  // A timeout already consumed a full budget; retrying immediately compounds.
  if (error.code === 'REQUEST_TIMEOUT' || error.code === 'REQUEST_ABORTED') {
    return false
  }
  // Retry: network errors (status 0), edge HTML, and 5xx.
  return error.status === 0 || error.status >= 500
}

export async function playerApiGet<T>(
  path: string,
  token: string | null,
  options: PlayerApiGetOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS)
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  let lastError: ApiRequestError | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await apiRequest<T>(path, undefined, token, {
        correlationId: options.correlationId,
        signal: options.signal,
        timeoutMs,
      })
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        throw error
      }
      lastError = error

      const isLastAttempt = attempt === maxAttempts
      if (isLastAttempt || !isRetryable(error)) {
        throw error
      }

      // Exponential backoff with a small deterministic jitter-free schedule.
      const delay = baseDelayMs * 2 ** (attempt - 1)
      await sleep(delay, options.signal)
    }
  }

  throw lastError ?? new ApiRequestError('Request failed.', 0, 'NETWORK_ERROR')
}
