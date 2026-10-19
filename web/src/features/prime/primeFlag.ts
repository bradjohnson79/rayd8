export function isPrimeClientEnabled() {
  const env = import.meta.env as Record<string, string | boolean | undefined>
  if (env.VITE_PRIME_ENABLED !== 'true') {
    return false
  }

  if (env.PROD === true && env.VITE_PRIME_ALLOW_PRODUCTION !== 'true') {
    return false
  }

  return true
}
