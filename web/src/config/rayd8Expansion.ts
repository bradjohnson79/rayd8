import type { Experience, SessionType } from '../app/types'

export const EXPANSION_VIDEO_MODES = {
  superSlow: {
    label: 'Super Slow',
  },
  slow: {
    label: 'Slow',
  },
  standard: {
    label: 'Standard',
    default: true,
  },
  fast: {
    label: 'Fast',
  },
  superFast: {
    label: 'Super Fast',
  },
} as const

export const PREMIUM_VIDEO_MODES = {
  superSlow: {
    label: 'Super Slow',
  },
  slow: {
    label: 'Slow',
  },
  standard: {
    label: 'Standard',
    default: true,
  },
  fast: {
    label: 'Fast',
  },
  superFast: {
    label: 'Super Fast',
  },
} as const

export const REGEN_VIDEO_MODES = {
  superSlow: {
    label: 'Super Slow',
  },
  slow: {
    label: 'Slow',
  },
  standard: {
    label: 'Standard',
    default: true,
  },
  fast: {
    label: 'Fast',
  },
  superFast: {
    label: 'Super Fast',
  },
} as const

export const SHARED_AUDIO_TRACKS = {
  none: {
    label: 'No Audio',
    type: 'mute',
  },
  expansion: {
    label: 'Expansion Track',
    assetId: '1uhVrH02IjQZ02cd9oS2rh76Jsup0102Bdhbbjkpla86HGU',
  },
  premium: {
    label: 'Premium Track',
    assetId: '01AdpMIKawyRvpldKwLd2wVH7BS01ToIOQ00meJDLijJhw',
  },
} as const

export const SESSION_VIDEO_MODE_MAPS: Record<
  Experience,
  Record<SessionVideoMode, { default?: true; label: string }>
> = {
  expansion: EXPANSION_VIDEO_MODES,
  premium: PREMIUM_VIDEO_MODES,
  regen: REGEN_VIDEO_MODES,
}

export type SessionVideoMode = keyof typeof EXPANSION_VIDEO_MODES
export type SharedAudioTrack = keyof typeof SHARED_AUDIO_TRACKS
export type AmplificationLevel = 'off' | '5x' | '10x' | '20x'

export interface LastSessionConfig {
  videoMode: SessionVideoMode
  audioTrack: SharedAudioTrack
  amplification: AmplificationLevel
}

export const DEFAULT_SESSION_VIDEO_MODE: SessionVideoMode = 'standard'
export const DEFAULT_SHARED_AUDIO_TRACK: SharedAudioTrack = 'none'
export const DEFAULT_AMPLIFICATION_LEVEL: AmplificationLevel = 'off'
export const FREE_TRIAL_SESSION_TIMEOUT_MS = 120 * 60 * 1000
export const FREE_TRIAL_SESSION_PROMPT_MS = 60 * 1000
export const LAST_SESSION_STORAGE_KEY = 'rayd8-last-session-config'
export const AUDIO_STORAGE_KEY = 'rayd8-global-audio-config'

export function getExperienceFromSessionType(sessionType: SessionType): Experience {
  if (sessionType === 'premium') {
    return 'premium'
  }

  if (sessionType === 'regen') {
    return 'regen'
  }

  return 'expansion'
}

export function getSessionVideoModes(sessionType: SessionType) {
  return SESSION_VIDEO_MODE_MAPS[getExperienceFromSessionType(sessionType)]
}

export const FREE_TRIAL_VIDEO_MODES = EXPANSION_VIDEO_MODES
export const FREE_TRIAL_AUDIO_TRACKS = SHARED_AUDIO_TRACKS
export type FreeTrialVideoMode = SessionVideoMode
export type FreeTrialAudioTrack = SharedAudioTrack
export const DEFAULT_FREE_TRIAL_VIDEO_MODE = DEFAULT_SESSION_VIDEO_MODE
export const DEFAULT_FREE_TRIAL_AUDIO_TRACK = DEFAULT_SHARED_AUDIO_TRACK
