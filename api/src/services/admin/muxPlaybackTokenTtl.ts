/** Default production Mux playback JWT lifetime. */
export const DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES = 12 * 60

export function resolveMuxPlaybackTokenTtlMinutes(input: {
  allowShortInProduction?: boolean
  nodeEnv?: string
  requestedMinutes?: number | null
}): number {
  const nodeEnv = input.nodeEnv ?? 'development'
  const requested = input.requestedMinutes ?? DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES
  const allowShort = input.allowShortInProduction === true

  if (requested >= DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES) {
    return DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES
  }

  if (nodeEnv === 'production' && !allowShort) {
    return DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES
  }

  // Practical soak floor: at least 2 minutes so a 90s refresh lead is exercisable.
  return Math.max(2, Math.min(DEFAULT_MUX_PLAYBACK_TOKEN_TTL_MINUTES, requested))
}
