import { PILOT_SIGILS, type PilotSigil } from './catalog.js'
import { createDefaultPrescription, primePrescriptionSchema, type PrimePrescription } from './prescription.js'
import { retrieveSigils } from './retrieval.js'

export interface AgentAnswers {
  intention: string
  durationMinutes: number
  rotationSeconds: 15 | 30 | 60 | 90
  intensity: number
  cymatics: boolean
  audioMode: PrimePrescription['audio']['audioMode']
}

export interface AgentComposeResult {
  prescription: PrimePrescription | null
  missing: string[]
  selections: ReturnType<typeof retrieveSigils>
}

export function composePrescription(answers: AgentAnswers, catalog: PilotSigil[] = PILOT_SIGILS): AgentComposeResult {
  const base = createDefaultPrescription()
  const selections = retrieveSigils(catalog, {
    intention: answers.intention,
    threshold: 0.2,
    limits: { physical: 2, emotional: 2, mental: 2, causal: 2 },
  })

  const missing: string[] = []
  const playlists = { ...base.playlists }

  for (const domain of ['physical', 'emotional', 'mental', 'causal'] as const) {
    const chosen = selections.filter((hit) => hit.domain === domain)
    if (chosen.length === 0) {
      missing.push(domain)
      continue
    }

    playlists[domain] = chosen.map((hit) => ({
      sigilCode: hit.publicCode,
      amplification: Math.min(8, Math.max(1, Math.round(answers.intensity))) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    }))
  }

  const candidate = {
    ...base,
    durationMinutes: answers.durationMinutes,
    rotationSeconds: answers.rotationSeconds,
    playlists,
    cymatics: { ...base.cymatics, enabled: answers.cymatics },
    audio: {
      ...base.audio,
      audioMode: answers.audioMode,
      frequencyFormula: base.cymatics.formula,
    },
  }

  const parsed = primePrescriptionSchema.safeParse(candidate)
  if (!parsed.success || missing.length === 4) {
    return { prescription: null, missing, selections }
  }

  return { prescription: parsed.data, missing, selections }
}
