export const CYMATIC_GAIN_MAX = 0.35
export const MUSIC_GAIN_MAX = 0.35
export const BASS_RESONANCE_MAX = 0.6
export const REVERB_MAX = 0.35
export const BASS_FREQUENCY_FLOOR_HZ = 40

export const OUTPUT_PROFILES = [
  'mobile-builtin',
  'headphones',
  'stereo-speakers',
  'tv-soundbar',
  'surround-subwoofer',
] as const

export type OutputProfile = (typeof OUTPUT_PROFILES)[number]

export const FREQUENCY_FORMULAS = ['demo-still', 'demo-rise', 'demo-warm'] as const
export type FrequencyFormula = (typeof FREQUENCY_FORMULAS)[number]

export function clampUnit(value: number, max: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(max, Math.max(0, value))
}

export function resolveSpatialMode(profile: OutputProfile, requested: 'stereo' | 'hrtf', hrtfAvailable: boolean) {
  if (profile === 'headphones' && requested === 'hrtf' && hrtfAvailable) {
    return 'hrtf' as const
  }

  return 'stereo' as const
}

export function bassShelfDb(profile: OutputProfile) {
  switch (profile) {
    case 'mobile-builtin':
      return -4
    case 'stereo-speakers':
      return -2
    case 'tv-soundbar':
      return -1
    case 'surround-subwoofer':
      return 3
    case 'headphones':
      return 0
    default:
      return 0
  }
}

export function formulaFrequencies(formula: FrequencyFormula) {
  switch (formula) {
    case 'demo-rise':
      return { fundamental: 192, bass: 48, harmonics: [384] }
    case 'demo-warm':
      return { fundamental: 96, bass: 40, harmonics: [192] }
    case 'demo-still':
    default:
      return { fundamental: 128, bass: 64, harmonics: [256] }
  }
}
