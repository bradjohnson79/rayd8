export type SpeedMode = 'standard' | 'fast' | 'superFast' | 'slow' | 'superSlow'
export type AmplifierMode = 'off' | '5x' | '10x' | '20x'

export interface MediaSourcePair {
  video: string
  audio: string
}

export interface MediaPlanSources {
  standard: MediaSourcePair
  fast: MediaSourcePair
  superFast: MediaSourcePair
  slow: MediaSourcePair
  superSlow: MediaSourcePair
}

export type MediaSources = Record<'free' | 'premium' | 'regen' | 'amrita', MediaPlanSources>

export interface PersistedPlayerSettings {
  amplifierMode: AmplifierMode
  blueLightEnabled: boolean
  circadianEnabled: boolean
  lastSpeedMode: SpeedMode
}

export interface PlayerState extends PersistedPlayerSettings {
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  audioUnlocked: boolean
  amplifierMenuOpen: boolean
  exitModalOpen: boolean
  videoError: string | null
  audioError: string | null
}
