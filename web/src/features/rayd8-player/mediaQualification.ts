/**
 * Client-side media qualification for usage accounting.
 *
 * INC-2026-08-06-VIDEO-LOOP: trial usage was consumed while required video
 * looped in a broken state. Usage may only be reported as qualified when the
 * REQUIRED media for the session mode is actually healthy and playing.
 */

export type SessionMode = 'dual' | 'audio_only' | 'combined' | 'video_only'

export interface UsageQualificationInput {
  sessionMode: SessionMode
  audioPlaying: boolean
  audioCurrentTime: number
  videoPlaying: boolean
  videoCurrentTime: number
  videoReadyState: number
  videoWidth: number
  startupStatus: 'idle' | 'starting' | 'ready' | 'failed'
}

export type UsageQualificationReason =
  | 'qualified'
  | 'startup_incomplete'
  | 'startup_failed'
  | 'audio_unhealthy'
  | 'video_unhealthy'

export interface UsageQualificationResult {
  qualified: boolean
  reason: UsageQualificationReason
}

function isAudioHealthy(input: UsageQualificationInput) {
  return input.audioPlaying && input.audioCurrentTime > 0
}

function isVideoHealthy(input: UsageQualificationInput) {
  // Require decoded frames (videoWidth > 0) so a black/buffering video with a
  // advancing clock does not count as qualified.
  return (
    input.videoPlaying &&
    input.videoCurrentTime > 0 &&
    input.videoReadyState >= 2 &&
    input.videoWidth > 0
  )
}

export function isUsageQualified(input: UsageQualificationInput): UsageQualificationResult {
  if (input.startupStatus === 'failed') {
    return { qualified: false, reason: 'startup_failed' }
  }

  if (input.startupStatus !== 'ready') {
    return { qualified: false, reason: 'startup_incomplete' }
  }

  if (input.sessionMode === 'audio_only') {
    return isAudioHealthy(input)
      ? { qualified: true, reason: 'qualified' }
      : { qualified: false, reason: 'audio_unhealthy' }
  }

  // dual, combined, and video_only modes all require healthy video.
  if (!isVideoHealthy(input)) {
    return { qualified: false, reason: 'video_unhealthy' }
  }

  // In dual mode audio is a separate required stream; in combined/video_only
  // modes the video asset carries (or is) the session media.
  if (input.sessionMode === 'dual' && !isAudioHealthy(input)) {
    return { qualified: false, reason: 'audio_unhealthy' }
  }

  return { qualified: true, reason: 'qualified' }
}
