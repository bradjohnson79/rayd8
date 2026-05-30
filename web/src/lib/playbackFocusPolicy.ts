/**
 * Build-time flag for long playback validation (soak tests, profiling).
 * When enabled: uses the more tolerant playback authority timing profile for diagnostics.
 * Set only in local or preview env — omit from production member builds.
 */
export function isUninterruptedPlaybackEnabled(): boolean {
  return import.meta.env.VITE_RAYD8_UNINTERRUPTED_PLAYBACK === 'true'
}
