import type { AmplifierMode } from './playerTypes'

interface OverlayLayerProps {
  amplifierMode: AmplifierMode
  blueLightEnabled: boolean
  circadianEnabled: boolean
  nightModeEnabled?: boolean
}

const amplifierColors: Record<AmplifierMode, string> = {
  off: 'transparent',
  '5x': 'rgba(251, 146, 60, 0.85)',
  '10x': 'rgba(74, 222, 128, 0.85)',
  '20x': 'rgba(96, 165, 250, 0.85)',
}

export function OverlayLayer({
  amplifierMode,
  blueLightEnabled,
  circadianEnabled,
  nightModeEnabled = false,
}: OverlayLayerProps) {
  const overlayTone = [
    blueLightEnabled ? 'bg-[rgba(14,38,78,0.16)]' : '',
    circadianEnabled ? 'bg-[rgba(120,86,42,0.12)]' : '',
    nightModeEnabled ? 'bg-[rgba(0,0,0,0.5)]' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const edgeColor = amplifierColors[amplifierMode]

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className={`absolute inset-0 ${overlayTone}`} />

      <div
        className="absolute left-0 top-0 h-[3%] w-full"
        style={{
          background:
            amplifierMode === 'off'
              ? 'transparent'
              : `linear-gradient(to bottom, ${edgeColor}, transparent)`,
        }}
      />
      <div
        className="absolute bottom-0 left-0 h-[3%] w-full"
        style={{
          background:
            amplifierMode === 'off'
              ? 'transparent'
              : `linear-gradient(to top, ${edgeColor}, transparent)`,
        }}
      />
      <div
        className="absolute left-0 top-0 h-full w-[3%]"
        style={{
          background:
            amplifierMode === 'off'
              ? 'transparent'
              : `linear-gradient(to right, ${edgeColor}, transparent)`,
        }}
      />
      <div
        className="absolute right-0 top-0 h-full w-[3%]"
        style={{
          background:
            amplifierMode === 'off'
              ? 'transparent'
              : `linear-gradient(to left, ${edgeColor}, transparent)`,
        }}
      />
    </div>
  )
}
