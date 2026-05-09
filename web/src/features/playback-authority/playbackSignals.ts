export type PlaybackSignal =
  | { type: 'lifecycle_preloading' }
  | { type: 'lifecycle_ready' }
  | { type: 'lifecycle_play_attempt_finished'; ok: boolean }
  | { type: 'lifecycle_fatal'; message?: string }
  | { type: 'lifecycle_idle' }
  | { type: 'tab_hidden' }
  | { type: 'tab_visible' }
  | { type: 'continuity_threshold_reached' }
  | { type: 'video_stall_observed'; corroborated: boolean }
  | { type: 'video_persistent_freeze'; reason: 'stalled' | 'buffer_health' }
  | { type: 'video_error' }
  | { type: 'video_pause_while_expecting_play' }
  | { type: 'video_ended_loop' }
  | { type: 'audio_autoplay_blocked' }
  | { type: 'audio_error' }
  | { type: 'audio_paused_while_expected'; reason: 'health-check' | 'unknown' }
  | { type: 'user_resume_requested' }

export type PlaybackSignalCategory = 'transient' | 'recoverable' | 'user_gesture' | 'hard_stop'

export function classifyPlaybackSignal(signal: PlaybackSignal): PlaybackSignalCategory {
  switch (signal.type) {
    case 'lifecycle_fatal':
      return 'hard_stop'
    case 'continuity_threshold_reached':
      return 'hard_stop'
    case 'audio_autoplay_blocked':
      return 'user_gesture'
    case 'lifecycle_play_attempt_finished':
      return signal.ok ? 'transient' : 'user_gesture'
    case 'user_resume_requested':
      return 'user_gesture'
    case 'video_persistent_freeze':
    case 'video_error':
    case 'audio_error':
    case 'audio_paused_while_expected':
      return 'recoverable'
    case 'video_pause_while_expecting_play':
      return 'recoverable'
    case 'tab_visible':
      return 'recoverable'
    default:
      return 'transient'
  }
}

export function playbackSignalPriority(signal: PlaybackSignal): number {
  switch (signal.type) {
    case 'lifecycle_fatal':
      return 100
    case 'continuity_threshold_reached':
      return 90
    case 'video_error':
    case 'audio_error':
      return 82
    case 'video_persistent_freeze':
      return 78
    case 'audio_autoplay_blocked':
      return 72
    case 'lifecycle_play_attempt_finished':
      return signal.ok ? 5 : 68
    case 'audio_paused_while_expected':
      return 62
    case 'video_pause_while_expecting_play':
      return 58
    case 'tab_visible':
      return 48
    case 'user_resume_requested':
      return 95
    default:
      return 10
  }
}
