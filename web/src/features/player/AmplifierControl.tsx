import type { AmplifierMode } from './playerTypes'

interface AmplifierControlProps {
  amplifierMenuOpen: boolean
  amplifierMode: AmplifierMode
  onSelect: (mode: AmplifierMode) => void
  onToggleMenu: (open: boolean) => void
}

const amplifierOptions: Array<{
  label: string
  value: AmplifierMode
  colorClass: string
}> = [
  { label: 'Off', value: 'off', colorClass: 'bg-white/10' },
  { label: '5x', value: '5x', colorClass: 'bg-orange-400' },
  { label: '10x', value: '10x', colorClass: 'bg-green-400' },
  { label: '20x', value: '20x', colorClass: 'bg-blue-400' },
]

export function AmplifierControl({
  amplifierMenuOpen,
  amplifierMode,
  onSelect,
  onToggleMenu,
}: AmplifierControlProps) {
  const activeOption =
    amplifierOptions.find((option) => option.value === amplifierMode) ?? amplifierOptions[0]

  return (
    <div className="relative">
      {amplifierMenuOpen ? (
        <button
          aria-label="Close amplifier menu"
          className="fixed inset-0 z-10"
          onClick={() => onToggleMenu(false)}
          type="button"
        />
      ) : null}

      <div className="relative z-20">
        {amplifierMenuOpen ? (
          <div className="absolute bottom-[calc(100%+0.75rem)] right-0 flex w-48 flex-col gap-2 rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl">
            {amplifierOptions.map((option) => (
              <button
                className={[
                  'flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition',
                  option.value === amplifierMode
                    ? 'bg-white/10 text-white'
                    : 'text-slate-200 hover:bg-white/5',
                ].join(' ')}
                key={option.value}
                onClick={() => onSelect(option.value)}
                type="button"
              >
                <span>{option.label}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${option.colorClass}`} />
              </button>
            ))}
          </div>
        ) : null}

        <button
          className="flex min-h-14 w-full min-w-44 items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          onClick={() => onToggleMenu(!amplifierMenuOpen)}
          type="button"
        >
          <span>Amplifier</span>
          <span className="flex items-center gap-2">
            {activeOption.label}
            <span className={`h-2.5 w-2.5 rounded-full ${activeOption.colorClass}`} />
          </span>
        </button>
      </div>
    </div>
  )
}
