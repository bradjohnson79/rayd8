import { useMemo, useState } from 'react'
import { composePrescription, type AgentAnswers } from '../../../../api/src/modules/prime/core/agent.ts'
import type { PrimePrescription } from '../../../../api/src/modules/prime/core/prescription.ts'

export function PrimeAgentPanel({
  onApply,
}: {
  onApply: (prescription: PrimePrescription) => void
}) {
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<AgentAnswers>({
    intention: 'Calm focus, emotional peace, and physical vitality',
    durationMinutes: 15,
    rotationSeconds: 30,
    intensity: 4,
    cymatics: true,
    audioMode: 'cymatics',
  })
  const preview = useMemo(() => composePrescription(answers), [answers])

  return (
    <aside className={`absolute right-4 top-4 z-40 w-[min(100%-2rem,320px)] rounded-3xl border border-white/15 bg-black/55 p-4 text-white backdrop-blur ${open ? '' : 'w-auto'}`}>
      <button className="text-xs uppercase tracking-[0.2em]" onClick={() => setOpen((value) => !value)} type="button">
        {open ? 'Close agent' : 'Prime Agent'}
      </button>
      {open ? (
        <form
          className="mt-3 space-y-2 text-sm"
          onSubmit={(event) => {
            event.preventDefault()
            if (preview.prescription) {
              onApply(preview.prescription)
            }
          }}
        >
          <label className="block text-xs text-white/70">
            Intention
            <textarea
              className="mt-1 w-full rounded-xl bg-white/10 p-2"
              onChange={(event) => setAnswers((current) => ({ ...current, intention: event.target.value }))}
              value={answers.intention}
            />
          </label>
          <p className="text-xs text-white/60">
            {preview.missing.length > 0
              ? `Missing a published match for ${preview.missing.join(', ')}. Those frames keep the current manual playlist.`
              : 'Every domain has a published match.'}
          </p>
          <button className="rounded-full bg-white px-3 py-1 text-xs text-black" type="submit">
            Apply prescription
          </button>
        </form>
      ) : null}
    </aside>
  )
}
