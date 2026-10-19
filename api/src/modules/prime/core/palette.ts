export const SPECTRAL_IDS = [
  'white',
  'red',
  'orange',
  'yellow',
  'green',
  'aqua',
  'blue',
  'violet',
  'ultraviolet',
  'brown',
  'gray',
  'gold',
] as const

export type SpectralId = (typeof SPECTRAL_IDS)[number]

export const SPECTRAL_RGB: Record<SpectralId, readonly [number, number, number]> = {
  white: [244, 247, 251],
  red: [226, 75, 75],
  orange: [240, 138, 60],
  yellow: [242, 209, 90],
  green: [60, 191, 122],
  aqua: [62, 207, 207],
  blue: [61, 125, 255],
  violet: [139, 92, 255],
  ultraviolet: [106, 76, 255],
  brown: [138, 90, 60],
  gray: [141, 147, 140],
  gold: [224, 180, 76],
}

export const ATMOSPHERE_IDS = [
  'healing',
  'balancing',
  'cleansing',
  'enhancement',
  'relaxation',
  'meditation',
  'whole-body',
] as const

export type AtmosphereId = (typeof ATMOSPHERE_IDS)[number]

export const ATMOSPHERE_PALETTES: Record<AtmosphereId, readonly SpectralId[]> = {
  healing: ['green', 'aqua', 'gold', 'white'],
  balancing: ['aqua', 'green', 'violet', 'gold'],
  cleansing: ['white', 'aqua', 'blue', 'violet'],
  enhancement: ['gold', 'orange', 'yellow', 'red'],
  relaxation: ['blue', 'violet', 'aqua', 'white'],
  meditation: ['violet', 'ultraviolet', 'blue', 'white'],
  'whole-body': ['green', 'gold', 'aqua', 'violet'],
}

export function isSpectralId(value: string): value is SpectralId {
  return (SPECTRAL_IDS as readonly string[]).includes(value)
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function ease(amount: number) {
  const clamped = Math.min(1, Math.max(0, amount))
  return clamped * clamped * (3 - 2 * clamped)
}

export function rgbCss(id: SpectralId) {
  const [red, green, blue] = SPECTRAL_RGB[id]
  return `rgb(${red}, ${green}, ${blue})`
}

/**
 * Coordinated palette, independent assignment per layer.
 * `layerSalt` keeps hex boundaries and bubbles from matching at the same instant.
 */
export function spectralColorAt(input: {
  palette: readonly SpectralId[]
  index: number
  elapsedMs: number
  transitionMs: number
  layerSalt: number
  reducedMotion?: boolean
}) {
  const palette = input.palette.length > 0 ? input.palette : (['white'] as const)
  const slot = Math.abs(input.index + input.layerSalt) % palette.length
  const next = palette[(slot + 1) % palette.length] ?? palette[slot]!
  const current = palette[slot]!

  if (input.reducedMotion || input.transitionMs <= 0) {
    return { id: current, css: rgbCss(current) }
  }

  const phase = (input.elapsedMs / input.transitionMs + input.layerSalt * 0.17) % 1
  const blend = ease(phase)
  const from = SPECTRAL_RGB[current]
  const to = SPECTRAL_RGB[next]
  const red = Math.round(lerp(from[0], to[0], blend))
  const green = Math.round(lerp(from[1], to[1], blend))
  const blue = Math.round(lerp(from[2], to[2], blend))

  return {
    id: blend < 0.5 ? current : next,
    css: `rgb(${red}, ${green}, ${blue})`,
  }
}
