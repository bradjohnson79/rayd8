import { PILOT_SIGILS, type PilotSigil } from './catalog.js'
import type { SigilDomain } from './svg.js'

export const CATALOG_APPROVAL = 'pending' as const
export type ConceptStatus = 'draft' | 'approved_concept' | 'retired'

export interface ProposedConcept extends PilotSigil {
  conceptStatus: ConceptStatus
  definition: string
}

const PREFIX: Record<SigilDomain, string> = {
  physical: 'P',
  emotional: 'E',
  mental: 'M',
  causal: 'C',
}

const GROUPS: Array<{ domain: SigilDomain; category: string; names: string[] }> = [
  {
    domain: 'physical',
    category: 'breath',
    names: ['Diaphragm Ease', 'Nasal Clarity', 'Rib Expansion', 'Exhale Length', 'Breath Rhythm', 'Lung Comfort', 'Airway Openness', 'Quiet Inhale', 'Breath Recovery', 'Chest Softness'],
  },
  {
    domain: 'physical',
    category: 'circulation',
    names: ['Warm Hands', 'Warm Feet', 'Steady Pulse', 'Capillary Flow', 'Limb Warmth', 'Vascular Ease', 'Circulatory Rhythm', 'Blood Warmth', 'Peripheral Flow', 'Pulse Calm'],
  },
  {
    domain: 'physical',
    category: 'strength',
    names: ['Core Support', 'Limb Strength', 'Grip Ease', 'Standing Power', 'Lift Readiness', 'Muscle Tone', 'Functional Strength', 'Stable Exertion', 'Endurance Base', 'Power Reserve'],
  },
  {
    domain: 'physical',
    category: 'recovery',
    names: ['Tissue Recovery', 'Rest Between Efforts', 'Overnight Repair', 'Muscle Ease', 'Recovery Window', 'Gentle Rebound', 'Strain Release', 'Post-Effort Calm'],
  },
  {
    domain: 'physical',
    category: 'posture',
    names: ['Upright Carriage', 'Shoulder Ease', 'Neck Length', 'Spinal Ease', 'Pelvic Balance', 'Open Chest', 'Grounded Stance', 'Aligned Head'],
  },
  {
    domain: 'physical',
    category: 'sleep',
    names: ['Sleep Onset', 'Deep Rest', 'Night Continuity', 'Morning Freshness', 'Restful Body', 'Sleep Depth', 'Quiet Night', 'Wake Ease'],
  },
  {
    domain: 'physical',
    category: 'digestion',
    names: ['Stomach Ease', 'Appetite Balance', 'Gut Comfort', 'Digestive Rhythm', 'Abdominal Softness', 'Nourishment Uptake', 'Bowel Regularity', 'After-Meal Ease'],
  },
  {
    domain: 'physical',
    category: 'joints',
    names: ['Knee Ease', 'Hip Mobility', 'Ankle Stability', 'Wrist Comfort', 'Shoulder Mobility', 'Spine Mobility', 'Joint Glide', 'Flexible Range'],
  },
  {
    domain: 'physical',
    category: 'senses',
    names: ['Clear Vision', 'Hearing Ease', 'Touch Sensitivity', 'Taste Balance', 'Smell Clarity', 'Sensory Calm', 'Eye Comfort', 'Ear Ease'],
  },
  {
    domain: 'physical',
    category: 'immunity',
    names: ['Immune Readiness', 'Barrier Strength', 'Seasonal Ease', 'Lymph Ease', 'Defense Reserve', 'Recovery Vigilance', 'Cellular Ease', 'Resilient Body'],
  },
  {
    domain: 'physical',
    category: 'skin',
    names: ['Skin Comfort', 'Even Complexion', 'Skin Suppleness', 'Surface Calm', 'Skin Warmth', 'Dermal Ease'],
  },
  {
    domain: 'physical',
    category: 'comfort',
    names: ['Physical Comfort', 'Ease of Movement', 'Bodily Quiet', 'Somatic Ease', 'Rested Muscles'],
  },
  {
    domain: 'emotional',
    category: 'joy',
    names: ['Quiet Joy', 'Warm Delight', 'Lightness', 'Cheer', 'Gladness', 'Bright Mood', 'Easy Laughter', 'Contentment Spark'],
  },
  {
    domain: 'emotional',
    category: 'peacefulness',
    names: ['Inner Quiet', 'Settled Feeling', 'Soft Peace', 'Emotional Stillness', 'Calm Heart', 'Unhurried Mood', 'Gentle Rest', 'Peaceful Presence'],
  },
  {
    domain: 'emotional',
    category: 'courage',
    names: ['Steady Courage', 'Brave Heart', 'Willing Step', 'Emotional Backbone', 'Courageous Calm', 'Open Bravery', 'Quiet Boldness', 'Heartened Feeling'],
  },
  {
    domain: 'emotional',
    category: 'grief',
    names: ['Tender Grief', 'Gentle Sorrow', 'Honored Loss', 'Soft Sadness', 'Grief Ease', 'Mourning Quiet'],
  },
  {
    domain: 'emotional',
    category: 'love',
    names: ['Warm Affection', 'Kind Regard', 'Loving Presence', 'Tender Care', 'Open Heart', 'Fondness', 'Devotion', 'Companionship'],
  },
  {
    domain: 'emotional',
    category: 'trust',
    names: ['Emotional Trust', 'Safe Feeling', 'Relational Ease', 'Open Trust', 'Steady Bond', 'Reassurance', 'Belonging', 'Welcomed Feeling'],
  },
  {
    domain: 'emotional',
    category: 'anger',
    names: ['Clean Anger', 'Boundaried Heat', 'Anger Clarity', 'Cooled Temper', 'Assertive Heat', 'Released Frustration'],
  },
  {
    domain: 'emotional',
    category: 'shame',
    names: ['Shame Softening', 'Self-Welcome', 'Unhidden Feeling', 'Dignity', 'Self-Kindness', 'Released Embarrassment'],
  },
  {
    domain: 'emotional',
    category: 'gratitude',
    names: ['Thankfulness', 'Appreciative Mood', 'Grateful Heart', 'Noticing Gifts', 'Quiet Thanks', 'Grateful Ease'],
  },
  {
    domain: 'emotional',
    category: 'hope',
    names: ['Gentle Hope', 'Forward Feeling', 'Hopeful Mood', 'Dawn Feeling', 'Expectant Calm', 'Renewed Hope'],
  },
  {
    domain: 'emotional',
    category: 'awe',
    names: ['Quiet Awe', 'Wonder', 'Reverent Feeling', 'Vastness', 'Humble Wonder', 'Inspired Awe'],
  },
  {
    domain: 'mental',
    category: 'attention',
    names: ['Focused Attention', 'Clear Thinking', 'Mental Quiet', 'Uncluttered Mind', 'Sharp Notice', 'Lucid Thought', 'Ordered Attention', 'Calm Focus'],
  },
  {
    domain: 'mental',
    category: 'learning',
    names: ['Willing Study', 'Skill Uptake', 'Curious Mind', 'Practice Readiness', 'Recall Ease', 'Learning Rhythm', 'Teachable Mind', 'Study Calm'],
  },
  {
    domain: 'mental',
    category: 'memory',
    names: ['Working Memory', 'Name Recall', 'Place Memory', 'Sequence Memory', 'Gentle Recall', 'Memory Quiet', 'Retained Detail'],
  },
  {
    domain: 'mental',
    category: 'decision',
    names: ['Clear Choice', 'Decision Calm', 'Weighed Option', 'Timely Choice', 'Settled Decision', 'Discernment', 'Priority Sense', 'Choice Ease'],
  },
  {
    domain: 'mental',
    category: 'imagination',
    names: ['Creative Image', 'Mental Picture', 'Inventive Thought', 'Playful Idea', 'Visioning', 'Imaginative Range', 'Fresh Concept', 'Inner Scene'],
  },
  {
    domain: 'mental',
    category: 'discipline',
    names: ['Steady Practice', 'Mental Follow-through', 'Attention Span', 'Task Continuity', 'Study Discipline', 'Returned Focus', 'Patient Effort', 'Kept Intention'],
  },
  {
    domain: 'mental',
    category: 'language',
    names: ['Clear Speech', 'Word Finding', 'Listening Mind', 'Precise Phrase', 'Quiet Listening', 'Expressive Thought', 'Inner Narration'],
  },
  {
    domain: 'mental',
    category: 'insight',
    names: ['Pattern Notice', 'Useful Insight', 'Connecting Idea', 'Perspective Shift', 'Seeing Structure', 'Mental Overview', 'Quiet Realization', 'Context Sense'],
  },
  {
    domain: 'mental',
    category: 'planning',
    names: ['Ordered Plan', 'Next Step', 'Time Sense', 'Sequenced Work', 'Prepared Mind', 'Plan Calm', 'Realistic Sequence'],
  },
  {
    domain: 'mental',
    category: 'concentration',
    names: ['Single Focus', 'Returned Attention', 'Spacious Attention', 'Detail Notice', 'Sustained Look', 'Soft Concentration'],
  },
  {
    domain: 'causal',
    category: 'provision',
    names: ['Steady Income', 'Resource Flow', 'Fair Exchange', 'Provision', 'Open Opportunity', 'Useful Surplus', 'Earned Increase', 'Financial Calm', 'Client Flow', 'Grateful Abundance'],
  },
  {
    domain: 'causal',
    category: 'work',
    names: ['Purposeful Work', 'Completed Task', 'Reliable Craft', 'Work Rhythm', 'Useful Output', 'Clean Handoff', 'Professional Ease', 'Focused Labor', 'Honored Work', 'Productive Calm'],
  },
  {
    domain: 'causal',
    category: 'home',
    names: ['Settled Home', 'Safe Dwelling', 'Orderly Rooms', 'Welcoming Space', 'Household Ease', 'Quiet House', 'Home Rhythm', 'Restful Rooms'],
  },
  {
    domain: 'causal',
    category: 'relationship',
    names: ['Clear Agreement', 'Kind Boundary', 'Mutual Respect', 'Honest Conversation', 'Reliable Friend', 'Family Warmth', 'Partnership Ease', 'Repaired Trust', 'Shared Purpose', 'Considerate Presence'],
  },
  {
    domain: 'causal',
    category: 'timing',
    names: ['Right Timing', 'Open Window', 'Patient Timing', 'Timely Arrival', 'Season Sense', 'Unforced Pace', 'Ready Moment', 'Aligned Schedule'],
  },
  {
    domain: 'causal',
    category: 'reputation',
    names: ['Good Name', 'Trusted Word', 'Visible Craft', 'Quiet Credibility', 'Honored Promise', 'Clean Reputation', 'Respectful Regard', 'Reliable Presence'],
  },
  {
    domain: 'causal',
    category: 'resources',
    names: ['Enough Supply', 'Tools at Hand', 'Stored Reserve', 'Shared Resource', 'Practical Means', 'Ready Materials', 'Managed Resources', 'Useful Access'],
  },
  {
    domain: 'causal',
    category: 'direction',
    names: ['Chosen Path', 'Clear Direction', 'Next Horizon', 'Guided Step', 'Purposeful Course', 'Aligned Aim', 'Way Forward', 'Settled Direction'],
  },
  {
    domain: 'causal',
    category: 'community',
    names: ['Welcoming Circle', 'Shared Table', 'Neighborly Ease', 'Collective Care', 'Group Concord', 'Civic Ease', 'Common Good', 'Circle Warmth'],
  },
  {
    domain: 'causal',
    category: 'contribution',
    names: ['Offered Help', 'Useful Gift', 'Service Ease', 'Generosity', 'Given Value', 'Shared Skill', 'Quiet Service', 'Meaningful Offer'],
  },
  {
    domain: 'causal',
    category: 'protection',
    names: ['Sheltered Path', 'Practical Safety', 'Covered Risk', 'Firm Threshold', 'Guarded Boundary', 'Steady Shelter', 'Protected Plan', 'Safe Passage'],
  },
  {
    domain: 'causal',
    category: 'legacy',
    names: ['Lasting Work', 'Taught Skill', 'Planted Seed', 'Continued Care', 'Honored Line', 'Built Foundation', 'Kept Record', 'Future Provision'],
  },
  {
    domain: 'causal',
    category: 'exchange',
    names: ['Fair Price', 'Clean Transaction', 'Balanced Trade', 'Willing Buyer', 'Honest Sale', 'Reciprocal Gift'],
  },
  {
    domain: 'causal',
    category: 'durability',
    names: ['Durable Plan', 'Held Course', 'Unshaken Aim', 'Steady Ground', 'Kept Structure', 'Reliable Base'],
  },
]

function keyword(name: string) {
  return name.toLowerCase().split(/\s+/).filter((word) => word.length > 2)
}

function proposedFromGroups(): ProposedConcept[] {
  return GROUPS.flatMap((group) =>
    group.names.map((name, index) => {
      const code = `${PREFIX[group.domain]}-${group.category.toUpperCase()}-${String(index + 1).padStart(3, '0')}`
      return {
        publicCode: code,
        name,
        domain: group.domain,
        category: group.category,
        description: `${name} is a proposed symbolic assumption in the ${group.category} subcategory.`,
        assumptionStatement: `I am established in ${name.toLowerCase()}.`,
        primaryKeywords: keyword(name).slice(0, 4).length > 0 ? keyword(name).slice(0, 4) : [group.category],
        secondaryKeywords: [group.category],
        semanticTags: [group.domain, group.category],
        synonyms: [],
        relatedCodes: [],
        status: 'draft' as const,
        conceptStatus: 'draft' as const,
        definition: `${name} names one ${group.domain} assumption in ${group.category}. It is not an approved image.`,
      }
    }),
  )
}

export function proposedCatalog(): ProposedConcept[] {
  const pilots: ProposedConcept[] = PILOT_SIGILS.map((sigil) => ({
    ...sigil,
    conceptStatus: 'approved_concept',
    definition: sigil.description,
  }))
  return [...pilots, ...proposedFromGroups()]
}

export function catalogCompleteness(entries: ProposedConcept[] = proposedCatalog()) {
  const counts = {
    physical: entries.filter((entry) => entry.domain === 'physical').length,
    emotional: entries.filter((entry) => entry.domain === 'emotional').length,
    mental: entries.filter((entry) => entry.domain === 'mental').length,
    causal: entries.filter((entry) => entry.domain === 'causal').length,
  }
  return {
    approval: CATALOG_APPROVAL,
    total: entries.length,
    counts,
    imageGenerationOpen: false,
  }
}
