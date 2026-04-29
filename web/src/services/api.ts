const productionApiBaseUrl = 'https://rayd8-api.onrender.com'

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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  const payload = (await response.json().catch(() => ({}))) as
    | T
    | {
        error?: string
      }

  if (!response.ok) {
    const payloadError =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Request failed.'

    throw new Error(payloadError)
  }

  return payload as T
}
