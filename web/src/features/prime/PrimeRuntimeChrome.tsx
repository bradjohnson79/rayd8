import { useEffect, useRef, useState } from 'react'
import { ATMOSPHERE_IDS, ATMOSPHERE_PALETTES } from '../../../../api/src/modules/prime/core/palette.ts'
import type { PrimePrescription } from '../../../../api/src/modules/prime/core/prescription.ts'
import { usePrimeViewer } from './PrimeLandscapeLock'

const IDLE_MS = 2400
const DURATIONS = [15, 30, 45, 60, 90] as const
const ROTATIONS = [15, 30, 60, 90] as const
const AMPS = [1, 2, 3, 4, 5, 6, 7, 8] as const

type Panel = 'speed' | 'filters' | 'duration' | 'amplify' | 'audio' | 'photo' | null

export function PrimeRuntimeChrome({
  elapsedLabel,
  onExit,
  onPatch,
  onPlaceFace,
  onTogglePanel,
  placingFace,
  prescription,
  running,
  paused,
  onStart,
  onPause,
  onResume,
}: {
  elapsedLabel: string
  onExit: () => void
  onPatch: (recipe: PrimePrescription) => void
  onPlaceFace: (placing: boolean) => void
  onTogglePanel: () => void
  placingFace: boolean
  prescription: PrimePrescription
  running: boolean
  paused: boolean
  onStart: () => void
  onPause: () => void
  onResume: () => void
}) {
  const [visible, setVisible] = useState(true)
  const [panel, setPanel] = useState<Panel>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const viewer = usePrimeViewer()
  const hideTimer = useRef<number | null>(null)
  const panelRef = useRef<Panel>(null)
  const runningRef = useRef(running)
  const pausedRef = useRef(paused)
  panelRef.current = panel
  runningRef.current = running
  pausedRef.current = paused

  function show() {
    setVisible(true)
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
    }
    hideTimer.current = window.setTimeout(() => {
      if (!panelRef.current && runningRef.current && !pausedRef.current) {
        setVisible(false)
      }
    }, IDLE_MS)
  }

  useEffect(() => {
    const ping = () => show()
    window.addEventListener('pointermove', ping, { passive: true })
    window.addEventListener('pointerdown', ping, { passive: true })
    window.addEventListener('keydown', ping)
    return () => {
      window.removeEventListener('pointermove', ping)
      window.removeEventListener('pointerdown', ping)
      window.removeEventListener('keydown', ping)
      if (hideTimer.current !== null) {
        window.clearTimeout(hideTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!running || paused || panel) {
      setVisible(true)
      return
    }
    const timer = window.setTimeout(() => {
      if (!panelRef.current && runningRef.current && !pausedRef.current) {
        setVisible(false)
      }
    }, IDLE_MS)
    return () => window.clearTimeout(timer)
  }, [panel, paused, running])

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function togglePanel(next: Panel) {
    setPanel((current) => (current === next ? null : next))
    show()
  }

  const status = !running ? 'Ready' : paused ? `Paused ${elapsedLabel}` : `Running ${elapsedLabel}`

  return (
    <div
      className={`absolute inset-0 z-50 transition-opacity duration-200 ${visible ? '' : 'pointer-events-none opacity-0 [&_*]:pointer-events-none'}`}
      data-testid="prime-runtime-chrome"
    >
      <div className="pointer-events-auto absolute left-1/2 top-[max(12px,env(safe-area-inset-top))] flex w-[min(920px,calc(100%-24px))] -translate-x-1/2 flex-wrap items-center justify-center gap-2">
        <div className="rounded-full border border-white/10 bg-[rgba(3,7,14,0.48)] px-3.5 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-[22px]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/80">
            Prime <span className="ml-2 font-medium normal-case tracking-normal text-white/75">{status}</span>
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-white/10 bg-[rgba(3,7,14,0.48)] p-1 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-[22px]">
          <ChromeButton icon="controls" label="Controls" onClick={onTogglePanel} />
          <ChromeButton
            icon={fullscreen ? 'exit-fullscreen' : 'fullscreen'}
            label={fullscreen ? 'Exit Full' : 'Fullscreen'}
            onClick={() => {
              const root = document.querySelector('[data-prime-orientation]')
              if (!document.fullscreenElement && root instanceof HTMLElement) {
                void root.requestFullscreen()
              } else {
                void document.exitFullscreen()
              }
            }}
          />
          <ChromeButton icon="exit" label="Exit" onClick={onExit} secondary />
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 flex w-[min(920px,calc(100%-24px))] -translate-x-1/2 flex-wrap justify-center gap-1 rounded-2xl border border-white/10 bg-[rgba(3,7,14,0.48)] p-1 shadow-[0_18px_60px_rgba(0,0,0,0.26)] backdrop-blur-[22px]">
        <ChromeButton
          icon={!running || paused ? 'start' : 'pause'}
          label={!running ? 'Start' : paused ? 'Resume' : 'Pause'}
          onClick={() => {
            if (!running) onStart()
            else if (paused) onResume()
            else onPause()
          }}
        />
        <ChromeButton active={panel === 'speed'} icon="speed" label="Speed" onClick={() => togglePanel('speed')} />
        <ChromeButton active={panel === 'filters'} icon="filters" label="Filters" onClick={() => togglePanel('filters')} />
        <ChromeButton active={panel === 'duration'} icon="duration" label="Duration" onClick={() => togglePanel('duration')} />
        <ChromeButton active={panel === 'amplify'} icon="amplify" label="Amplify" onClick={() => togglePanel('amplify')} />
        <ChromeButton active={panel === 'audio'} icon="audio" label="Audio" onClick={() => togglePanel('audio')} />
        <ChromeButton active={panel === 'photo'} icon="photo" label="Photo" onClick={() => togglePanel('photo')} />
        {viewer.handheld ? (
          <ChromeButton
            active={viewer.flipped}
            icon="rotate"
            label="Rotate"
            onClick={() => {
              viewer.toggleFlip()
              show()
            }}
          />
        ) : null}
      </div>

      {panel ? (
        <div className="pointer-events-auto absolute bottom-[calc(max(18px,env(safe-area-inset-bottom))+76px)] right-[max(18px,env(safe-area-inset-right))] w-[min(360px,calc(100%-36px))] rounded-3xl border border-white/12 bg-[rgba(3,7,14,0.72)] p-3.5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-[24px]">
          {panel === 'speed' ? (
            <OptionGrid
              title="Rotation"
              options={ROTATIONS.map((seconds) => ({
                active: prescription.rotationSeconds === seconds,
                label: `${seconds}s`,
                onClick: () => onPatch({ ...prescription, rotationSeconds: seconds }),
              }))}
            />
          ) : null}
          {panel === 'filters' ? (
            <OptionGrid
              title="Filters"
              options={ATMOSPHERE_IDS.map((id) => ({
                active: prescription.hexGrid.spectralPalette.join() === ATMOSPHERE_PALETTES[id].join(),
                label: id,
                onClick: () =>
                  onPatch({
                    ...prescription,
                    hexGrid: { ...prescription.hexGrid, spectralPalette: [...ATMOSPHERE_PALETTES[id]] },
                  }),
              }))}
            />
          ) : null}
          {panel === 'duration' ? (
            <OptionGrid
              title="Session Duration"
              options={DURATIONS.map((minutes) => ({
                active: prescription.durationMinutes === minutes,
                label: `${minutes}m`,
                onClick: () => onPatch({ ...prescription, durationMinutes: minutes }),
              }))}
            />
          ) : null}
          {panel === 'amplify' ? (
            <OptionGrid
              title="Amplification"
              options={AMPS.map((level) => ({
                active: Object.values(prescription.playlists).every((playlist) => playlist.every((item) => item.amplification === level)),
                label: String(level),
                onClick: () =>
                  onPatch({
                    ...prescription,
                    playlists: {
                      physical: prescription.playlists.physical.map((item) => ({ ...item, amplification: level })),
                      emotional: prescription.playlists.emotional.map((item) => ({ ...item, amplification: level })),
                      mental: prescription.playlists.mental.map((item) => ({ ...item, amplification: level })),
                      causal: prescription.playlists.causal.map((item) => ({ ...item, amplification: level })),
                    },
                  }),
              }))}
            />
          ) : null}
          {panel === 'audio' ? (
            <OptionGrid
              title="Audio"
              options={(['cymatics', 'music', 'both'] as const).map((mode) => ({
                active: prescription.audio.audioMode === mode,
                label: mode,
                onClick: () => onPatch({ ...prescription, audio: { ...prescription.audio, audioMode: mode } }),
              }))}
            />
          ) : null}
          {panel === 'photo' ? (
            <div>
              <p className="mb-3 text-[12px] font-black uppercase tracking-[0.16em] text-white/90">Photo</p>
              <ChromeButton
                icon="photo"
                label={placingFace ? 'Done' : 'Place face'}
                onClick={() => {
                  onPlaceFace(!placingFace)
                  setPanel(null)
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ChromeButton({
  active = false,
  icon,
  label,
  onClick,
  secondary = false,
}: {
  active?: boolean
  icon?: GlyphName
  label: string
  onClick: () => void
  secondary?: boolean
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active || undefined}
      className={`inline-flex items-center justify-center rounded-full border leading-none ${
        icon ? 'h-[22px] w-[22px]' : 'h-[18px] px-1.5 text-[8px] font-bold uppercase tracking-[0.06em]'
      } ${
        active
          ? 'border-[rgba(157,248,255,0.58)] bg-[rgba(157,248,255,0.14)] text-white'
          : 'border-white/15 bg-[rgba(3,7,14,0.48)] text-white'
      } ${secondary ? 'text-white/70' : ''}`}
      onClick={onClick}
      type="button"
    >
      {icon ? <Glyph name={icon} /> : label}
    </button>
  )
}

type GlyphName =
  | 'amplify'
  | 'audio'
  | 'controls'
  | 'duration'
  | 'exit'
  | 'exit-fullscreen'
  | 'filters'
  | 'fullscreen'
  | 'pause'
  | 'photo'
  | 'rotate'
  | 'speed'
  | 'start'

function Glyph({ name }: { name: GlyphName }) {
  const props = {
    'aria-hidden': true as const,
    className: 'h-3.5 w-3.5 shrink-0',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  }
  if (name === 'start') {
    return (
      <svg {...props}>
        <path d="M8 6.5v11l9.5-5.5z" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (name === 'pause') {
    return (
      <svg {...props}>
        <path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (name === 'speed') {
    return (
      <svg {...props}>
        <path d="M5 16a7 7 0 1 1 14 0" />
        <path d="M12 16l4-4" />
      </svg>
    )
  }
  if (name === 'filters') {
    return (
      <svg {...props}>
        <path d="M4 7h16M4 12h16M4 17h16" />
        <circle cx="8" cy="7" fill="currentColor" r="1.6" stroke="none" />
        <circle cx="15" cy="12" fill="currentColor" r="1.6" stroke="none" />
        <circle cx="10" cy="17" fill="currentColor" r="1.6" stroke="none" />
      </svg>
    )
  }
  if (name === 'duration') {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="7" />
        <path d="M12 8.5V12l2.5 2" />
      </svg>
    )
  }
  if (name === 'amplify') {
    return (
      <svg {...props}>
        <path d="M4 10v4h3l4 3V7L7 10H4" />
        <path d="M15 9.5a3.2 3.2 0 0 1 0 5M17.2 7.2a6 6 0 0 1 0 9.6" />
      </svg>
    )
  }
  if (name === 'audio') {
    return (
      <svg {...props}>
        <path d="M9 17V7l9-2v10" />
        <circle cx="7.5" cy="17" r="2" />
        <circle cx="16.5" cy="15" r="2" />
      </svg>
    )
  }
  if (name === 'photo') {
    return (
      <svg {...props}>
        <path d="M5 8h3l1.5-2h5L16 8h3v9H5z" />
        <circle cx="12" cy="12.5" r="2.4" />
      </svg>
    )
  }
  if (name === 'controls') {
    return (
      <svg {...props}>
        <path d="M5 5h5v14H5z" />
        <path d="M13 8h6M13 12h6M13 16h4" />
      </svg>
    )
  }
  if (name === 'fullscreen') {
    return (
      <svg {...props}>
        <path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4" />
      </svg>
    )
  }
  if (name === 'exit-fullscreen') {
    return (
      <svg {...props}>
        <path d="M4 8h4V4M16 4v4h4M20 16h-4v4M8 20v-4H4" />
      </svg>
    )
  }
  if (name === 'exit') {
    return (
      <svg {...props}>
        <path d="M7 7l10 10M17 7L7 17" />
      </svg>
    )
  }
  return (
    <svg {...props}>
      <rect height="14" rx="1.5" width="8" x="7" y="5" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
      <path d="M16.5 8.5h3.2V5.3" />
    </svg>
  )
}

function OptionGrid({
  options,
  title,
}: {
  options: Array<{ active: boolean; label: string; onClick: () => void }>
  title: string
}) {
  return (
    <div>
      <p className="mb-3 text-[12px] font-black uppercase tracking-[0.16em] text-white/90">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ChromeButton active={option.active} key={option.label} label={option.label} onClick={option.onClick} />
        ))}
      </div>
    </div>
  )
}
