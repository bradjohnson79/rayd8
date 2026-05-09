import { isUninterruptedPlaybackEnabled } from '../../lib/playbackFocusPolicy'

export type PlaybackPolicyProfile = 'standard' | 'uninterrupted' | 'strict'

export interface PlaybackPolicyTimings {
  majorRecoveryCooldownMs: number
  pauseEscalationMs: number
  softResumeDebounceMs: number
}

const BASE_MAJOR_RECOVERY_COOLDOWN_MS = 30_000
const BASE_PAUSE_ESCALATION_MS = 30_000
const BASE_SOFT_RESUME_DEBOUNCE_MS = 400

export function resolvePlaybackPolicyProfile(): PlaybackPolicyProfile {
  if (import.meta.env.VITE_RAYD8_PLAYBACK_POLICY === 'strict') {
    return 'strict'
  }

  if (isUninterruptedPlaybackEnabled()) {
    return 'uninterrupted'
  }

  return 'standard'
}

export function getPlaybackPolicyTimings(profile: PlaybackPolicyProfile): PlaybackPolicyTimings {
  if (profile === 'strict') {
    return {
      majorRecoveryCooldownMs: Math.round(BASE_MAJOR_RECOVERY_COOLDOWN_MS * 0.45),
      pauseEscalationMs: Math.round(BASE_PAUSE_ESCALATION_MS * 0.45),
      softResumeDebounceMs: Math.round(BASE_SOFT_RESUME_DEBOUNCE_MS * 0.75),
    }
  }

  if (profile === 'uninterrupted') {
    return {
      majorRecoveryCooldownMs: Math.round(BASE_MAJOR_RECOVERY_COOLDOWN_MS * 1.25),
      pauseEscalationMs: Math.round(BASE_PAUSE_ESCALATION_MS * 1.5),
      softResumeDebounceMs: BASE_SOFT_RESUME_DEBOUNCE_MS + 200,
    }
  }

  return {
    majorRecoveryCooldownMs: BASE_MAJOR_RECOVERY_COOLDOWN_MS,
    pauseEscalationMs: BASE_PAUSE_ESCALATION_MS,
    softResumeDebounceMs: BASE_SOFT_RESUME_DEBOUNCE_MS,
  }
}

/** When true, the 2h continuity timer should not run (same semantics as prior suppressSessionContinuityInterruptions). */
export function shouldSuppressContinuityTimer(
  profile: PlaybackPolicyProfile,
  allowExtendedSessionsFromSettings: boolean,
): boolean {
  if (profile === 'strict') {
    return false
  }

  if (profile === 'uninterrupted') {
    return true
  }

  return allowExtendedSessionsFromSettings
}
