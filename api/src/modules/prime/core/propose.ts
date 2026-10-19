import { createDefaultPrescription, primePrescriptionSchema, type PrimePrescription } from './prescription.js'
import { retrieveSigils, type RetrievalHit } from './retrieval.js'
import type { PilotSigil } from './catalog.js'

export const PRIME_AGENT_MODEL = 'gpt-5-mini'

export interface PrimeCapabilities {
  fibonacciCycleSeconds: 1216
  rotationSeconds: number[]
  amplification: { min: 1; max: 8 }
  audio: { gainMax: 0.35; bassResonanceMax: 0.6; reverbMax: 0.35; bassFloorHz: 40 }
  durationMinutes: { min: 5; max: 120 }
  appliesSession: false
  publishesSigils: false
  generatesImages: false
}

export const PRIME_CAPABILITIES: PrimeCapabilities = {
  fibonacciCycleSeconds: 1216,
  rotationSeconds: [15, 30, 60, 90],
  amplification: { min: 1, max: 8 },
  audio: { gainMax: 0.35, bassResonanceMax: 0.6, reverbMax: 0.35, bassFloorHz: 40 },
  durationMinutes: { min: 5, max: 120 },
  appliesSession: false,
  publishesSigils: false,
  generatesImages: false,
}

export interface ProposalDraft {
  title?: string
  explanation?: string
  durationMinutes?: number
  rotationSeconds?: number
  playlists?: PrimePrescription['playlists']
  musicId?: string | null
}

export interface PrimeProposal {
  model: typeof PRIME_AGENT_MODEL | null
  liveCall: false | 'recorded-separately'
  applied: false
  explanation: string
  gaps: string[]
  proposal: PrimePrescription | null
  selectedMusicId: string | null
  tools: {
    published: RetrievalHit[]
    capabilities: PrimeCapabilities
    musicIds: string[]
  }
}

function publishedOnly(catalog: PilotSigil[]) {
  return catalog.filter((sigil) => sigil.status === 'published')
}

export function searchPublishedSigils(catalog: PilotSigil[], intention: string) {
  return retrieveSigils(publishedOnly(catalog), {
    intention,
    threshold: 0.1,
    limits: { physical: 2, emotional: 2, mental: 2, causal: 2 },
  }).filter((hit) => hit.status === 'published')
}

export function listApprovedMusic(musicIds: readonly string[]) {
  return [...musicIds]
}

function clampAmp(value: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  const rounded = Math.min(8, Math.max(1, Math.round(value)))
  return rounded as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
}

export function proposeFromTools(input: {
  intention: string
  catalog: PilotSigil[]
  musicIds: readonly string[]
  draft?: ProposalDraft | null
  modelUsed?: boolean
}): PrimeProposal {
  const published = searchPublishedSigils(input.catalog, input.intention)
  const allowed = new Set(published.map((hit) => hit.publicCode))
  const musicIds = listApprovedMusic(input.musicIds)
  const gaps: string[] = []
  const base = createDefaultPrescription()
  const playlists = {
    physical: [] as PrimePrescription['playlists']['physical'],
    emotional: [] as PrimePrescription['playlists']['emotional'],
    mental: [] as PrimePrescription['playlists']['mental'],
    causal: [] as PrimePrescription['playlists']['causal'],
  }

  const requested = input.draft?.playlists
  for (const domain of ['physical', 'emotional', 'mental', 'causal'] as const) {
    const fromDraft = requested?.[domain] ?? []
    const kept = fromDraft.filter((item) => {
      if (allowed.has(item.sigilCode)) {
        return true
      }
      gaps.push(`${item.sigilCode} is not a published sigil.`)
      return false
    })
    if (kept.length > 0) {
      playlists[domain] = kept.map((item) => ({ sigilCode: item.sigilCode, amplification: clampAmp(item.amplification) }))
      continue
    }
    const hits = published.filter((hit) => hit.domain === domain)
    if (hits.length === 0) {
      gaps.push(`No published ${domain} sigil matched this intention. The proposal keeps the current published default.`)
      playlists[domain] = base.playlists[domain]
      continue
    }
    playlists[domain] = hits.map((hit) => ({ sigilCode: hit.publicCode, amplification: 4 as const }))
  }

  const musicId = input.draft?.musicId && musicIds.includes(input.draft.musicId) ? input.draft.musicId : null
  if (input.draft?.musicId && !musicId) {
    gaps.push('The requested music id is not on the approved list.')
  }
  const rotation = input.draft?.rotationSeconds
  const rotationSeconds = rotation === 15 || rotation === 30 || rotation === 60 || rotation === 90 ? rotation : base.rotationSeconds

  const candidate = {
    ...base,
    durationMinutes: input.draft?.durationMinutes ?? base.durationMinutes,
    rotationSeconds,
    playlists,
  }
  const parsed = primePrescriptionSchema.safeParse(candidate)
  const explanation =
    input.draft?.explanation?.slice(0, 800) ||
    (gaps.length > 0
      ? `Proposal kept only published matches. ${gaps.join(' ')}`
      : `Proposal for “${input.intention.slice(0, 160)}” uses published sigils only and does not start a session.`)

  return {
    model: input.modelUsed ? PRIME_AGENT_MODEL : null,
    liveCall: false,
    applied: false,
    explanation,
    gaps,
    proposal: parsed.success ? parsed.data : null,
    selectedMusicId: musicId,
    tools: { published, capabilities: PRIME_CAPABILITIES, musicIds },
  }
}

const recentByUser = new Map<string, number[]>()

export function allowProposalRequest(userId: string, now = Date.now(), limit = 10) {
  const windowStart = now - 60_000
  const recent = (recentByUser.get(userId) ?? []).filter((stamp) => stamp > windowStart)
  if (recent.length >= limit) {
    recentByUser.set(userId, recent)
    return false
  }
  recent.push(now)
  recentByUser.set(userId, recent)
  return true
}

export function resetProposalLimits() {
  recentByUser.clear()
}
