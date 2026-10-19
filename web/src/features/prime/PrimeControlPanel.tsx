import { useEffect, useState } from 'react'
import { publishedPilotSigils } from '../../../../api/src/modules/prime/core/catalog.ts'
import { outlinePx } from '../../../../api/src/modules/prime/core/amplification.ts'
import { FREQUENCY_FORMULAS, OUTPUT_PROFILES } from '../../../../api/src/modules/prime/core/audio.ts'
import { ATMOSPHERE_PALETTES, ATMOSPHERE_IDS, SPECTRAL_IDS } from '../../../../api/src/modules/prime/core/palette.ts'
import { createDefaultPrescription, DEFAULT_FACE_FRAMES, type PrimePrescription } from '../../../../api/src/modules/prime/core/prescription.ts'
import { ASSUMPTION_PRESETS } from '../../../../api/src/modules/prime/core/presets.ts'
import { FaceStudio } from './FaceStudio'

const CHANNELS = ['physical', 'emotional', 'mental', 'causal'] as const
const DURATION_PRESETS = [15, 30, 45, 60, 90] as const
const DEMONSTRATION_PRESETS = ['PRESET-VITALITY', 'PRESET-RADIANCE', 'PRESET-MASTERY']

type Channel = (typeof CHANNELS)[number]

export interface SavedSessionSummary {
  id: string
  name: string
  warnings: string[]
}

export interface PublishedSigil {
  publicCode: string
  name: string
  description: string
  domain: string
  category: string
  keywords: string[]
}

function DrawerIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <rect height="16" rx="2" stroke="currentColor" strokeWidth="1.5" width="18" x="3" y="4" />
      <path d={open ? 'M4 5h8v14H4z' : 'M4 5h4.5v14H4z'} fill="currentColor" />
      {open ? null : (
        <path d="M12 9h6M12 12h6M12 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      )}
    </svg>
  )
}

export function PrimeControlPanel({
  open,
  onToggle,
  draft,
  onDraft,
  onApply,
  onDiscard,
  dirty,
  notice,
  onSave,
  saved,
  onLoad,
  onFace,
  placingFace,
  onPlacingFace,
  onSaveFaceFrame,
  searchSigils,
}: {
  open: boolean
  onToggle: () => void
  draft: PrimePrescription
  onDraft: (recipe: PrimePrescription) => void
  onApply: () => void
  onDiscard: () => void
  dirty: boolean
  notice: string
  onSave: () => void
  saved: SavedSessionSummary[]
  onLoad: (id: string) => void
  onFace: (value: string | null) => void
  placingFace: boolean
  onPlacingFace: (placing: boolean) => void
  onSaveFaceFrame: () => void
  searchSigils: (query: string, domain: Channel) => Promise<PublishedSigil[]>
}) {
  return (
    <>
      {open ? (
      <button
        aria-expanded={open}
        aria-label="Hide panel"
        className="absolute left-3 top-3 z-50 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/70 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={onToggle}
        type="button"
      >
        <DrawerIcon open={open} />
      </button>
      ) : null}
      {open ? (
        <aside className="absolute inset-y-0 left-0 z-40 w-[min(100%,22rem)] overflow-y-auto border-r border-white/10 bg-[#070b10]/95 p-4 pt-16 text-sm text-white md:static md:h-full md:shrink-0">
          <h1 className="text-xs uppercase tracking-[0.22em] text-white/60">Prime</h1>
          <p className="mt-2 text-xs text-white/70" role="status">
            {notice}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-full bg-white px-3 py-1 text-xs text-black focus-visible:outline focus-visible:outline-2" disabled={!dirty} onClick={onApply} type="button">
              Apply
            </button>
            <button className="rounded-full bg-white/10 px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2" disabled={!dirty} onClick={onDiscard} type="button">
              Discard
            </button>
            <button className="rounded-full bg-white/10 px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2" onClick={onSave} type="button">
              {notice.startsWith('Session saved') && !dirty ? 'Saved' : 'Save'}
            </button>
          </div>
          <SessionSection draft={draft} onDraft={onDraft} onLoad={onLoad} saved={saved} />
          <HomunculusSection
            draft={draft}
            onDraft={onDraft}
            onFace={onFace}
            onPlacingFace={onPlacingFace}
            onSaveFaceFrame={onSaveFaceFrame}
            placingFace={placingFace}
          />
          <HoneycombSection draft={draft} onDraft={onDraft} />
          <StageMixSection draft={draft} onDraft={onDraft} />
          {CHANNELS.map((channel) => (
            <ChannelSection channel={channel} draft={draft} key={channel} onDraft={onDraft} searchSigils={searchSigils} />
          ))}
        </aside>
      ) : null}
    </>
  )
}

function SessionSection({
  draft,
  onDraft,
  saved,
  onLoad,
}: {
  draft: PrimePrescription
  onDraft: (recipe: PrimePrescription) => void
  saved: SavedSessionSummary[]
  onLoad: (id: string) => void
}) {
  const custom = !DURATION_PRESETS.includes(draft.durationMinutes as (typeof DURATION_PRESETS)[number])
  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-xs uppercase tracking-[0.18em] text-white/60">Session</h2>
      <label className="block text-xs">
        Session name
        <input
          className="mt-1 w-full rounded-xl bg-white/10 p-2"
          maxLength={80}
          onChange={(event) => onDraft({ ...draft, sessionName: event.target.value || 'Prime session' })}
          value={draft.sessionName}
        />
      </label>
      <label className="block text-xs">
        Intention
        <textarea
          className="mt-1 w-full rounded-xl bg-white/10 p-2"
          maxLength={280}
          onChange={(event) => onDraft({ ...draft, intention: event.target.value })}
          value={draft.intention}
        />
      </label>
      <label className="block text-xs">
        Duration
        <select
          className="mt-1 w-full rounded-xl bg-white/10 p-2"
          onChange={(event) => {
            if (event.target.value === 'custom') {
              onDraft({ ...draft, durationMinutes: 20 })
              return
            }
            onDraft({ ...draft, durationMinutes: Number(event.target.value) })
          }}
          value={custom ? 'custom' : String(draft.durationMinutes)}
        >
          {DURATION_PRESETS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>
      {custom ? (
        <label className="block text-xs">
          Custom minutes
          <input
            className="mt-1 w-full rounded-xl bg-white/10 p-2"
            max={120}
            min={5}
            onChange={(event) => onDraft({ ...draft, durationMinutes: Number(event.target.value) })}
            type="number"
            value={draft.durationMinutes}
          />
        </label>
      ) : null}
      <label className="block text-xs">
        Rotation
        <select
          className="mt-1 w-full rounded-xl bg-white/10 p-2"
          onChange={(event) =>
            onDraft({ ...draft, rotationSeconds: Number(event.target.value) as PrimePrescription['rotationSeconds'] })
          }
          value={draft.rotationSeconds}
        >
          {[15, 30, 60, 90].map((seconds) => (
            <option key={seconds} value={seconds}>
              {seconds} seconds
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        Preset
        <select
          className="mt-1 w-full rounded-xl bg-white/10 p-2"
          defaultValue=""
          onChange={(event) => {
            const preset = ASSUMPTION_PRESETS.find((entry) => entry.publicCode === event.target.value)
            if (!preset) {
              return
            }
            const playlists = {
              physical: [...draft.playlists.physical],
              emotional: [...draft.playlists.emotional],
              mental: [...draft.playlists.mental],
              causal: [...draft.playlists.causal],
            }
            for (const code of preset.sigilCodes) {
              const sigil = publishedPilotSigils().find((entry) => entry.publicCode === code)
              if (!sigil) {
                continue
              }
              playlists[sigil.domain] = [
                ...playlists[sigil.domain].filter((item) => item.sigilCode !== code),
                { sigilCode: code, amplification: 4 as const },
              ]
            }
            onDraft({ ...draft, playlists, sessionName: preset.name })
          }}
        >
          <option value="">Choose a preset</option>
          {ASSUMPTION_PRESETS.filter((preset) => DEMONSTRATION_PRESETS.includes(preset.publicCode)).map((preset) => (
            <option key={preset.publicCode} value={preset.publicCode}>
              {preset.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="rounded-full bg-white/10 px-3 py-1 text-xs"
        onClick={() => onDraft({ ...createDefaultPrescription(), homunculus: draft.homunculus })}
        type="button"
      >
        Reset to defaults
      </button>
      <label className="block text-xs">
        Saved sessions
        <select className="mt-1 w-full rounded-xl bg-white/10 p-2" defaultValue="" onChange={(event) => onLoad(event.target.value)}>
          <option value="">Load a saved session</option>
          {saved.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
              {session.warnings.length > 0 ? ' (needs replacement)' : ''}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}

function HomunculusSection({
  draft,
  onDraft,
  onFace,
  placingFace,
  onPlacingFace,
  onSaveFaceFrame,
}: {
  draft: PrimePrescription
  onDraft: (recipe: PrimePrescription) => void
  onFace: (value: string | null) => void
  placingFace: boolean
  onPlacingFace: (placing: boolean) => void
  onSaveFaceFrame: () => void
}) {
  const faces = draft.homunculus.faces ?? {
    male: {
      scale: draft.homunculus.scale,
      offsetX: draft.homunculus.offsetX,
      offsetY: draft.homunculus.offsetY,
      frame: { ...DEFAULT_FACE_FRAMES.male },
    },
    female: {
      scale: draft.homunculus.scale,
      offsetX: draft.homunculus.offsetX,
      offsetY: draft.homunculus.offsetY,
      frame: { ...DEFAULT_FACE_FRAMES.female },
    },
  }
  const face = faces[draft.homunculus.avatar]
  const frameKey = [
    faces.male.frame.left,
    faces.male.frame.top,
    faces.male.frame.size,
    faces.female.frame.left,
    faces.female.frame.top,
    faces.female.frame.size,
  ].join(':')
  const [savedFrameKey, setSavedFrameKey] = useState<string | null>(null)
  const frameSaved = savedFrameKey === frameKey
  function place(patch: Partial<typeof face>) {
    const nextFace = { ...face, ...patch }
    onDraft({
      ...draft,
      homunculus: {
        ...draft.homunculus,
        scale: nextFace.scale,
        offsetX: nextFace.offsetX,
        offsetY: nextFace.offsetY,
        faces: { ...faces, [draft.homunculus.avatar]: nextFace },
      },
    })
  }
  return (
    <section className="mt-6">
      <h2 className="text-xs uppercase tracking-[0.18em] text-white/60">Homunculus</h2>
      <div className="mt-3">
        <FaceStudio
          avatar={draft.homunculus.avatar}
          onAvatar={(avatar) => {
            const nextFace = faces[avatar]
            onDraft({
              ...draft,
              homunculus: {
                ...draft.homunculus,
                avatar,
                scale: nextFace.scale,
                offsetX: nextFace.offsetX,
                offsetY: nextFace.offsetY,
              },
            })
          }}
          onFace={onFace}
        />
      </div>
      <label className="mt-4 flex items-center gap-2 text-xs">
        <input checked={placingFace} onChange={(event) => onPlacingFace(event.target.checked)} type="checkbox" />
        Place face frame
      </label>
      <p className="mt-2 text-xs text-white/60">
        Drag the square onto each illustrated face, then save both frames. The button changes to Saved when the positions are stored.
      </p>
      <p className="mt-2 text-xs tabular-nums text-white/80">
        Male left {faces.male.frame.left}% · top {faces.male.frame.top}% · size {faces.male.frame.size}%
      </p>
      <p className="mt-1 text-xs tabular-nums text-white/80">
        Female left {faces.female.frame.left}% · top {faces.female.frame.top}% · size {faces.female.frame.size}%
      </p>
      <button
        className={`mt-2 rounded-full px-3 py-1 text-xs text-black ${frameSaved ? 'bg-emerald-200' : 'bg-white'}`}
        onClick={() => {
          onSaveFaceFrame()
          setSavedFrameKey(frameKey)
        }}
        type="button"
      >
        {frameSaved ? 'Face frames saved' : 'Save both face frames'}
      </button>
      <label className="mt-3 block text-xs">
        Face scale
        <input
          className="mt-1 w-full"
          max={1.8}
          min={0.6}
          onChange={(event) => place({ scale: Number(event.target.value) })}
          step={0.05}
          type="range"
          value={face.scale}
        />
      </label>
      <label className="mt-3 block text-xs">
        Horizontal
        <input
          className="mt-1 w-full"
          max={40}
          min={-40}
          onChange={(event) => place({ offsetX: Number(event.target.value) })}
          type="range"
          value={face.offsetX}
        />
      </label>
      <label className="mt-3 block text-xs">
        Vertical
        <input
          className="mt-1 w-full"
          max={40}
          min={-40}
          onChange={(event) => place({ offsetY: Number(event.target.value) })}
          type="range"
          value={face.offsetY}
        />
      </label>
    </section>
  )
}

function sequenceValue(palette: readonly string[]) {
  if (palette.length <= 1) {
    return 'single'
  }
  const match = ATMOSPHERE_IDS.find((atmosphere) => {
    const colors = ATMOSPHERE_PALETTES[atmosphere]
    return colors.length === palette.length && colors.every((color, index) => color === palette[index])
  })
  return match ?? 'single'
}

function HoneycombSection({
  draft,
  onDraft,
}: {
  draft: PrimePrescription
  onDraft: (recipe: PrimePrescription) => void
}) {
  const hex = draft.hexGrid
  function update(patch: Partial<PrimePrescription['hexGrid']>) {
    onDraft({ ...draft, hexGrid: { ...hex, ...patch } })
  }
  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-xs uppercase tracking-[0.18em] text-white/60">Honeycomb</h2>
      <label className="block text-xs">
        Hexagon width {Math.round(hex.tileSize)} px
        <input className="mt-1 w-full" max={220} min={40} onChange={(event) => update({ tileSize: Number(event.target.value) })} type="range" value={hex.tileSize} />
      </label>
      <label className="block text-xs">
        Outline color
        <select
          className="mt-1 w-full rounded-xl bg-white/10 p-2"
          onChange={(event) => update({ spectralPalette: [event.target.value as PrimePrescription['hexGrid']['spectralPalette'][number]] })}
          value={hex.spectralPalette[0]}
        >
          {SPECTRAL_IDS.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        Color sequence
        <select
          className="mt-1 w-full rounded-xl bg-white/10 p-2"
          onChange={(event) => {
            if (event.target.value === 'single') {
              update({ spectralPalette: [hex.spectralPalette[0] ?? 'aqua'] })
              return
            }
            const palette = ATMOSPHERE_PALETTES[event.target.value as keyof typeof ATMOSPHERE_PALETTES]
            update({ spectralPalette: [...palette] })
          }}
          value={sequenceValue(hex.spectralPalette)}
        >
          <option value="single">Single color</option>
          {ATMOSPHERE_IDS.map((atmosphere) => (
            <option key={atmosphere} value={atmosphere}>
              {atmosphere}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        Outline thickness {(hex.outlineWidth ?? 1.25).toFixed(2)} px
        <input className="mt-1 w-full" max={4} min={0.5} onChange={(event) => update({ outlineWidth: Number(event.target.value) })} step={0.25} type="range" value={hex.outlineWidth ?? 1.25} />
      </label>
      <label className="block text-xs">
        Outline opacity {Math.round(hex.boundaryOpacity * 100)}%
        <input className="mt-1 w-full" max={1} min={0} onChange={(event) => update({ boundaryOpacity: Number(event.target.value) })} step={0.05} type="range" value={hex.boundaryOpacity} />
      </label>
      <label className="block text-xs">
        Sequence speed {Math.round(hex.colorTransitionSpeed / 1000)}s
        <input className="mt-1 w-full" max={20000} min={400} onChange={(event) => update({ colorTransitionSpeed: Number(event.target.value) })} step={200} type="range" value={hex.colorTransitionSpeed} />
      </label>
      <label className="block text-xs">
        Glyph visibility {Math.round((hex.glyphOpacity ?? 0.92) * 100)}%
        <input className="mt-1 w-full" max={1} min={0} onChange={(event) => update({ glyphOpacity: Number(event.target.value) })} step={0.05} type="range" value={hex.glyphOpacity ?? 0.92} />
      </label>
    </section>
  )
}

function StageMixSection({
  draft,
  onDraft,
}: {
  draft: PrimePrescription
  onDraft: (recipe: PrimePrescription) => void
}) {
  const audio = draft.audio
  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-xs uppercase tracking-[0.18em] text-white/60">Stage and audio</h2>
      <label className="flex items-center gap-2 text-xs">
        <input checked={draft.cymatics.enabled} onChange={(event) => onDraft({ ...draft, cymatics: { ...draft.cymatics, enabled: event.target.checked } })} type="checkbox" />
        Cymatics
      </label>
      <label className="block text-xs">
        Cymatics shape
        <select className="mt-1 w-full rounded-xl bg-white/10 p-2" onChange={(event) => onDraft({ ...draft, cymatics: { ...draft.cymatics, geometry: event.target.value as PrimePrescription['cymatics']['geometry'] } })} value={draft.cymatics.geometry}>
          <option value="square">Square</option>
          <option value="circle">Circle</option>
        </select>
      </label>
      <label className="block text-xs">
        Cymatics opacity {draft.cymatics.opacity.toFixed(2)}
        <input className="mt-1 w-full" max={0.5} min={0.2} onChange={(event) => onDraft({ ...draft, cymatics: { ...draft.cymatics, opacity: Number(event.target.value) } })} step={0.02} type="range" value={draft.cymatics.opacity} />
      </label>
      <label className="block text-xs">
        Audio mode
        <select className="mt-1 w-full rounded-xl bg-white/10 p-2" onChange={(event) => onDraft({ ...draft, audio: { ...audio, audioMode: event.target.value as PrimePrescription['audio']['audioMode'] } })} value={audio.audioMode}>
          <option value="cymatics">Cymatics</option>
          <option value="music">Music</option>
          <option value="both">Cymatics and music</option>
        </select>
      </label>
      <label className="block text-xs">
        Output
        <select className="mt-1 w-full rounded-xl bg-white/10 p-2" onChange={(event) => onDraft({ ...draft, audio: { ...audio, outputProfile: event.target.value as PrimePrescription['audio']['outputProfile'] } })} value={audio.outputProfile}>
          {OUTPUT_PROFILES.map((profile) => (
            <option key={profile} value={profile}>
              {profile}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        Spatial mode
        <select className="mt-1 w-full rounded-xl bg-white/10 p-2" onChange={(event) => onDraft({ ...draft, audio: { ...audio, spatialMode: event.target.value as PrimePrescription['audio']['spatialMode'] } })} value={audio.spatialMode}>
          <option value="stereo">Stereo</option>
          <option value="hrtf">Headphones HRTF</option>
        </select>
      </label>
      <label className="block text-xs">
        Formula
        <select className="mt-1 w-full rounded-xl bg-white/10 p-2" onChange={(event) => onDraft({ ...draft, audio: { ...audio, frequencyFormula: event.target.value as PrimePrescription['audio']['frequencyFormula'] }, cymatics: { ...draft.cymatics, formula: event.target.value as PrimePrescription['cymatics']['formula'] } })} value={audio.frequencyFormula}>
          {FREQUENCY_FORMULAS.map((formula) => (
            <option key={formula} value={formula}>
              {formula}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        Cymatic gain {audio.cymaticGain.toFixed(2)}
        <input className="mt-1 w-full" max={0.35} min={0} onChange={(event) => onDraft({ ...draft, audio: { ...audio, cymaticGain: Number(event.target.value) } })} step={0.01} type="range" value={audio.cymaticGain} />
      </label>
      <label className="block text-xs">
        Music gain {audio.musicGain.toFixed(2)}
        <input className="mt-1 w-full" max={0.35} min={0} onChange={(event) => onDraft({ ...draft, audio: { ...audio, musicGain: Number(event.target.value) } })} step={0.01} type="range" value={audio.musicGain} />
      </label>
      <label className="block text-xs">
        Bass resonance {audio.bassResonance.toFixed(2)}
        <input className="mt-1 w-full" max={0.6} min={0} onChange={(event) => onDraft({ ...draft, audio: { ...audio, bassResonance: Number(event.target.value) } })} step={0.01} type="range" value={audio.bassResonance} />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input checked={draft.fibonacciFlow.enabled} onChange={(event) => onDraft({ ...draft, fibonacciFlow: { ...draft.fibonacciFlow, enabled: event.target.checked } })} type="checkbox" />
        Fibonacci field
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input checked={draft.aurora.enabled} onChange={(event) => onDraft({ ...draft, aurora: { enabled: event.target.checked } })} type="checkbox" />
        Aurora
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input checked={draft.perimeter.enabled} onChange={(event) => onDraft({ ...draft, perimeter: { ...draft.perimeter, enabled: event.target.checked } })} type="checkbox" />
        Perimeter samples
      </label>
      <label className="block text-xs">
        Border color
        <select className="mt-1 w-full rounded-xl bg-white/10 p-2" onChange={(event) => onDraft({ ...draft, border: { ...draft.border, color: event.target.value as PrimePrescription['border']['color'] } })} value={draft.border.color}>
          {SPECTRAL_IDS.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </label>
    </section>
  )
}

function localSigils(channel: Channel, query: string): PublishedSigil[] {
  const needle = query.trim().toLowerCase()
  return publishedPilotSigils()
    .filter((sigil) => sigil.domain === channel)
    .filter((sigil) => {
      if (!needle) {
        return true
      }
      return [sigil.name, sigil.description, sigil.category, ...sigil.primaryKeywords].join(' ').toLowerCase().includes(needle)
    })
    .map((sigil) => ({
      publicCode: sigil.publicCode,
      name: sigil.name,
      description: sigil.description,
      domain: sigil.domain,
      category: sigil.category,
      keywords: sigil.primaryKeywords,
    }))
}

function ChannelSection({
  channel,
  draft,
  onDraft,
  searchSigils,
}: {
  channel: Channel
  draft: PrimePrescription
  onDraft: (recipe: PrimePrescription) => void
  searchSigils: (query: string, domain: Channel) => Promise<PublishedSigil[]>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PublishedSigil[]>(() => localSigils(channel, ''))
  const playlist = draft.playlists[channel]
  const published = publishedPilotSigils()
  const missing = playlist.filter((item) => !published.some((sigil) => sigil.publicCode === item.sigilCode))

  useEffect(() => {
    let current = true
    const timer = window.setTimeout(() => {
      void searchSigils(query, channel)
        .then((sigils) => {
          if (current) {
            setResults(sigils)
          }
        })
        .catch(() => {
          if (current) {
            setResults(localSigils(channel, query))
          }
        })
    }, 150)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [channel, query, searchSigils])

  function update(next: PrimePrescription['playlists'][Channel]) {
    onDraft({ ...draft, playlists: { ...draft.playlists, [channel]: next } })
  }

  return (
    <section className="mt-6">
      <h2 className="text-xs uppercase tracking-[0.18em] text-white/60">
        {channel} ({playlist.length})
      </h2>
      {missing.length > 0 ? (
        <p className="mt-2 text-xs text-amber-200">Missing published sigil: {missing.map((item) => item.sigilCode).join(', ')}. Choose a replacement.</p>
      ) : null}
      <ul className="mt-2 space-y-2">
        {playlist.map((item, index) => (
          <li className="rounded-xl bg-white/5 p-2" key={`${item.sigilCode}-${index}`}>
            <div className="flex items-center gap-2">
              <img alt="" className="h-10 w-10 bg-transparent object-contain" src={`/prime/sigils/${item.sigilCode}.svg`} />
              <p className="text-xs">{published.find((sigil) => sigil.publicCode === item.sigilCode)?.name ?? item.sigilCode}</p>
            </div>
            <label className="mt-1 block text-[10px] text-white/60">
              Amplification {item.amplification} ({outlinePx(item.amplification)} px)
              <input
                className="mt-1 w-full"
                max={8}
                min={1}
                onChange={(event) => {
                  const amplification = Number(event.target.value) as PrimePrescription['playlists'][Channel][number]['amplification']
                  update(playlist.map((entry, entryIndex) => (entryIndex === index ? { ...entry, amplification } : entry)))
                }}
                type="range"
                value={item.amplification}
              />
            </label>
            <div className="mt-1 flex gap-2">
              <button className="text-[10px] uppercase" disabled={index === 0} onClick={() => update(move(playlist, index, -1))} type="button">
                Up
              </button>
              <button
                className="text-[10px] uppercase"
                disabled={index === playlist.length - 1}
                onClick={() => update(move(playlist, index, 1))}
                type="button"
              >
                Down
              </button>
              <button
                className="text-[10px] uppercase"
                disabled={playlist.length === 1}
                onClick={() => update(playlist.filter((_, entryIndex) => entryIndex !== index))}
                type="button"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <label className="mt-2 block text-xs">
        Search published sigils
        <input className="mt-1 w-full rounded-xl bg-white/10 p-2" onChange={(event) => setQuery(event.target.value)} value={query} />
      </label>
      <ul className="mt-2 space-y-1">
        {results.map((sigil) => (
          <li key={sigil.publicCode}>
            <button
              className="w-full rounded-xl bg-white/10 px-2 py-1 text-left text-xs"
              onClick={() => {
                if (playlist.some((item) => item.sigilCode === sigil.publicCode) || playlist.length >= 24) {
                  return
                }
                update([...playlist, { sigilCode: sigil.publicCode, amplification: 4 }])
              }}
              type="button"
            >
              <img alt="" className="mb-1 h-8 w-8 object-contain" src={`/prime/sigils/${sigil.publicCode}.svg`} />
              {sigil.name}
              <span className="block text-[10px] text-white/50">{sigil.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const next = [...items]
  const target = index + direction
  const current = next[index]
  const swap = next[target]
  if (!current || !swap) {
    return items
  }
  next[index] = swap
  next[target] = current
  return next
}
