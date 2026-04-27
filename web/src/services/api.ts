export const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
