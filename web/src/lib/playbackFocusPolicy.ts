/**
 * Build-time flag for long playback validation (soak tests, profiling).
 * When enabled: skips the 2h session-continuity pause, avoids pause→"Session focus" escalation,
 * and does not promote audio autoplay friction to the full-screen focus overlay.
 * Set only in local or preview env — omit from production member builds.
 */
export function isUninterruptedPlaybackEnabled(): boolean {
  return import.meta.env.VITE_RAYD8_UNINTERRUPTED_PLAYBACK === 'true'
}
