export interface PrimeAccessEnv {
  NODE_ENV?: string
  PRIME_ENABLED?: string
  PRIME_ALLOW_PRODUCTION?: string
}

/** Development flags cannot open production by themselves. */
export function isPrimeEnabled(env: PrimeAccessEnv): boolean {
  if (env.PRIME_ENABLED !== 'true') {
    return false
  }

  if (env.NODE_ENV === 'production' && env.PRIME_ALLOW_PRODUCTION !== 'true') {
    return false
  }

  return true
}

export function assertLocalAssetDriver(nodeEnv: string | undefined) {
  if (nodeEnv === 'production') {
    throw new Error('Local Prime asset storage is development-only.')
  }
}
