export interface AssumptionPreset {
  publicCode: string
  name: string
  description: string
  keywords: string[]
  sigilCodes: string[]
  status: 'draft' | 'published'
}

export const ASSUMPTION_PRESETS: AssumptionPreset[] = [
  {
    publicCode: 'PRESET-VITALITY',
    name: 'Total Body Vitality',
    description: 'A curated set of published physical assumption sigils.',
    keywords: ['vitality', 'body'],
    sigilCodes: ['P-VITALITY-001', 'P-HEART-001'],
    status: 'published',
  },
  {
    publicCode: 'PRESET-RADIANCE',
    name: 'Emotional Radiance',
    description: 'A curated set for a radiant emotional atmosphere.',
    keywords: ['emotion', 'happiness'],
    sigilCodes: ['E-HAPPINESS-001', 'E-PEACE-001'],
    status: 'published',
  },
  {
    publicCode: 'PRESET-MASTERY',
    name: 'Confidence and Self-Mastery',
    description: 'A curated mental set for clarity and self-mastery.',
    keywords: ['confidence', 'mastery'],
    sigilCodes: ['M-CLARITY-001', 'M-MASTERY-001'],
    status: 'published',
  },
  {
    publicCode: 'PRESET-PROSPERITY',
    name: 'Wealth and Prosperity',
    description: 'A symbolic causal set. It is not a financial promise.',
    keywords: ['prosperity', 'stability'],
    sigilCodes: ['C-PROSPERITY-001', 'C-STABILITY-001'],
    status: 'published',
  },
  {
    publicCode: 'PRESET-TOGETHERNESS',
    name: 'Love and Togetherness',
    description: 'A curated emotional and causal pairing for harmony.',
    keywords: ['harmony', 'peace'],
    sigilCodes: ['E-PEACE-001', 'C-HARMONY-001'],
    status: 'draft',
  },
  {
    publicCode: 'PRESET-CONSCIOUSNESS',
    name: 'Peace and Higher Consciousness',
    description: 'A curated mental and emotional pairing.',
    keywords: ['peace', 'clarity'],
    sigilCodes: ['E-PEACE-001', 'M-CLARITY-001'],
    status: 'published',
  },
  {
    publicCode: 'PRESET-CREATIVITY',
    name: 'Creativity and Achievement',
    description: 'A curated mental and causal pairing.',
    keywords: ['clarity', 'harmony'],
    sigilCodes: ['M-CLARITY-001', 'C-HARMONY-001'],
    status: 'draft',
  },
  {
    publicCode: 'PRESET-WHOLE',
    name: 'Whole-Being Harmony',
    description: 'One published sigil from each domain.',
    keywords: ['harmony', 'vitality', 'peace', 'clarity'],
    sigilCodes: ['P-VITALITY-001', 'E-PEACE-001', 'M-CLARITY-001', 'C-HARMONY-001'],
    status: 'draft',
  },
]
