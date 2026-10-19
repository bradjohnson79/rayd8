import { z } from 'zod'
import { ATMOSPHERE_PALETTES, SPECTRAL_IDS } from './palette.js'
import { outlinePx } from './amplification.js'
import {
  BASS_RESONANCE_MAX,
  CYMATIC_GAIN_MAX,
  FREQUENCY_FORMULAS,
  MUSIC_GAIN_MAX,
  OUTPUT_PROFILES,
  REVERB_MAX,
} from './audio.js'

export const spectralIdSchema = z.enum(SPECTRAL_IDS)
export const domainSchema = z.enum(['physical', 'emotional', 'mental', 'causal'])

const playlistItemSchema = z.object({
  sigilCode: z.string().min(3).max(64),
  amplification: z.number().int().min(1).max(8),
})

const playlistSchema = z.array(playlistItemSchema).min(1).max(24)

export const HOMUNCULUS_ASPECT = 9 / 16

export const DEFAULT_FACE_FRAMES = {
  male: { left: 42, top: 4.6, size: 16 },
  female: { left: 41, top: 5.2, size: 17 },
} as const

const faceFrameSchema = z.object({
  left: z.number().min(0).max(80),
  top: z.number().min(0).max(80),
  size: z.number().min(6).max(40),
})

const facePlacementSchema = z.object({
  scale: z.number().min(0.6).max(1.8),
  offsetX: z.number().min(-40).max(40),
  offsetY: z.number().min(-40).max(40),
  frame: faceFrameSchema.optional(),
})

const defaultFacePlacement = { scale: 1, offsetX: 0, offsetY: 0 }

export function faceFrameHeight(size: number) {
  return size * HOMUNCULUS_ASPECT
}

export const primePrescriptionSchema = z.object({
  sessionName: z.string().trim().min(1).max(80).default('Prime session'),
  intention: z.string().trim().max(280).default(''),
  durationMinutes: z.number().int().min(5).max(120),
  rotationSeconds: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]),
  homunculus: z
    .object({
      avatar: z.enum(['male', 'female']),
      scale: z.number().min(0.6).max(1.8),
      offsetX: z.number().min(-40).max(40),
      offsetY: z.number().min(-40).max(40),
      faces: z
        .object({
          male: facePlacementSchema,
          female: facePlacementSchema,
        })
        .optional(),
    })
    .default({ avatar: 'male', ...defaultFacePlacement })
    .transform((value) => {
      const placed = (avatar: 'male' | 'female') => {
        const face = value.faces?.[avatar]
        return {
          scale: face?.scale ?? value.scale,
          offsetX: face?.offsetX ?? value.offsetX,
          offsetY: face?.offsetY ?? value.offsetY,
          frame: face?.frame ?? { ...DEFAULT_FACE_FRAMES[avatar] },
        }
      }
      const faces = { male: placed('male'), female: placed('female') }
      const active = faces[value.avatar]
      return { avatar: value.avatar, scale: active.scale, offsetX: active.offsetX, offsetY: active.offsetY, faces }
    }),
  playlists: z.object({
    mental: playlistSchema,
    causal: playlistSchema,
    physical: playlistSchema,
    emotional: playlistSchema,
  }),
  hexGrid: z.object({
    enabled: z.boolean(),
    glyphSet: z.string().min(1).max(64),
    tileSize: z.number().min(40).max(220),
    gridOpacity: z.number().min(0).max(1),
    boundaryOpacity: z.number().min(0).max(1),
    boundaryGlow: z.number().min(0).max(12).default(3),
    outlineWidth: z.number().min(0.5).max(4).default(1.25),
    glyphOpacity: z.number().min(0).max(1).default(0.92),
    spectralPalette: z.array(spectralIdSchema).min(1).max(12),
    colorTransitionSpeed: z.number().min(400).max(20000),
  }),
  fibonacciFlow: z
    .object({
      enabled: z.boolean(),
      opacity: z.number().min(0).max(1),
      palette: z.array(spectralIdSchema).min(1).max(12),
      particleDensity: z.number().int().min(0).max(160),
      particleSizeRange: z.tuple([z.number().min(2).max(28), z.number().min(2).max(36)]),
      sequence: z.literal('standard'),
      directionMode: z.literal('alternating-down-up'),
      transitionSettings: z.object({
        easeMs: z.number().min(0).max(1500),
      }),
    })
    .refine((value) => value.particleSizeRange[0] <= value.particleSizeRange[1], {
      message: 'Particle size range is inverted.',
    }),
  cymatics: z.object({
    enabled: z.boolean(),
    geometry: z.enum(['square', 'circle']),
    opacity: z.number().min(0.2).max(0.5),
    formula: z.enum(FREQUENCY_FORMULAS),
  }),
  audio: z.object({
    audioMode: z.enum(['music', 'cymatics', 'both']),
    outputProfile: z.enum(OUTPUT_PROFILES),
    spatialMode: z.enum(['stereo', 'hrtf']),
    spatialImmersion: z.number().min(0).max(1),
    bassResonance: z.number().min(0).max(BASS_RESONANCE_MAX),
    cymaticGain: z.number().min(0).max(CYMATIC_GAIN_MAX),
    musicGain: z.number().min(0).max(MUSIC_GAIN_MAX),
    harmonicPositioning: z.number().min(0).max(1),
    reverbAmount: z.number().min(0).max(REVERB_MAX),
    frequencyFormula: z.enum(FREQUENCY_FORMULAS),
  }),
  perimeter: z.object({
    enabled: z.boolean(),
    sampleLabel: z.string().min(1).max(120),
  }),
  border: z.object({
    enabled: z.boolean(),
    color: spectralIdSchema,
    mode: z.enum(['steady', 'dynamic']),
  }),
  aurora: z.object({
    enabled: z.boolean(),
  }),
})

export type PrimePrescription = z.infer<typeof primePrescriptionSchema>

export function createDefaultPrescription(): PrimePrescription {
  const item = (sigilCode: string, amplification = 4) => ({ sigilCode, amplification })

  return primePrescriptionSchema.parse({
    sessionName: 'Prime session',
    intention: '',
    durationMinutes: 15,
    rotationSeconds: 30,
    homunculus: {
      avatar: 'male',
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      faces: {
        male: { scale: 1, offsetX: 0, offsetY: 0, frame: { ...DEFAULT_FACE_FRAMES.male } },
        female: { scale: 1, offsetX: 0, offsetY: 0, frame: { ...DEFAULT_FACE_FRAMES.female } },
      },
    },
    playlists: {
      mental: [item('M-CLARITY-001', 4), item('M-MASTERY-001', 5)],
      causal: [item('C-PROSPERITY-001', 3), item('C-STABILITY-001', 4)],
      physical: [item('P-VITALITY-001', 5), item('P-HEART-001', 6)],
      emotional: [item('E-PEACE-001', 3), item('E-HAPPINESS-001', 4)],
    },
    hexGrid: {
      enabled: true,
      glyphSet: 'amrita-core',
      tileSize: 64,
      gridOpacity: 0.92,
      boundaryOpacity: 0.8,
      boundaryGlow: 2,
      outlineWidth: 1.25,
      glyphOpacity: 0.92,
      spectralPalette: [...ATMOSPHERE_PALETTES.balancing],
      colorTransitionSpeed: 6000,
    },
    fibonacciFlow: {
      enabled: true,
      opacity: 0.5,
      palette: [...ATMOSPHERE_PALETTES.cleansing],
      particleDensity: 48,
      particleSizeRange: [4, 14],
      sequence: 'standard',
      directionMode: 'alternating-down-up',
      transitionSettings: { easeMs: 400 },
    },
    cymatics: {
      enabled: true,
      geometry: 'square',
      opacity: 0.32,
      formula: 'demo-still',
    },
    audio: {
      audioMode: 'cymatics',
      outputProfile: 'headphones',
      spatialMode: 'hrtf',
      spatialImmersion: 0.45,
      bassResonance: 0.25,
      cymaticGain: 0.12,
      musicGain: 0.1,
      harmonicPositioning: 0.35,
      reverbAmount: 0.08,
      frequencyFormula: 'demo-still',
    },
    perimeter: {
      enabled: false,
      sampleLabel: 'Sample natal / numerology fixture',
    },
    border: {
      enabled: true,
      color: 'gold',
      mode: 'steady',
    },
    aurora: { enabled: true },
  })
}

export function amplificationMap(level: number) {
  return { level, outlinePx: outlinePx(level) }
}
