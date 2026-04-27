import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import type { SessionType } from '../../app/types'
import { ConfirmModal } from '../../components/ConfirmModal'
import {
  DEFAULT_AMPLIFICATION_LEVEL,
  DEFAULT_FREE_TRIAL_VIDEO_MODE,
  FREE_TRIAL_AUDIO_TRACKS,
  FREE_TRIAL_SESSION_PROMPT_MS,
  FREE_TRIAL_SESSION_TIMEOUT_MS,
  LAST_SESSION_STORAGE_KEY,
  type AmplificationLevel,
  type FreeTrialVideoMode,
  getExperienceFromSessionType,
  getSessionVideoModes,
  type LastSessionConfig,
} from '../../config/rayd8Expansion'
import { resolvePlaybackAsset } from '../../lib/resolvePlaybackAsset'
import { loadHls, type HlsController } from '../../lib/loadHls'
import { getAdminMuxPlaybackToken } from '../../services/admin'
import { getMemberPlaybackToken } from '../../services/player'
import type { ExperienceAccessSummary } from '../../services/player'
import { useAuthToken } from '../dashboard/useAuthToken'
import { useAuthUser } from '../dashboard/useAuthUser'
import { CloseButton } from '../player/CloseButton'
import { OverlayLayer } from '../player/OverlayLayer'
import { useSession } from '../session/SessionProvider'

const defaultSessionConfig: LastSessionConfig = {
  videoMode: DEFAULT_FREE_TRIAL_VIDEO_MODE,
  audioTrack: 'none',
  amplification: DEFAULT_AMPLIFICATION_LEVEL,
}

function readLastSessionConfig(): LastSessionConfig {
  if (typeof window === 'undefined') {
    return defaultSessionConfig
  }

  const rawValue = window.localStorage.getItem(LAST_SESSION_STORAGE_KEY)

  if (!rawValue) {
    return defaultSessionConfig
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<LastSessionConfig>

    return {
      amplification:
        parsed.amplification === '5x' ||
        parsed.amplification === '10x' ||
        parsed.amplification === '20x'
          ? parsed.amplification
          : 'off',
      audioTrack:
        parsed.audioTrack === 'expansion' || parsed.audioTrack === 'premium'
          ? parsed.audioTrack
          : 'none',
      videoMode:
        parsed.videoMode === 'superSlow' ||
        parsed.videoMode === 'slow' ||
        parsed.videoMode === 'fast' ||
        parsed.videoMode === 'superFast'
          ? parsed.videoMode
          : 'standard',
    }
  } catch {
    return defaultSessionConfig
  }
}

function persistLastSessionConfig(nextValue: LastSessionConfig) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(LAST_SESSION_STORAGE_KEY, JSON.stringify(nextValue))
}

function clearTimers(timerIds: Array<number | null>) {
  timerIds.forEach((timerId) => {
    if (timerId !== null) {
      window.clearTimeout(timerId)
    }
  })
}

async function setMediaSource(
  controllerRef: MutableRefObject<HlsController | null>,
  media: HTMLMediaElement | null,
  sourceUrl: string,
){
  if (!media) {
    return
  }

  media.pause()

  if (media.canPlayType('application/vnd.apple.mpegurl')) {
    media.src = sourceUrl
    media.load()
    return
  }

  const Hls = await loadHls()

  if (!Hls.isSupported()) {
    throw new Error('This browser cannot play the current RAYD8® session stream.')
  }

  if (!controllerRef.current) {
    controllerRef.current = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
    })
    controllerRef.current.attachMedia(media)
  }

  controllerRef.current.loadSource(sourceUrl)
}

async function tryPlay(media: HTMLMediaElement | null) {
  if (!media) {
    return false
  }

  try {
    await media.play()
    return true
  } catch {
    return false
  }
}

function resetMedia(media: HTMLMediaElement | null) {
  if (!media) {
    return
  }

  media.pause()
  media.removeAttribute('src')
  media.load()
}

function configureVideoElement(video: HTMLVideoElement | null) {
  if (!video) {
    return
  }

  video.loop = false
  video.defaultMuted = true
  video.muted = true
  video.volume = 0
  video.playsInline = true
  video.preload = 'metadata'
}

interface Rayd8PlayerEngineProps {
  isAdminPreview: boolean
  onClose: () => void
  sessionType: SessionType
}

type ControlPanel = 'mode' | 'audio' | 'volume' | 'amplification' | 'gear' | null
type VideoLayer = 0 | 1

const VIDEO_LOOP_DISSOLVE_MS = 1000
const PLAYER_CHROME_IDLE_MS = 2200
const DEFAULT_BRIGHTNESS_PERCENT = 100

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getPreferredAudioTrack(sessionType: SessionType) {
  return sessionType === 'premium' ? 'premium' : 'expansion'
}

function getPreviewPlanFromPathname(pathname: string) {
  if (pathname.startsWith('/admin/preview/regen')) {
    return 'regen' as const
  }

  if (pathname.startsWith('/admin/preview/free')) {
    return 'free-trial' as const
  }

  return null
}

function formatUsageHours(seconds: number | null) {
  if (seconds === null) {
    return 'Unlimited'
  }

  return (seconds / 3600).toFixed(seconds >= 36_000 ? 0 : 1)
}

function getUsagePillContent(access: ExperienceAccessSummary | null) {
  if (!access?.usage || access.usage.periodType === null || access.limitSeconds === null) {
    return null
  }

  if (access.blockReason === 'regen_total_limit_reached' || access.limitSeconds === 900_000) {
    return {
      label: 'Monthly usage',
      value: `${formatUsageHours(access.usedSeconds)} / ${formatUsageHours(access.limitSeconds)} hrs`,
    }
  }

  return {
    label: 'Preview usage',
    value: `${formatUsageHours(access.usedSeconds)} / ${formatUsageHours(access.limitSeconds)} hrs`,
  }
}

export function Rayd8PlayerEngine({
  isAdminPreview,
  onClose,
  sessionType,
}: Rayd8PlayerEngineProps) {
  const getAuthToken = useAuthToken()
  const user = useAuthUser()
  const {
    audioError,
    audioMuted,
    audioTrack,
    audioVolume,
    experienceAccess,
    isAudioLoading,
    resumeAudioPlayback,
    setAudioMuted,
    setAudioTrack,
    setAudioVolume,
    softDenialState,
    usageWarningState,
  } = useSession()
  const primaryVideoControllerRef = useRef<HlsController | null>(null)
  const secondaryVideoControllerRef = useRef<HlsController | null>(null)
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null)
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null)
  const playerRootRef = useRef<HTMLDivElement | null>(null)
  const brightnessTrackRef = useRef<HTMLDivElement | null>(null)
  const brightnessDraggingRef = useRef(false)
  const controlDockRef = useRef<HTMLDivElement | null>(null)
  const activeVideoLayerRef = useRef<VideoLayer>(0)
  const loopTransitioningRef = useRef(false)
  const currentVideoSourceUrlRef = useRef<string | null>(null)
  const inactivityTimerRef = useRef<number | null>(null)
  const loopTransitionTimerRef = useRef<number | null>(null)
  const chromeHideTimerRef = useRef<number | null>(null)
  const promptTimerRef = useRef<number | null>(null)
  const videoRequestRef = useRef(0)
  const [sessionConfig, setSessionConfig] = useState<LastSessionConfig>(() => readLastSessionConfig())
  const [blueLightEnabled, setBlueLightEnabled] = useState(false)
  const [circadianEnabled, setCircadianEnabled] = useState(false)
  const [nightModeEnabled, setNightModeEnabled] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [interactionRequired, setInteractionRequired] = useState(false)
  const [isVideoLoading, setIsVideoLoading] = useState(true)
  const [activeVideoLayer, setActiveVideoLayer] = useState<VideoLayer>(0)
  const [exitPromptOpen, setExitPromptOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<ControlPanel>(null)
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [sessionPromptOpen, setSessionPromptOpen] = useState(false)
  const [promptCountdownMs, setPromptCountdownMs] = useState(FREE_TRIAL_SESSION_PROMPT_MS)
  const [brightnessPercent, setBrightnessPercent] = useState(DEFAULT_BRIGHTNESS_PERCENT)

  const playbackMode = isAdminPreview ? 'admin' : 'member'
  const experience = useMemo(() => getExperienceFromSessionType(sessionType), [sessionType])
  const playbackPlan = useMemo(
    () =>
      getPreviewPlanFromPathname(
        typeof window === 'undefined' ? '' : window.location.pathname,
      ) ?? user.plan,
    [user.plan],
  )
  const videoModes = useMemo(() => Object.entries(getSessionVideoModes(sessionType)), [sessionType])
  const audioTracks = useMemo(() => Object.entries(FREE_TRIAL_AUDIO_TRACKS), [])
  const currentExperienceAccess = useMemo(
    () => experienceAccess[experience] ?? null,
    [experience, experienceAccess],
  )
  const usagePillContent = useMemo(
    () => getUsagePillContent(currentExperienceAccess),
    [currentExperienceAccess],
  )
  const sessionHeading = useMemo(() => {
    if (sessionType === 'premium') {
      return {
        eyebrow: 'Premium session',
        title: 'RAYD8® Premium',
      }
    }

    if (sessionType === 'regen') {
      return {
        eyebrow: 'REGEN Session Engine',
        title: 'RAYD8® REGEN',
      }
    }

    return {
      eyebrow: 'Expansion session',
      title: 'RAYD8® Expansion',
    }
  }, [sessionType])

  useEffect(() => {
    persistLastSessionConfig({
      ...sessionConfig,
      audioTrack,
    })
  }, [audioTrack, sessionConfig])

  useEffect(() => {
    activeVideoLayerRef.current = activeVideoLayer
  }, [activeVideoLayer])

  useEffect(() => {
    if (!activePanel) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (controlDockRef.current?.contains(event.target as Node)) {
        return
      }

      setActivePanel(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePanel(null)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activePanel])

  const exitBrowserFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  }, [])

  const toggleBrowserFullscreen = useCallback(async () => {
    const playerRoot = playerRootRef.current

    if (!playerRoot) {
      return
    }

    if (document.fullscreenElement === playerRoot) {
      await document.exitFullscreen()
      return
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }

    await playerRoot.requestFullscreen()
  }, [])

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsBrowserFullscreen(document.fullscreenElement === playerRootRef.current)
    }

    document.addEventListener('fullscreenchange', syncFullscreenState)
    syncFullscreenState()

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
    }
  }, [])

  useEffect(() => {
    const handleEscapeFullscreen = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement === playerRootRef.current) {
        void exitBrowserFullscreen()
      }
    }

    window.addEventListener('keydown', handleEscapeFullscreen)

    return () => {
      window.removeEventListener('keydown', handleEscapeFullscreen)
    }
  }, [exitBrowserFullscreen])

  const pingChromeVisibility = useCallback(() => {
    setChromeVisible(true)

    if (chromeHideTimerRef.current !== null) {
      window.clearTimeout(chromeHideTimerRef.current)
    }

    chromeHideTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false)
    }, PLAYER_CHROME_IDLE_MS)
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      pingChromeVisibility()
    })

    const handlePlayerActivity = () => {
      pingChromeVisibility()
    }

    window.addEventListener('mousemove', handlePlayerActivity)
    window.addEventListener('pointerdown', handlePlayerActivity)
    window.addEventListener('keydown', handlePlayerActivity)
    window.addEventListener('touchstart', handlePlayerActivity)
    window.addEventListener('focus', handlePlayerActivity)

    return () => {
      window.cancelAnimationFrame(frameId)
      clearTimers([chromeHideTimerRef.current])
      window.removeEventListener('mousemove', handlePlayerActivity)
      window.removeEventListener('pointerdown', handlePlayerActivity)
      window.removeEventListener('keydown', handlePlayerActivity)
      window.removeEventListener('touchstart', handlePlayerActivity)
      window.removeEventListener('focus', handlePlayerActivity)
    }
  }, [pingChromeVisibility])

  const fetchPlaybackUrl = useCallback(
    async (assetId: string) => {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for RAYD8® playback.')
      }

      const response =
        playbackMode === 'admin'
          ? await getAdminMuxPlaybackToken(assetId, token)
          : await getMemberPlaybackToken(assetId, getExperienceFromSessionType(sessionType), token)

      return response.playback.signed_url
    },
    [getAuthToken, playbackMode, sessionType],
  )

  const getVideoElement = useCallback(
    (layer: VideoLayer) => (layer === 0 ? primaryVideoRef.current : secondaryVideoRef.current),
    [],
  )

  const getVideoControllerRef = useCallback(
    (layer: VideoLayer) =>
      layer === 0 ? primaryVideoControllerRef : secondaryVideoControllerRef,
    [],
  )

  const scheduleInactivityWindow = useCallback(() => {
    clearTimers([inactivityTimerRef.current, promptTimerRef.current])

    inactivityTimerRef.current = window.setTimeout(() => {
      setPromptCountdownMs(FREE_TRIAL_SESSION_PROMPT_MS)
      setSessionPromptOpen(true)
    }, FREE_TRIAL_SESSION_TIMEOUT_MS)
  }, [])

  const startLoopCrossfade = useCallback(async () => {
    const sourceUrl = currentVideoSourceUrlRef.current

    if (!sourceUrl || loopTransitioningRef.current) {
      return
    }

    const currentLayer = activeVideoLayerRef.current
    const nextLayer: VideoLayer = currentLayer === 0 ? 1 : 0
    const nextVideo = getVideoElement(nextLayer)

    if (!nextVideo) {
      return
    }

    loopTransitioningRef.current = true
    configureVideoElement(nextVideo)

    try {
      await setMediaSource(getVideoControllerRef(nextLayer), nextVideo, sourceUrl)

      const started = await tryPlay(nextVideo)

      if (!started) {
        setInteractionRequired(true)
        loopTransitioningRef.current = false
        return
      }

      setActiveVideoLayer(nextLayer)

      if (loopTransitionTimerRef.current !== null) {
        window.clearTimeout(loopTransitionTimerRef.current)
      }

      loopTransitionTimerRef.current = window.setTimeout(() => {
        const previousVideo = getVideoElement(currentLayer)
        resetMedia(previousVideo)
        loopTransitioningRef.current = false
      }, VIDEO_LOOP_DISSOLVE_MS)
    } catch (error) {
      loopTransitioningRef.current = false
      setVideoError(
        error instanceof Error ? error.message : 'Unable to keep the current video loop seamless.',
      )
    }
  }, [getVideoControllerRef, getVideoElement])

  const endSession = useCallback(() => {
    clearTimers([inactivityTimerRef.current, promptTimerRef.current, loopTransitionTimerRef.current])
    loopTransitioningRef.current = false
    setSessionPromptOpen(false)
    resetMedia(primaryVideoRef.current)
    resetMedia(secondaryVideoRef.current)
    onClose()
  }, [onClose])

  const continueSession = useCallback(() => {
    setSessionPromptOpen(false)
    setPromptCountdownMs(FREE_TRIAL_SESSION_PROMPT_MS)
    scheduleInactivityWindow()
  }, [scheduleInactivityWindow])

  useEffect(() => {
    scheduleInactivityWindow()

    const handleActivity = () => {
      if (!sessionPromptOpen) {
        scheduleInactivityWindow()
      }
    }

    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('pointerdown', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('focus', handleActivity)

    return () => {
      clearTimers([inactivityTimerRef.current, promptTimerRef.current])
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('focus', handleActivity)
    }
  }, [scheduleInactivityWindow, sessionPromptOpen])

  useEffect(() => {
    if (!sessionPromptOpen) {
      return
    }

    const promptDeadline = Date.now() + FREE_TRIAL_SESSION_PROMPT_MS

    promptTimerRef.current = window.setTimeout(() => {
      endSession()
    }, FREE_TRIAL_SESSION_PROMPT_MS)

    const intervalId = window.setInterval(() => {
      setPromptCountdownMs(Math.max(0, promptDeadline - Date.now()))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)

      if (promptTimerRef.current !== null) {
        window.clearTimeout(promptTimerRef.current)
      }
    }
  }, [endSession, sessionPromptOpen])

  useEffect(() => {
    let cancelled = false
    const requestId = videoRequestRef.current + 1

    videoRequestRef.current = requestId

    async function syncVideoMode() {
      setIsVideoLoading(true)
      setVideoError(null)

      try {
        const assetId = resolvePlaybackAsset({
          experience,
          plan: playbackPlan,
          speed: sessionConfig.videoMode,
        })
        const sourceUrl = await fetchPlaybackUrl(assetId)

        if (cancelled || requestId !== videoRequestRef.current) {
          return
        }

        const video = primaryVideoRef.current
        const standbyVideo = secondaryVideoRef.current

        if (!video) {
          return
        }

        if (loopTransitionTimerRef.current !== null) {
          window.clearTimeout(loopTransitionTimerRef.current)
        }

        loopTransitioningRef.current = false
        currentVideoSourceUrlRef.current = sourceUrl
        activeVideoLayerRef.current = 0
        setActiveVideoLayer(0)

        configureVideoElement(video)
        configureVideoElement(standbyVideo)
        resetMedia(standbyVideo)

        await setMediaSource(primaryVideoControllerRef, video, sourceUrl)

        const started = await tryPlay(video)

        if (!cancelled) {
          setInteractionRequired(!started)
        }
      } catch (error) {
        if (!cancelled) {
          if (sessionConfig.videoMode !== DEFAULT_FREE_TRIAL_VIDEO_MODE) {
            setSessionConfig((currentValue) => ({
              ...currentValue,
              videoMode: DEFAULT_FREE_TRIAL_VIDEO_MODE,
            }))
            setVideoError('Selected motion state is unavailable right now. Returning to Standard.')
            return
          }

          setVideoError(
            error instanceof Error ? error.message : 'Unable to load the current video mode.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsVideoLoading(false)
        }
      }
    }

    void syncVideoMode()

    return () => {
      cancelled = true
    }
  }, [experience, fetchPlaybackUrl, playbackPlan, sessionConfig.videoMode, sessionType])

  useEffect(() => {
    const activeVideo = getVideoElement(activeVideoLayer)

    if (!activeVideo) {
      return
    }

    const handleTimeUpdate = () => {
      if (loopTransitioningRef.current || isVideoLoading) {
        return
      }

      if (!Number.isFinite(activeVideo.duration) || activeVideo.duration <= 1.2) {
        return
      }

      if (activeVideo.duration - activeVideo.currentTime <= 1.05) {
        void startLoopCrossfade()
      }
    }

    activeVideo.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      activeVideo.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [activeVideoLayer, getVideoElement, isVideoLoading, startLoopCrossfade])

  useEffect(() => {
    const primaryVideoController = primaryVideoControllerRef.current
    const secondaryVideoController = secondaryVideoControllerRef.current
    const primaryVideo = primaryVideoRef.current
    const secondaryVideo = secondaryVideoRef.current

    return () => {
      clearTimers([loopTransitionTimerRef.current])
      primaryVideoController?.destroy()
      secondaryVideoController?.destroy()
      resetMedia(primaryVideo)
      resetMedia(secondaryVideo)
    }
  }, [])

  useEffect(() => {
    if (audioError === 'Tap or press any key to continue the audio layer.') {
      setInteractionRequired(true)
    }
  }, [audioError])

  const handleResumePlayback = useCallback(async () => {
    const visibleVideo = getVideoElement(activeVideoLayerRef.current)
    const standbyVideo = getVideoElement(activeVideoLayerRef.current === 0 ? 1 : 0)
    const videoStarted = await tryPlay(visibleVideo)
    const standbyStarted =
      standbyVideo && standbyVideo.currentSrc ? await tryPlay(standbyVideo) : true
    const audioStarted = audioTrack === 'none' ? true : await resumeAudioPlayback()

    setInteractionRequired(!(videoStarted && standbyStarted && audioStarted))
  }, [audioTrack, getVideoElement, resumeAudioPlayback])

  const setVideoMode = useCallback((videoMode: FreeTrialVideoMode) => {
    setSessionConfig((currentValue) => ({ ...currentValue, videoMode }))
    setActivePanel(null)
  }, [])

  const handleAudioTrackChange = useCallback((nextAudioTrack: keyof typeof FREE_TRIAL_AUDIO_TRACKS) => {
    setAudioTrack(nextAudioTrack)
    setActivePanel(null)
  }, [setAudioTrack])

  const handleMuteToggle = useCallback(() => {
    if (audioTrack === 'none') {
      setAudioTrack(getPreferredAudioTrack(sessionType))
      setAudioMuted(false)
      return
    }

    setAudioMuted(!audioMuted)
  }, [audioMuted, audioTrack, sessionType, setAudioMuted, setAudioTrack])

  const setAmplification = useCallback((amplification: AmplificationLevel) => {
    setSessionConfig((currentValue) => ({ ...currentValue, amplification }))
    setActivePanel(null)
  }, [])

  const audioTrackLabel = FREE_TRIAL_AUDIO_TRACKS[audioTrack].label
  const videoModeLabel = getSessionVideoModes(sessionType)[sessionConfig.videoMode].label
  const amplificationLabel =
    sessionConfig.amplification === 'off' ? 'Off' : sessionConfig.amplification
  const audioIsSilent = audioTrack === 'none' || audioMuted
  const volumeActionLabel =
    audioTrack === 'none' ? 'Enable audio' : audioIsSilent ? 'Unmute' : 'Mute'
  const videoBrightness = brightnessPercent / 100
  const brightnessFillPercent = `${brightnessPercent}%`
  const shouldShowChrome =
    chromeVisible ||
    activePanel !== null ||
    isVideoLoading ||
    interactionRequired ||
    exitPromptOpen ||
    sessionPromptOpen

  const updateBrightnessFromClientY = useCallback((clientY: number) => {
    const track = brightnessTrackRef.current

    if (!track) {
      return
    }

    const rect = track.getBoundingClientRect()
    const offset = rect.bottom - clientY
    const percent = (offset / rect.height) * 100

    setBrightnessPercent(clampPercent(percent))
  }, [])

  const handleBrightnessPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      brightnessDraggingRef.current = true
      updateBrightnessFromClientY(event.clientY)
    },
    [updateBrightnessFromClientY],
  )

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!brightnessDraggingRef.current) {
        return
      }

      updateBrightnessFromClientY(event.clientY)
    }

    const stopDragging = () => {
      brightnessDraggingRef.current = false
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [updateBrightnessFromClientY])

  return (
    <>
      <div
        className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black"
        ref={playerRootRef}
      >
        <video
          className={[
            'absolute inset-0 h-full w-full bg-black object-cover transition-opacity duration-1000 ease-linear',
            activeVideoLayer === 0 ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          muted
          ref={primaryVideoRef}
          style={{ filter: `brightness(${videoBrightness})` }}
        />
        <video
          className={[
            'absolute inset-0 h-full w-full bg-black object-cover transition-opacity duration-1000 ease-linear',
            activeVideoLayer === 1 ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          muted
          ref={secondaryVideoRef}
          style={{ filter: `brightness(${videoBrightness})` }}
        />
        <OverlayLayer
          amplifierMode={sessionConfig.amplification}
          blueLightEnabled={blueLightEnabled}
          circadianEnabled={circadianEnabled}
          nightModeEnabled={nightModeEnabled}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/22 via-black/[0.03] to-black/36" />

        <div
          className={[
            'pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 p-4 transition-opacity duration-500 sm:p-5',
            shouldShowChrome ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <div
            className={[
              'rounded-[1.35rem] border border-white/10 bg-black/30 px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl',
              shouldShowChrome ? 'pointer-events-auto' : 'pointer-events-none',
            ].join(' ')}
          >
            <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/60">
              {sessionHeading.eyebrow}
            </p>
            <p className="mt-1 text-sm font-semibold text-white sm:text-base">{sessionHeading.title}</p>
            {usagePillContent ? (
              <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white/78">
                <span className="uppercase tracking-[0.24em] text-emerald-200/60">
                  {usagePillContent.label}
                </span>
                <span className="ml-2 font-medium text-white">{usagePillContent.value}</span>
              </div>
            ) : null}
          </div>

          <div
            className={[
              'flex items-center gap-2',
              shouldShowChrome ? 'pointer-events-auto' : 'pointer-events-none',
            ].join(' ')}
          >
            <CloseButton onClick={() => setExitPromptOpen(true)} />
          </div>
        </div>

        {interactionRequired ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-6 text-center">
            <div className="max-w-md rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">
                Session focus needed
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Continue the active session
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Your browser needs one direct interaction to resume the current display and sound
                layers.
              </p>
              <button
                className="mt-6 w-full rounded-2xl bg-emerald-300/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30"
                onClick={() => void handleResumePlayback()}
                type="button"
              >
                Resume Session
              </button>
            </div>
          </div>
        ) : null}

        {softDenialState ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-6 text-center">
            <div className="max-w-lg rounded-[2rem] border border-rose-200/20 bg-slate-950/92 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.32em] text-rose-200/70">Session limit reached</p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{softDenialState.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{softDenialState.description}</p>
            </div>
          </div>
        ) : null}

        {usageWarningState && !softDenialState ? (
          <div className="pointer-events-none absolute inset-x-0 top-20 z-30 flex justify-center px-4">
            <div className="max-w-lg rounded-[1.35rem] border border-amber-200/20 bg-slate-950/88 px-4 py-3 text-center shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <p className="text-[10px] uppercase tracking-[0.32em] text-amber-100/70">
                Usage warning
              </p>
              <p className="mt-2 text-sm font-medium text-white">{usageWarningState.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                {usageWarningState.description}
              </p>
            </div>
          </div>
        ) : null}

        <div
          className={[
            'pointer-events-none absolute left-4 top-1/2 z-20 -translate-y-1/2 transition-opacity duration-500 sm:left-5',
            shouldShowChrome ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <div
            className={[
              'flex h-[18rem] w-[4.5rem] flex-col items-center justify-between rounded-[1.6rem] border border-white/10 bg-black/48 px-3 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl',
              shouldShowChrome ? 'pointer-events-auto' : 'pointer-events-none',
            ].join(' ')}
          >
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/60">
                Brightness
              </p>
              <p className="mt-2 text-sm font-medium text-white">{brightnessPercent}%</p>
            </div>

            <div className="flex h-full items-center justify-center py-2">
              <div
                aria-label={`Adjust brightness. Current ${brightnessPercent} percent`}
                className="flex h-40 w-8 cursor-pointer items-center justify-center touch-none"
                onPointerDown={handleBrightnessPointerDown}
                role="slider"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={brightnessPercent}
                tabIndex={0}
              >
                <div
                  className="relative h-full w-2 rounded-full bg-white/12"
                  ref={brightnessTrackRef}
                >
                  <div
                    className="absolute bottom-0 left-0 w-full rounded-full bg-emerald-300"
                    style={{ height: brightnessFillPercent }}
                  />
                  <div
                    className="absolute left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-white/20 bg-white shadow-[0_6px_16px_rgba(0,0,0,0.35)]"
                    style={{ bottom: `calc(${brightnessFillPercent} - 0.5rem)` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={[
            'pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 transition-opacity duration-500 sm:p-5',
            shouldShowChrome ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <div
            className={[
              'mx-auto flex w-full max-w-4xl flex-col items-center gap-3',
              shouldShowChrome ? 'pointer-events-auto' : 'pointer-events-none',
            ].join(' ')}
            ref={controlDockRef}
          >
            {activePanel ? (
              <div className="w-full max-w-[23rem] rounded-[1.5rem] border border-white/10 bg-black/58 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
                {activePanel === 'mode' ? (
                  <FlyoutPanel title="Motion state">
                    <div className="grid gap-2">
                      {videoModes.map(([modeKey, modeValue]) => {
                        const isActive = sessionConfig.videoMode === modeKey

                        return (
                          <FlyoutOptionButton
                            active={isActive}
                            key={modeKey}
                            onClick={() => setVideoMode(modeKey as FreeTrialVideoMode)}
                          >
                            <span>{modeValue.label}</span>
                            {isActive ? <StatusPill label="Active" /> : null}
                          </FlyoutOptionButton>
                        )
                      })}
                    </div>
                  </FlyoutPanel>
                ) : null}

                {activePanel === 'audio' ? (
                  <FlyoutPanel
                    meta={isAudioLoading ? 'Updating sound layer...' : 'Independent from video mode switching'}
                    title="Audio track"
                  >
                    <div className="grid gap-2">
                      {audioTracks.map(([audioKey, audioValue]) => {
                        const isActive = audioTrack === audioKey

                        return (
                          <FlyoutOptionButton
                            active={isActive}
                            key={audioKey}
                            onClick={() =>
                              handleAudioTrackChange(audioKey as keyof typeof FREE_TRIAL_AUDIO_TRACKS)
                            }
                          >
                            <span>{audioValue.label}</span>
                            {isActive ? <StatusPill label="Active" /> : null}
                          </FlyoutOptionButton>
                        )
                      })}
                    </div>
                  </FlyoutPanel>
                ) : null}

                {activePanel === 'volume' ? (
                  <FlyoutPanel
                    meta={audioIsSilent ? 'Muted' : `${Math.round(audioVolume * 100)}%`}
                    title="Volume"
                  >
                    <div className="space-y-3 rounded-[1.15rem] border border-white/10 bg-white/[0.045] px-4 py-4">
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-[0.95rem] border border-white/10 bg-black/20 px-3 text-[11px] font-medium uppercase tracking-[0.24em] text-slate-200 transition hover:bg-white/[0.06]"
                        onClick={handleMuteToggle}
                        type="button"
                      >
                        {volumeActionLabel}
                      </button>
                      <input
                        className="w-full accent-emerald-300"
                        id="rayd8-volume"
                        max="1"
                        min="0"
                        onChange={(event) => setAudioVolume(Number(event.target.value))}
                        step="0.05"
                        type="range"
                        value={audioVolume}
                      />
                    </div>
                  </FlyoutPanel>
                ) : null}

                {activePanel === 'amplification' ? (
                  <FlyoutPanel title="Amplifiers">
                    <div className="grid grid-cols-2 gap-2">
                      {(['off', '5x', '10x', '20x'] as const).map((amplification) => (
                        <FlyoutOptionButton
                          active={sessionConfig.amplification === amplification}
                          key={amplification}
                          onClick={() => setAmplification(amplification)}
                        >
                          <span>{amplification === 'off' ? 'Off' : amplification}</span>
                          {sessionConfig.amplification === amplification ? (
                            <StatusPill label="Active" />
                          ) : null}
                        </FlyoutOptionButton>
                      ))}
                    </div>
                  </FlyoutPanel>
                ) : null}

                {activePanel === 'gear' ? (
                  <FlyoutPanel title="Gearbox">
                    <div className="grid gap-2">
                      {[
                        {
                          checked: blueLightEnabled,
                          label: 'Anti-blue light',
                          onToggle: () => setBlueLightEnabled((currentValue) => !currentValue),
                        },
                        {
                          checked: circadianEnabled,
                          label: 'Circadian rhythm',
                          onToggle: () => setCircadianEnabled((currentValue) => !currentValue),
                        },
                        {
                          checked: nightModeEnabled,
                          label: 'Night mode',
                          onToggle: () => setNightModeEnabled((currentValue) => !currentValue),
                        },
                      ].map((item) => (
                        <FlyoutOptionButton
                          active={item.checked}
                          key={item.label}
                          onClick={item.onToggle}
                        >
                          <span>{item.label}</span>
                          <StatusPill label={item.checked ? 'On' : 'Off'} />
                        </FlyoutOptionButton>
                      ))}
                    </div>
                  </FlyoutPanel>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-[1.6rem] border border-white/10 bg-black/48 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
              <div className="flex items-center gap-2">
                <CompactIconButton
                  active={activePanel === 'mode'}
                  ariaLabel={`Select motion state. Current ${videoModeLabel}`}
                  onClick={() => setActivePanel((currentValue) => (currentValue === 'mode' ? null : 'mode'))}
                  title={videoModeLabel}
                >
                  <MotionIcon />
                </CompactIconButton>
                <CompactIconButton
                  active={activePanel === 'audio'}
                  ariaLabel={`Select audio track. Current ${audioTrackLabel}`}
                  onClick={() => setActivePanel((currentValue) => (currentValue === 'audio' ? null : 'audio'))}
                  title={audioTrackLabel}
                >
                  <AudioTrackIcon />
                </CompactIconButton>
                <CompactIconButton
                  active={activePanel === 'volume'}
                  ariaLabel={`Adjust volume. Current ${audioIsSilent ? 'muted' : `${Math.round(audioVolume * 100)} percent`}`}
                  onClick={() => setActivePanel((currentValue) => (currentValue === 'volume' ? null : 'volume'))}
                  title={audioIsSilent ? 'Muted' : `${Math.round(audioVolume * 100)}%`}
                >
                  <VolumeIcon muted={audioIsSilent} />
                </CompactIconButton>
                <CompactIconButton
                  active={activePanel === 'amplification'}
                  ariaLabel={`Select amplifier strength. Current ${amplificationLabel}`}
                  onClick={() =>
                    setActivePanel((currentValue) =>
                      currentValue === 'amplification' ? null : 'amplification',
                    )
                  }
                  title={`Amplifier ${amplificationLabel}`}
                >
                  <AmplifierIcon />
                </CompactIconButton>
                <CompactIconButton
                  active={activePanel === 'gear'}
                  ariaLabel="Open gearbox settings"
                  onClick={() => setActivePanel((currentValue) => (currentValue === 'gear' ? null : 'gear'))}
                  title="Gearbox"
                >
                  <GearIcon />
                </CompactIconButton>
                <CompactIconButton
                  active={isBrowserFullscreen}
                  ariaLabel={isBrowserFullscreen ? 'Exit browser fullscreen' : 'Enter browser fullscreen'}
                  onClick={() => void toggleBrowserFullscreen()}
                  title={isBrowserFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  <FullscreenIcon active={isBrowserFullscreen} />
                </CompactIconButton>
              </div>
            </div>

            {videoError || audioError ? (
              <div className="w-full max-w-[23rem] rounded-[1.4rem] border border-amber-300/20 bg-slate-950/90 px-4 py-3 text-sm leading-6 text-amber-100">
                {videoError ?? audioError}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmModal
        description="Stay keeps the immersive session active. Exit Session closes the fullscreen player and returns you to the dashboard."
        onPrimary={() => setExitPromptOpen(false)}
        onSecondary={endSession}
        open={exitPromptOpen}
        primaryLabel="Stay Session"
        secondaryLabel="Exit Session"
        title="Leave this session?"
      />

      <ConfirmModal
        description="Continue keeps the session active. End Session stops the display and returns you to the dashboard."
        footer={`Session will end in ${Math.max(1, Math.ceil(promptCountdownMs / 1000))} seconds if no response is received.`}
        onPrimary={continueSession}
        onSecondary={endSession}
        open={sessionPromptOpen}
        primaryLabel="Continue"
        secondaryLabel="End Session"
        title="Your session is still active. Continue?"
      />
    </>
  )
}

function FlyoutPanel({
  children,
  meta,
  title,
}: {
  children: ReactNode
  meta?: string
  title: string
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/60">{title}</p>
        {meta ? <p className="text-[10px] text-slate-400">{meta}</p> : null}
      </div>
      {children}
    </div>
  )
}

function FlyoutOptionButton({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      className={[
        'flex w-full items-center justify-between gap-3 rounded-[1.1rem] border px-3 py-3 text-left text-sm transition',
        active
          ? 'border-emerald-300/30 bg-emerald-300/14 text-white'
          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]',
      ].join(' ')}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

function StatusPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300">
      {label}
    </span>
  )
}

function CompactIconButton({
  active = false,
  ariaLabel,
  children,
  onClick,
  title,
}: {
  active?: boolean
  ariaLabel: string
  children: ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={[
        'inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border transition',
        active
          ? 'border-emerald-300/30 bg-emerald-300/16 text-white'
          : 'border-white/10 bg-white/[0.05] text-slate-200 hover:bg-white/[0.1]',
      ].join(' ')}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

function MotionIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path d="M4 8h16" opacity="0.35" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4 12h10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4 16h13" opacity="0.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="18" cy="12" fill="currentColor" r="2" />
    </svg>
  )
}

function AudioTrackIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 16.5V7.5a1 1 0 0 1 1.45-.9L17 10.75a1 1 0 0 1 0 1.8L8.45 16.9A1 1 0 0 1 7 16.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path d="M5 7v10" opacity="0.45" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M19 8v8" opacity="0.45" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  )
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 14v-4h4l5-4v12l-5-4H4Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      {muted ? (
        <>
          <path d="m17 9 4 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="m21 9-4 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      ) : (
        <>
          <path d="M17 9.5a4 4 0 0 1 0 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M19.5 7a7.5 7.5 0 0 1 0 10" opacity="0.7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      )}
    </svg>
  )
}

function AmplifierIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <rect height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" width="18" x="3" y="5" />
      <rect height="8" opacity="0.45" rx="1.5" stroke="currentColor" strokeWidth="1.5" width="12" x="6" y="8" />
      <path d="M9 12h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 3.5 13.5 6l2.8.4.8 2.7 2.4 1.6-.9 2.6.9 2.6-2.4 1.6-.8 2.7-2.8.4-1.5 2.5-2.5-1.5-2.8-.4-.8-2.7-2.4-1.6.9-2.6-.9-2.6 2.4-1.6.8-2.7L10.5 6 12 3.5Z"
        opacity="0.35"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      {active ? (
        <>
          <path d="M9 5H5v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M15 5h4v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M9 19H5v-4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M15 19h4v-4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      ) : (
        <>
          <path d="M9 3H3v6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M15 3h6v6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M9 21H3v-6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M15 21h6v-6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
        </>
      )}
    </svg>
  )
}
