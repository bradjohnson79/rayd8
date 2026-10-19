import type { SigilDomain } from './svg.js'
import { designSpecFromCode, geometrySignature, renderSigilSvg, sanitizeSigilSvg, svgHash } from './svg.js'

export type SigilStatus =
  | 'draft'
  | 'generated'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'archived'
  | 'generation_failed'

export interface PilotSigil {
  publicCode: string
  name: string
  domain: SigilDomain
  category: string
  description: string
  assumptionStatement: string
  primaryKeywords: string[]
  secondaryKeywords: string[]
  semanticTags: string[]
  synonyms: string[]
  relatedCodes: string[]
  status: SigilStatus
}

export const PILOT_SIGILS: PilotSigil[] = [
  {
    publicCode: 'P-VITALITY-001',
    name: 'Physical Vitality',
    domain: 'physical',
    category: 'bodily_systems',
    description: 'A symbolic assumption of bodily vitality and ease of movement.',
    assumptionStatement: 'I am established in physical vitality.',
    primaryKeywords: ['vitality', 'energy', 'body'],
    secondaryKeywords: ['stamina', 'aliveness'],
    semanticTags: ['physical', 'vitality'],
    synonyms: ['vigor', 'life force'],
    relatedCodes: ['P-ENERGY-001'],
    status: 'published',
  },
  {
    publicCode: 'P-HEART-001',
    name: 'Prime Heart',
    domain: 'physical',
    category: 'organ',
    description: 'A symbolic assumption of the heart in its prime optimal state.',
    assumptionStatement: 'My heart is established in strength and ease.',
    primaryKeywords: ['heart', 'cardiac', 'organ'],
    secondaryKeywords: ['circulation'],
    semanticTags: ['physical', 'heart'],
    synonyms: ['heart center'],
    relatedCodes: ['P-VITALITY-001'],
    status: 'published',
  },
  {
    publicCode: 'P-ENERGY-001',
    name: 'Energy Balance',
    domain: 'physical',
    category: 'energy_anatomy',
    description: 'A symbolic assumption of balanced bodily energy.',
    assumptionStatement: 'I am established in balanced physical energy.',
    primaryKeywords: ['energy', 'balance', 'body'],
    secondaryKeywords: ['stamina'],
    semanticTags: ['physical', 'energy'],
    synonyms: ['vital energy'],
    relatedCodes: ['P-VITALITY-001'],
    status: 'approved',
  },
  {
    publicCode: 'E-HAPPINESS-001',
    name: 'Inner Happiness',
    domain: 'emotional',
    category: 'joy',
    description: 'A symbolic assumption of present happiness.',
    assumptionStatement: 'I am established in happiness.',
    primaryKeywords: ['happiness', 'joy', 'emotion'],
    secondaryKeywords: ['contentment'],
    semanticTags: ['emotional', 'joy'],
    synonyms: ['gladness'],
    relatedCodes: ['E-PEACE-001'],
    status: 'published',
  },
  {
    publicCode: 'E-PEACE-001',
    name: 'Emotional Peace',
    domain: 'emotional',
    category: 'peace',
    description: 'A symbolic assumption of emotional peace.',
    assumptionStatement: 'I am established in emotional peace.',
    primaryKeywords: ['peace', 'calm', 'emotion'],
    secondaryKeywords: ['ease'],
    semanticTags: ['emotional', 'peace'],
    synonyms: ['serenity'],
    relatedCodes: ['E-HAPPINESS-001'],
    status: 'published',
  },
  {
    publicCode: 'E-RADIANCE-001',
    name: 'Emotional Radiance',
    domain: 'emotional',
    category: 'radiance',
    description: 'A symbolic assumption of warm emotional radiance.',
    assumptionStatement: 'I am established in emotional radiance.',
    primaryKeywords: ['radiance', 'warmth', 'emotion'],
    secondaryKeywords: ['appreciation'],
    semanticTags: ['emotional', 'radiance'],
    synonyms: ['glow'],
    relatedCodes: ['E-HAPPINESS-001'],
    status: 'pending_review',
  },
  {
    publicCode: 'M-CLARITY-001',
    name: 'Mental Clarity',
    domain: 'mental',
    category: 'clarity',
    description: 'A symbolic assumption of clear, steady thought.',
    assumptionStatement: 'I am established in mental clarity.',
    primaryKeywords: ['clarity', 'focus', 'mind'],
    secondaryKeywords: ['concentration'],
    semanticTags: ['mental', 'clarity'],
    synonyms: ['clear mind'],
    relatedCodes: ['M-MASTERY-001'],
    status: 'published',
  },
  {
    publicCode: 'M-MASTERY-001',
    name: 'Self-Mastery',
    domain: 'mental',
    category: 'will',
    description: 'A symbolic assumption of calm self-mastery.',
    assumptionStatement: 'I am established in self-mastery.',
    primaryKeywords: ['mastery', 'will', 'mind'],
    secondaryKeywords: ['discipline'],
    semanticTags: ['mental', 'mastery'],
    synonyms: ['self command'],
    relatedCodes: ['M-CONFIDENCE-001'],
    status: 'published',
  },
  {
    publicCode: 'M-CONFIDENCE-001',
    name: 'Mental Confidence',
    domain: 'mental',
    category: 'confidence',
    description: 'A symbolic assumption of confident thought.',
    assumptionStatement: 'I am established in confidence.',
    primaryKeywords: ['confidence', 'certainty', 'mind'],
    secondaryKeywords: ['assurance'],
    semanticTags: ['mental', 'confidence'],
    synonyms: ['self assurance'],
    relatedCodes: ['M-MASTERY-001'],
    status: 'approved',
  },
  {
    publicCode: 'C-PROSPERITY-001',
    name: 'Prosperity',
    domain: 'causal',
    category: 'abundance',
    description: 'A symbolic assumption of established prosperity. This is not a financial promise.',
    assumptionStatement: 'I am established in prosperity.',
    primaryKeywords: ['prosperity', 'abundance', 'resources'],
    secondaryKeywords: ['sufficiency'],
    semanticTags: ['causal', 'prosperity'],
    synonyms: ['plenty'],
    relatedCodes: ['C-STABILITY-001'],
    status: 'published',
  },
  {
    publicCode: 'C-STABILITY-001',
    name: 'Financial Stability',
    domain: 'causal',
    category: 'stability',
    description: 'A symbolic assumption of stable material circumstances. This is not a financial promise.',
    assumptionStatement: 'I am established in financial stability.',
    primaryKeywords: ['stability', 'security', 'resources'],
    secondaryKeywords: ['steadiness'],
    semanticTags: ['causal', 'stability'],
    synonyms: ['material stability'],
    relatedCodes: ['C-PROSPERITY-001'],
    status: 'published',
  },
  {
    publicCode: 'C-HARMONY-001',
    name: 'Life Harmony',
    domain: 'causal',
    category: 'harmony',
    description: 'A symbolic assumption of harmonious life circumstances.',
    assumptionStatement: 'I am established in life harmony.',
    primaryKeywords: ['harmony', 'alignment', 'life'],
    secondaryKeywords: ['togetherness'],
    semanticTags: ['causal', 'harmony'],
    synonyms: ['life balance'],
    relatedCodes: ['C-PROSPERITY-001'],
    status: 'pending_review',
  },
]

const CLAIM_LANGUAGE = [/cure[sd]?/i, /clinically proven/i, /guaranteed return/i, /will heal/i, /repairs tissue/i]

export function claimLanguageIssues(text: string) {
  return CLAIM_LANGUAGE.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source)
}

export interface RenderedPilot {
  sigil: PilotSigil
  svg: string
  hash: string
  signature: string
}

export function renderPilotSigil(sigil: PilotSigil): RenderedPilot {
  const spec = designSpecFromCode(sigil.publicCode, sigil.domain)
  const svg = renderSigilSvg(spec, true)
  const sanitized = sanitizeSigilSvg(svg)
  if (!sanitized.ok) {
    throw new Error(sanitized.reason)
  }

  return {
    sigil,
    svg: sanitized.svg,
    hash: svgHash(sanitized.svg),
    signature: geometrySignature(spec),
  }
}

export function renderPilotLibrary() {
  return PILOT_SIGILS.map((sigil) => renderPilotSigil(sigil))
}

export function publishedPilotSigils() {
  return PILOT_SIGILS.filter((sigil) => sigil.status === 'published')
}
