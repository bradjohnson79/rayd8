import { RedirectToSignIn, useAuth } from '@clerk/react'
import Hls from 'hls.js'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDefaultPrescription, primePrescriptionSchema, type PrimePrescription } from '../../../../api/src/modules/prime/core/prescription.ts'
import { apiRequest } from '../../services/api'
import { PrimeSpatialAudioEngine } from './audioEngine'
import { AuroraLayer, ChargingBorder, HomunculusStage, PerimeterGlyphs } from './layers/StageChrome'
import { AssumptionFrames } from './layers/AssumptionFrames'
import { CymaticsCanvas } from './layers/CymaticsCanvas'
import { FibonacciCanvas } from './layers/FibonacciCanvas'
import { HexGlyphCanvas } from './layers/HexGlyphCanvas'
import { PrimeLandscapeLock } from './PrimeLandscapeLock'
import { PrimeRuntimeChrome } from './PrimeRuntimeChrome'
import { PrimeControlPanel, type PublishedSigil, type SavedSessionSummary } from './PrimeControlPanel'
import { withStoredFaceFrames, writeStoredFaceFrames } from './faceFrames'
import { isPrimeClientEnabled } from './primeFlag'
import { useSessionClock } from './useSessionClock'

function devElapsedMs() {
  if (!isPrimeClientEnabled() || import.meta.env.PROD) {
    return null
  }
  const raw = new URLSearchParams(window.location.search).get('primeElapsed')
  if (raw === null) {
    return null
  }
  const seconds = Number(raw)
  return Number.isFinite(seconds) ? seconds * 1000 : null
}

function formatClock(elapsedMs: number) {
  const total = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function PrimeSessionPage() {
  const navigate = useNavigate()
  const adminPreview = useLocation().pathname === '/admin/prime'
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const clock = useSessionClock(devElapsedMs())
  const audio = useRef<PrimeSpatialAudioEngine | null>(null)
  const music = useRef<Hls | null>(null)
  const initial = useMemo(() => withStoredFaceFrames(createDefaultPrescription()), [])
  const [applied, setApplied] = useState<PrimePrescription>(initial)
  const [draft, setDraft] = useState<PrimePrescription>(initial)
  const [faceUrl, setFaceUrl] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [placingFace, setPlacingFace] = useState(false)
  const [notice, setNotice] = useState('Edit the draft, then apply it to the session.')
  const [saved, setSaved] = useState<SavedSessionSummary[]>([])
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const dirty = JSON.stringify(draft) !== JSON.stringify(applied)
  const searchSigils = useCallback(async (query: string, domain: keyof PrimePrescription['playlists']) => {
    const token = await getToken()
    const params = new URLSearchParams({ q: query, domain })
    const result = await apiRequest<{ sigils: PublishedSigil[] }>(`/v1/prime/sigils/selectable?${params}`, { method: 'GET' }, token)
    return result.sigils
  }, [getToken])

  useEffect(() => {
    return () => {
      music.current?.destroy()
      audio.current?.stop()
    }
  }, [])

  useEffect(() => {
    if (clock.running && clock.paused) {
      void audio.current?.suspend()
    }
  }, [clock.paused, clock.running])

  useEffect(() => {
    if (!clock.running || clock.paused || devElapsedMs() !== null) {
      return
    }
    if (clock.elapsed >= applied.durationMinutes * 60_000) {
      music.current?.destroy()
      music.current = null
      audio.current?.stop()
      clock.end()
      setNotice('The session reached its duration.')
    }
  }, [applied.durationMinutes, clock.elapsed, clock.end, clock.paused, clock.running])

  useEffect(() => {
    if (import.meta.env.PROD || !isPrimeClientEnabled()) {
      return
    }
    const publish = () => {
      const engine = audio.current
      ;(window as Window & { __primeCert?: Record<string, unknown> }).__primeCert = {
        state: engine?.state ?? 'closed',
        contextsOpened: engine?.contextsOpened ?? 0,
        musicElements: engine?.musicElementsAttached ?? 0,
        musicPaused: engine?.musicPaused ?? null,
        lastResumeError: engine?.lastResumeError ?? null,
      }
    }
    publish()
    const timer = window.setInterval(publish, 200)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!isSignedIn) {
      return
    }
    void refreshSaved()
  }, [isSignedIn])

  async function refreshSaved() {
    try {
      const token = await getToken()
      const result = await apiRequest<{ sessions: SavedSessionSummary[] }>('/v1/prime/sessions', { method: 'GET' }, token)
      setSaved(result.sessions)
    } catch {
      setSaved([])
    }
  }

  if (!isPrimeClientEnabled() && !adminPreview) {
    return <Navigate replace to="/" />
  }

  if (!isLoaded) {
    return <div className="min-h-screen bg-[#070b10]" />
  }

  if (!isSignedIn) {
    return <RedirectToSignIn redirectUrl="/prime" />
  }

  async function attachAllowlistedMusic(engine: PrimeSpatialAudioEngine) {
    const token = await getToken()
    const playback = await apiRequest<{ signed_url?: string }>('/v1/prime/music-token', { method: 'GET' }, token)
    if (!playback.signed_url) {
      throw new Error('Allowlisted music is unavailable.')
    }
    const element = new Audio()
    element.crossOrigin = 'anonymous'
    music.current?.destroy()
    if (Hls.isSupported()) {
      const stream = new Hls()
      music.current = stream
      stream.loadSource(playback.signed_url)
      stream.attachMedia(element)
    } else {
      element.src = playback.signed_url
    }
    engine.attachMusic(element, applied)
    await element.play()
  }

  async function togglePlayback() {
    if (!clock.running) {
      const engine = audio.current ?? new PrimeSpatialAudioEngine()
      engine.start(applied)
      audio.current = engine
      if (applied.audio.audioMode !== 'cymatics') {
        try {
          await attachAllowlistedMusic(engine)
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Allowlisted music did not start.')
          clock.start()
          return
        }
      }
      setNotice(`Audio graph open. Spatial mode ${engine.spatialMode}.`)
      clock.start()
      return
    }
    if (clock.paused) {
      const resumed = await audio.current?.resumePlayback()
      if (!resumed) {
        setNotice(audio.current?.lastResumeError ?? 'Audio resume failed. The session stays paused.')
        return
      }
      clock.resume()
      setNotice(`Audio resumed. Spatial mode ${audio.current?.spatialMode ?? 'stereo'}.`)
      return
    }
    await audio.current?.suspend()
    clock.pause()
    setNotice('Audio suspended with the session clock.')
  }

  async function saveDraft() {
    const parsed = primePrescriptionSchema.safeParse(draft)
    if (!parsed.success) {
      setNotice('The draft is not a valid session. Nothing was saved.')
      return
    }
    try {
      const token = await getToken()
      const savedPrescription = withStoredFaceFrames(parsed.data)
      writeStoredFaceFrames({
        male: savedPrescription.homunculus.faces.male.frame,
        female: savedPrescription.homunculus.faces.female.frame,
      })
      await apiRequest('/v1/prime/sessions', {
        method: 'POST',
        body: JSON.stringify({ name: savedPrescription.sessionName, prescription: savedPrescription }),
      }, token)
      setDraft(savedPrescription)
      setApplied(savedPrescription)
      setNotice('Session saved, including the male and female face frames.')
      await refreshSaved()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Save failed. The draft is unchanged.')
    }
  }

  async function loadSaved(id: string) {
    if (!id) {
      return
    }
    try {
      const token = await getToken()
      const result = await apiRequest<{ prescription: PrimePrescription; warnings: string[] }>(
        `/v1/prime/sessions/${id}`,
        { method: 'GET' },
        token,
      )
      const parsed = primePrescriptionSchema.safeParse(result.prescription)
      if (!parsed.success) {
        setNotice('That saved session could not be read. The current draft is unchanged.')
        return
      }
      setDraft(withStoredFaceFrames(parsed.data))
      setNotice(
        result.warnings.length > 0
          ? `Loaded with missing sigils: ${result.warnings.join(', ')}. Choose replacements before applying.`
          : 'Loaded into the draft. Apply it when you are ready.',
      )
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Load failed. The current draft is unchanged.')
    }
  }

  const figure = placingFace ? draft : applied

  return (
    <PrimeLandscapeLock>
    <div className="relative flex h-full min-h-0 w-full bg-[#070b10] text-white">
      <PrimeControlPanel
        dirty={dirty}
        draft={draft}
        notice={notice}
        onPlacingFace={(placing) => {
          setPlacingFace(placing)
          if (placing) {
            setNotice('Drag the square onto the illustrated face, then save. Switch figures and place the other one too.')
          }
        }}
        onSaveFaceFrame={() => {
          const faces = draft.homunculus.faces
          writeStoredFaceFrames({
            male: faces.male.frame,
            female: faces.female.frame,
          })
          setApplied((current) => ({
            ...current,
            homunculus: {
              ...current.homunculus,
              faces: {
                male: { ...current.homunculus.faces.male, frame: faces.male.frame },
                female: { ...current.homunculus.faces.female, frame: faces.female.frame },
              },
            },
          }))
          const male = faces.male.frame
          const female = faces.female.frame
          setNotice(
            `Face frames saved. Male left ${male.left}%, top ${male.top}%, size ${male.size}%. Female left ${female.left}%, top ${female.top}%, size ${female.size}%.`,
          )
        }}
        placingFace={placingFace}
        onApply={() => {
          const parsed = primePrescriptionSchema.safeParse(draft)
          if (!parsed.success) {
            setNotice('The draft is not valid, so the session was left unchanged.')
            return
          }
          setApplied(parsed.data)
          setNotice('Applied to the session.')
        }}
        onDiscard={() => {
          setDraft(applied)
          setNotice('Draft restored to the applied session.')
        }}
        onDraft={setDraft}
        onFace={setFaceUrl}
        onLoad={(id) => void loadSaved(id)}
        onSave={() => void saveDraft()}
        searchSigils={searchSigils}
        onToggle={() => setPanelOpen((open) => !open)}
        open={panelOpen}
        saved={saved}
      />
      <div className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center" style={{ containerType: 'size' }}>
        <main
          className="relative overflow-hidden"
          data-aspect="16/9"
          data-testid="prime-stage"
          style={{ aspectRatio: '16 / 9', containerType: 'size', width: 'min(100cqw, calc(100cqh * 16 / 9))' }}
        >
        <AuroraLayer enabled={applied.aurora.enabled} reducedMotion={reducedMotion} />
        <HexGlyphCanvas elapsedMs={clock.elapsed} prescription={applied} reducedMotion={reducedMotion} />
        <FibonacciCanvas elapsedMs={clock.elapsed} prescription={applied} reducedMotion={reducedMotion} />
        <CymaticsCanvas prescription={applied} />
        <HomunculusStage
          avatar={figure.homunculus.avatar}
          faceUrl={faceUrl}
          frame={figure.homunculus.faces[figure.homunculus.avatar].frame}
          offsetX={figure.homunculus.offsetX}
          offsetY={figure.homunculus.offsetY}
          onFrame={(frame) => {
            setDraft((current) => {
              const avatar = current.homunculus.avatar
              const nextFace = { ...current.homunculus.faces[avatar], frame }
              return {
                ...current,
                homunculus: {
                  ...current.homunculus,
                  faces: { ...current.homunculus.faces, [avatar]: nextFace },
                },
              }
            })
          }}
          placing={placingFace}
          scale={figure.homunculus.scale}
        />
        <AssumptionFrames
          elapsedMs={clock.elapsed}
          faceFrame={figure.homunculus.faces[figure.homunculus.avatar].frame}
          prescription={applied}
        />
        <PerimeterGlyphs prescription={applied} />
        <ChargingBorder elapsedMs={clock.elapsed} prescription={applied} />
      </main>
      </div>
      <PrimeRuntimeChrome
        elapsedLabel={formatClock(clock.elapsed)}
        onExit={() => {
          music.current?.destroy()
          music.current = null
          audio.current?.stop()
          clock.end()
          navigate('/dashboard')
        }}
        onPatch={(recipe) => {
          const parsed = primePrescriptionSchema.safeParse(recipe)
          if (!parsed.success) {
            return
          }
          setApplied(parsed.data)
          setDraft(parsed.data)
        }}
        onPause={() => void togglePlayback()}
        onPlaceFace={setPlacingFace}
        onResume={() => void togglePlayback()}
        onStart={() => void togglePlayback()}
        onTogglePanel={() => setPanelOpen((open) => !open)}
        paused={clock.paused}
        placingFace={placingFace}
        prescription={applied}
        running={clock.running}
      />
    </div>
    </PrimeLandscapeLock>
  )
}
