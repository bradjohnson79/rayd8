import type { SpeedMode } from './playerTypes'

interface GearboxProps {
  blueLightEnabled: boolean
  circadianEnabled: boolean
  onSelectSpeed: (speedMode: SpeedMode) => void
  onToggleBlueLight: () => void
  onToggleCircadian: () => void
  speedMode: SpeedMode
}

const speedOptions: Array<{ label: string; value: SpeedMode }> = [
  { label: 'Standard', value: 'standard' },
  { label: 'Fast', value: 'fast' },
  { label: 'Super Fast', value: 'superFast' },
  { label: 'Slow', value: 'slow' },
  { label: 'Super Slow', value: 'superSlow' },
]

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={[
        'rounded-2xl border px-4 py-3 text-sm font-medium transition',
        active
          ? 'border-emerald-300/20 bg-emerald-300/15 text-white'
          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10',
      ].join(' ')}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

export function Gearbox({
  blueLightEnabled,
  circadianEnabled,
  onSelectSpeed,
  onToggleBlueLight,
  onToggleCircadian,
  speedMode,
}: GearboxProps) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/20 p-5 backdrop-blur-xl">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Gearbox</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {speedOptions.map((option) => (
              <ToggleButton
                active={option.value === speedMode}
                key={option.value}
                label={option.label}
                onClick={() => onSelectSpeed(option.value)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleButton
            active={blueLightEnabled}
            label="Blue light filter"
            onClick={onToggleBlueLight}
          />
          <ToggleButton
            active={circadianEnabled}
            label="Circadian mode"
            onClick={onToggleCircadian}
          />
        </div>
      </div>
    </section>
  )
}
