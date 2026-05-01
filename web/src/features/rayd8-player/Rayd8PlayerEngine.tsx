import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { SessionType } from '../../app/types'
import { ConfirmModal } from '../../components/ConfirmModal'
import { GuideModal } from './GuideModal'
import {
  formatRuntimeClock,
  formatRuntimeLimit,
  formatUsagePercent,
} from '../../lib/formatUsageRuntime'
import {
  DEFAULT_AMPLIFICATION_LEVEL,
  DEFAULT_FREE_TRIAL_VIDEO_MODE,
  FREE_TRIAL_AUDIO_TRACKS,
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
import { trackUmamiEvent } from '../../services/umami'
import { isMobileViewport, isSmallScreen, isTabletViewport } from '../../utils/device'
import {
  AUTH_LOADING_MESSAGE,
  SESSION_RESUME_MESSAGE,
  useAuthReadiness,
} from '../auth/useAuthReadiness'
import { useUpgradeNavigation } from '../auth/useUpgradeNavigation'
import { useTrialStatus } from '../dashboard/useTrialStatus'
import { useAuthUser } from '../dashboard/useAuthUser'
import { CloseButton } from '../player/CloseButton'
import { OverlayLayer } from '../player/OverlayLayer'
import { useSession } from '../session/SessionProvider'

const defaultSessionConfig: LastSessionConfig = {
  videoMode: DEFAULT_FREE_TRIAL_VIDEO_MODE,
  audioTrack: 'none',
  amplification: DEFAULT_AMPLIFICATION_LEVEL,
}
const GUIDE_MODAL_TRANSITION_MS = 220
const UPGRADE_PATH = '/subscription?plan=regen'

function isTrialBlockReason(value: string | null | undefined) {
  return value === 'TRIAL_EXPIRED' || value === 'HOURS_EXCEEDED' || value === 'USAGE_LIMIT_REACHED'
}

function getTrialBlockContent(reason: string) {
  if (reason === 'HOURS_EXCEEDED' || reason === 'USAGE_LIMIT_REACHED') {
    return {
      description: 'Your free trial has ended. Upgrade to continue using RAYD8.',
      title: 'Your free trial has ended',
    }
  }

  return {
    description: 'Your free trial has ended. Upgrade to continue using RAYD8.',
    title: 'Your free trial has ended',
  }
}

function formatTrialStatusMeta(input: { daysRemaining?: number; hoursRemaining?: number }) {
  const parts = [
    typeof input.daysRemaining === 'number'
      ? `${input.daysRemaining} day${input.daysRemaining === 1 ? '' : 's'} left`
      : null,
    typeof input.hoursRemaining === 'number' ? `${input.hoursRemaining.toFixed(1)}h left` : null,
  ].filter(Boolean)

  return parts.join(' • ')
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
  controllerProfileRef: MutableRefObject<string | null>,
  media: HTMLMediaElement | null,
  sourceUrl: string,
  stabilityProfile: PlaybackStabilityProfile,
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

  const profileKey = stabilityProfile.mobileOptimized ? 'mobile' : 'desktop'

  if (controllerRef.current && controllerProfileRef.current !== profileKey) {
    controllerRef.current.destroy()
    controllerRef.current = null
    controllerProfileRef.current = null
  }

  if (!controllerRef.current) {
    controllerRef.current = new Hls({
      capLevelToPlayerSize: true,
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: stabilityProfile.maxBufferLength,
      maxMaxBufferLength: stabilityProfile.maxMaxBufferLength,
      startLevel: stabilityProfile.startLevel,
    })
    controllerProfileRef.current = profileKey
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
  video.preload = 'auto'
}

interface Rayd8PlayerEngineProps {
  isAdminPreview: boolean
  onClose: () => void
  sessionType: SessionType
}

type ControlPanel = 'mode' | 'audio' | 'volume' | 'amplification' | 'gear' | null
type VideoLayer = 0 | 1
type PlaybackState = 'preloading' | 'ready' | 'playing' | 'recovering' | 'interaction-required'

const VIDEO_LOOP_DISSOLVE_MS = 1000
const PLAYER_CHROME_IDLE_MS = 2200
const DEFAULT_BRIGHTNESS_PERCENT = 100
const FREEZE_CHECK_INTERVAL_MS = 1000
const FREEZE_THRESHOLD = 3
const RECOVERY_COOLDOWN_MS = 3000
const MAX_RECOVERY_ATTEMPTS = 5
const FULLSCREEN_EXIT_HINT_MS = 2500
const DOUBLE_TAP_EXIT_WINDOW_MS = 300
const SESSION_CONTINUITY_THRESHOLD_SECONDS = 7200
const SESSION_CONTINUITY_INTERVAL_MS = 1000
const DESKTOP_FULLSCREEN_EXIT_HINT_STORAGE_KEY = 'rayd8_fullscreen_exit_hint_desktop'
const MOBILE_FULLSCREEN_EXIT_HINT_STORAGE_KEY = 'rayd8_fullscreen_exit_hint_mobile'

interface PlaybackStabilityProfile {
  mobileOptimized: boolean
  maxBufferLength: number
  maxMaxBufferLength: number
  startLevel: number
}

function getPlaybackStabilityProfile(mobileOptimized: boolean): PlaybackStabilityProfile {
  if (mobileOptimized) {
    return {
      mobileOptimized: true,
      maxBufferLength: 20,
      maxMaxBufferLength: 40,
      startLevel: 1,
    }
  }

  return {
    mobileOptimized: false,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    startLevel: -1,
  }
}

function isMediaActivelyPlaying(media: HTMLMediaElement | null) {
  return Boolean(media && !media.paused && !media.ended && media.currentSrc)
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getConnectionEffectiveType() {
  if (typeof navigator === 'undefined') {
    return null
  }

  return (
    navigator as Navigator & {
      connection?: {
        effectiveType?: string
      }
    }
  ).connection?.effectiveType ?? null
}

function getStartupBufferThreshold(isMobile: boolean, isTablet: boolean) {
  let threshold = 5

  if (isTablet) {
    threshold = 10
  }

  if (isMobile) {
    threshold = 15
  }

  const connection = getConnectionEffectiveType()

  if (connection === '3g') {
    threshold += 5
  }

  if (connection === '2g') {
    threshold += 10
  }

  return threshold
}

function getBufferedPercent(media: HTMLMediaElement | null) {
  if (!media) {
    return 0
  }

  if (!Number.isFinite(media.duration) || media.duration <= 0) {
    return media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA ? 100 : 0
  }

  if (media.buffered.length === 0) {
    return 0
  }

  const bufferedEnd = media.buffered.end(media.buffered.length - 1)
  return clampPercent((bufferedEnd / media.duration) * 100)
}

async function waitForPlaybackReady(
  media: HTMLMediaElement | null,
  threshold: number,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
) {
  if (!media) {
    return false
  }

  return await new Promise<boolean>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      media.removeEventListener('canplay', handleCanPlay)
      media.removeEventListener('progress', handleProgress)
      media.removeEventListener('loadedmetadata', handleProgress)
      media.removeEventListener('durationchange', handleProgress)
      media.removeEventListener('error', handleError)
      signal?.removeEventListener('abort', handleAbort)
    }

    const finish = (ready: boolean) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resolve(ready)
    }

    const evaluate = (canPlayFired = false) => {
      const bufferedPercent = getBufferedPercent(media)
      onProgress(bufferedPercent)

      const infiniteDurationReady =
        (!Number.isFinite(media.duration) || media.duration === Number.POSITIVE_INFINITY) &&
        media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA

      if (bufferedPercent >= threshold || canPlayFired || infiniteDurationReady) {
        finish(true)
      }
    }

    const handleCanPlay = () => {
      evaluate(true)
    }

    const handleProgress = () => {
      evaluate(false)
    }

    const handleError = () => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      reject(new Error('Unable to prepare the current RAYD8® session stream.'))
    }

    const handleAbort = () => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      resolve(false)
    }

    media.addEventListener('canplay', handleCanPlay)
    media.addEventListener('progress', handleProgress)
    media.addEventListener('loadedmetadata', handleProgress)
    media.addEventListener('durationchange', handleProgress)
    media.addEventListener('error', handleError)
    signal?.addEventListener('abort', handleAbort, { once: true })

    evaluate(false)
  })
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

function getUsagePillContent(access: ExperienceAccessSummary | null) {
  if (!access?.usage || access.usage.periodType === null || access.limitSeconds === null) {
    return null
  }

  if (access.blockReason === 'regen_total_limit_reached' || access.limitSeconds === 900_000) {
    return {
      label: 'Monthly usage',
      value: `${formatRuntimeClock(access.usedSeconds)} / ${formatRuntimeLimit(access.limitSeconds)} (${formatUsagePercent(access.usagePercent)})`,
    }
  }

  return {
    label: 'Preview usage',
    value: `${formatRuntimeClock(access.usedSeconds)} / ${formatRuntimeLimit(access.limitSeconds)} (${formatUsagePercent(access.usagePercent)})`,
  }
}

export function Rayd8PlayerEngine({
  isAdminPreview,
  onClose,
  sessionType,
}: Rayd8PlayerEngineProps) {
  const { getTokenSafe } = useAuthReadiness()
  const navigateToUpgrade = useUpgradeNavigation()
  const user = useAuthUser()
  const trialStatus = useTrialStatus()
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
  const primaryVideoControllerProfileRef = useRef<string | null>(null)
  const secondaryVideoControllerProfileRef = useRef<string | null>(null)
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null)
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null)
  const playerRootRef = useRef<HTMLDivElement | null>(null)
  const brightnessTrackRef = useRef<HTMLDivElement | null>(null)
  const brightnessDraggingRef = useRef(false)
  const controlDockRef = useRef<HTMLDivElement | null>(null)
  const activeVideoLayerRef = useRef<VideoLayer>(0)
  const loopTransitioningRef = useRef(false)
  const currentVideoSourceUrlRef = useRef<string | null>(null)
  const loopTransitionTimerRef = useRef<number | null>(null)
  const chromeHideTimerRef = useRef<number | null>(null)
  const fullscreenHintTimerRef = useRef<number | null>(null)
  const videoRequestRef = useRef(0)
  const freezeCounterRef = useRef(0)
  const lastObservedVideoTimeRef = useRef<number | null>(null)
  const recoveryAttemptsRef = useRef(0)
  const lastRecoveryTimestampRef = useRef(0)
  const previousFullscreenRef = useRef(false)
  const lastFullscreenTapTimestampRef = useRef(0)
  const previousBodyOverflowRef = useRef<string | null>(null)
  const uninterruptedPlaybackSecondsRef = useRef(0)
  const playbackStateRef = useRef<PlaybackState>('preloading')
  const [sessionConfig, setSessionConfig] = useState<LastSessionConfig>(() => readLastSessionConfig())
  const [blueLightEnabled, setBlueLightEnabled] = useState(false)
  const [circadianEnabled, setCircadianEnabled] = useState(false)
  const [nightModeEnabled, setNightModeEnabled] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>('preloading')
  const [preloadPercent, setPreloadPercent] = useState(0)
  const [activeVideoLayer, setActiveVideoLayer] = useState<VideoLayer>(0)
  const [exitPromptOpen, setExitPromptOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<ControlPanel>(null)
  const [manualGuideOpen, setManualGuideOpen] = useState(false)
  const [manualGuideClosing, setManualGuideClosing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showExitHint, setShowExitHint] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [brightnessPercent, setBrightnessPercent] = useState(DEFAULT_BRIGHTNESS_PERCENT)
  const [mobileViewport, setMobileViewport] = useState(() => isMobileViewport())
  const [tabletViewport, setTabletViewport] = useState(() => isTabletViewport())
  const [smallScreenViewport, setSmallScreenViewport] = useState(() => isSmallScreen())

  const playbackMode = isAdminPreview ? 'admin' : 'member'
  const shouldUsePlaybackStability = mobileViewport || tabletViewport
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
  const isFreeTrialUser = user.plan === 'free' && !isAdminPreview
  const trialMetaLabel = useMemo(
    () =>
      formatTrialStatusMeta({
        daysRemaining: trialStatus?.days_remaining,
        hoursRemaining: trialStatus?.hours_remaining,
      }),
    [trialStatus?.days_remaining, trialStatus?.hours_remaining],
  )
  const trialErrorState = useMemo(() => {
    if (!isTrialBlockReason(videoError)) {
      return null
    }

    return getTrialBlockContent(videoError)
  }, [videoError])
  const trialOverlayState = useMemo(() => {
    if (trialErrorState) {
      return trialErrorState
    }

    if (isFreeTrialUser && trialStatus?.allowed === false && trialStatus.reason) {
      return getTrialBlockContent(trialStatus.reason)
    }

    return null
  }, [isFreeTrialUser, trialErrorState, trialStatus])
  const activeSoftDenialState = useMemo(
    () =>
      trialOverlayState
        ? {
            ...trialOverlayState,
            ctaLabel: 'Upgrade Now',
            ctaTo: UPGRADE_PATH,
          }
        : softDenialState,
    [softDenialState, trialOverlayState],
  )
  const shouldBlurForTrialBlock = Boolean(trialOverlayState || softDenialState?.ctaTo)
  const playbackStabilityProfile = useMemo(
    () => getPlaybackStabilityProfile(shouldUsePlaybackStability),
    [shouldUsePlaybackStability],
  )
  const fitMode = mobileViewport || tabletViewport ? 'contain' : 'cover'
  const pseudoFullscreenViewport = mobileViewport || tabletViewport
  const isPseudoFullscreen = isFullscreen && pseudoFullscreenViewport
  const isPreloading = playbackState === 'preloading'
  const isRecovering = playbackState === 'recovering'
  const interactionRequired = playbackState === 'interaction-required'
  const isVideoLoading = isPreloading || isRecovering
  const topChromeInset = smallScreenViewport ? 12 : 16
  const bottomChromeInset = smallScreenViewport ? 20 : 24
  const fullscreenExitHintLabel = pseudoFullscreenViewport
    ? 'Double-tap to exit full screen'
    : 'Press Esc to exit full screen'
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
    playbackStateRef.current = playbackState
  }, [playbackState])

  const showFullscreenExitHint = useCallback((touchLikeFullscreen: boolean) => {
    if (typeof window === 'undefined') {
      return
    }

    const storageKey = touchLikeFullscreen
      ? MOBILE_FULLSCREEN_EXIT_HINT_STORAGE_KEY
      : DESKTOP_FULLSCREEN_EXIT_HINT_STORAGE_KEY

    if (window.localStorage.getItem(storageKey) === 'true') {
      setShowExitHint(false)
      return
    }

    window.localStorage.setItem(storageKey, 'true')
    setShowExitHint(true)

    if (fullscreenHintTimerRef.current !== null) {
      window.clearTimeout(fullscreenHintTimerRef.current)
    }

    fullscreenHintTimerRef.current = window.setTimeout(() => {
      setShowExitHint(false)
      fullscreenHintTimerRef.current = null
    }, FULLSCREEN_EXIT_HINT_MS)
  }, [])

  const resetSessionContinuityTimer = useCallback(() => {
    uninterruptedPlaybackSecondsRef.current = 0
  }, [])

  useEffect(() => {
    const syncViewportFlags = () => {
      setMobileViewport(isMobileViewport())
      setTabletViewport(isTabletViewport())
      setSmallScreenViewport(isSmallScreen())
    }

    syncViewportFlags()
    window.addEventListener('resize', syncViewportFlags)
    window.addEventListener('orientationchange', syncViewportFlags)

    return () => {
      window.removeEventListener('resize', syncViewportFlags)
      window.removeEventListener('orientationchange', syncViewportFlags)
    }
  }, [])

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

  const exitFullscreen = useCallback(async () => {
    if (pseudoFullscreenViewport) {
      setIsFullscreen(false)
      return
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  }, [pseudoFullscreenViewport])

  const handleUpgradeNavigation = useCallback(async () => {
    await exitFullscreen()
    onClose()
    await navigateToUpgrade()
  }, [exitFullscreen, navigateToUpgrade, onClose])

  const openManualGuide = useCallback(() => {
    setActivePanel(null)
    setManualGuideClosing(false)
    setManualGuideOpen(true)
    trackUmamiEvent('guide_opened_manual', { experience })
  }, [experience])

  const closeManualGuide = useCallback(() => {
    setManualGuideClosing(true)
    trackUmamiEvent('guide_closed_manual', { experience })
    window.setTimeout(() => {
      setManualGuideOpen(false)
      setManualGuideClosing(false)
    }, GUIDE_MODAL_TRANSITION_MS)
  }, [experience])

  const toggleFullscreen = useCallback(async () => {
    const playerRoot = playerRootRef.current

    if (!playerRoot) {
      return
    }

    resetSessionContinuityTimer()

    if (pseudoFullscreenViewport) {
      setIsFullscreen((currentValue) => !currentValue)
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
  }, [pseudoFullscreenViewport, resetSessionContinuityTimer])

  useEffect(() => {
    const syncFullscreenState = () => {
      if (pseudoFullscreenViewport) {
        return
      }

      setIsFullscreen(document.fullscreenElement === playerRootRef.current)
    }

    document.addEventListener('fullscreenchange', syncFullscreenState)
    syncFullscreenState()

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState)
    }
  }, [pseudoFullscreenViewport])

  useEffect(() => {
    const handleEscapeFullscreen = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement === playerRootRef.current) {
        void exitFullscreen()
      }
    }

    window.addEventListener('keydown', handleEscapeFullscreen)

    return () => {
      window.removeEventListener('keydown', handleEscapeFullscreen)
    }
  }, [exitFullscreen])

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
    if (!isPseudoFullscreen) {
      if (previousBodyOverflowRef.current !== null) {
        document.body.style.overflow = previousBodyOverflowRef.current
        previousBodyOverflowRef.current = null
      }

      return
    }

    if (previousBodyOverflowRef.current === null) {
      previousBodyOverflowRef.current = document.body.style.overflow
    }

    document.body.style.overflow = 'hidden'

    return () => {
      if (previousBodyOverflowRef.current !== null) {
        document.body.style.overflow = previousBodyOverflowRef.current
        previousBodyOverflowRef.current = null
      }
    }
  }, [isPseudoFullscreen])

  useEffect(() => {
    if (isFullscreen && !previousFullscreenRef.current) {
      pingChromeVisibility()
      showFullscreenExitHint(pseudoFullscreenViewport)
    }

    if (!isFullscreen && previousFullscreenRef.current) {
      setShowExitHint(false)
      lastFullscreenTapTimestampRef.current = 0
    }

    previousFullscreenRef.current = isFullscreen
  }, [isFullscreen, pingChromeVisibility, pseudoFullscreenViewport, showFullscreenExitHint])

  useEffect(() => {
    if (!pseudoFullscreenViewport && isFullscreen && document.fullscreenElement !== playerRootRef.current) {
      setIsFullscreen(false)
    }
  }, [isFullscreen, pseudoFullscreenViewport])

  const handlePseudoFullscreenSurfacePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isPseudoFullscreen || event.pointerType !== 'touch') {
        return
      }

      if (controlDockRef.current?.contains(event.target as Node)) {
        return
      }

      const timestamp = Date.now()

      if (timestamp - lastFullscreenTapTimestampRef.current <= DOUBLE_TAP_EXIT_WINDOW_MS) {
        lastFullscreenTapTimestampRef.current = 0
        void exitFullscreen()
        return
      }

      lastFullscreenTapTimestampRef.current = timestamp
    },
    [exitFullscreen, isPseudoFullscreen],
  )

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      pingChromeVisibility()
    })

    const handlePlayerActivity = () => {
      resetSessionContinuityTimer()
      pingChromeVisibility()
    }

    window.addEventListener('mousemove', handlePlayerActivity)
    window.addEventListener('click', handlePlayerActivity)
    window.addEventListener('pointerdown', handlePlayerActivity)
    window.addEventListener('keydown', handlePlayerActivity)
    window.addEventListener('touchstart', handlePlayerActivity)
    window.addEventListener('focus', handlePlayerActivity)

    return () => {
      window.cancelAnimationFrame(frameId)
      clearTimers([chromeHideTimerRef.current, fullscreenHintTimerRef.current])
      window.removeEventListener('mousemove', handlePlayerActivity)
      window.removeEventListener('click', handlePlayerActivity)
      window.removeEventListener('pointerdown', handlePlayerActivity)
      window.removeEventListener('keydown', handlePlayerActivity)
      window.removeEventListener('touchstart', handlePlayerActivity)
      window.removeEventListener('focus', handlePlayerActivity)
    }
  }, [pingChromeVisibility, resetSessionContinuityTimer])

  const fetchPlaybackUrl = useCallback(
    async (assetId: string) => {
      const tokenResult = await getTokenSafe()

      if (!tokenResult.token) {
        throw new Error(
          tokenResult.error === 'loading' ? AUTH_LOADING_MESSAGE : SESSION_RESUME_MESSAGE,
        )
      }

      const response =
        playbackMode === 'admin'
          ? await getAdminMuxPlaybackToken(assetId, tokenResult.token)
          : await getMemberPlaybackToken(
              assetId,
              getExperienceFromSessionType(sessionType),
              tokenResult.token,
            )

      return response.playback.signed_url
    },
    [getTokenSafe, playbackMode, sessionType],
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

  const getVideoControllerProfileRef = useCallback(
    (layer: VideoLayer) =>
      layer === 0 ? primaryVideoControllerProfileRef : secondaryVideoControllerProfileRef,
    [],
  )

  const triggerSessionContinuityCheck = useCallback(() => {
    const activeVideo = getVideoElement(activeVideoLayerRef.current)
    const standbyVideo = getVideoElement(activeVideoLayerRef.current === 0 ? 1 : 0)

    activeVideo?.pause()
    standbyVideo?.pause()
    resetSessionContinuityTimer()
    setPlaybackState('interaction-required')
    pingChromeVisibility()
  }, [getVideoElement, pingChromeVisibility, resetSessionContinuityTimer])

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
      await setMediaSource(
        getVideoControllerRef(nextLayer),
        getVideoControllerProfileRef(nextLayer),
        nextVideo,
        sourceUrl,
        playbackStabilityProfile,
      )

      const started = await tryPlay(nextVideo)

      if (!started) {
        setPlaybackState('interaction-required')
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
  }, [getVideoControllerProfileRef, getVideoControllerRef, getVideoElement, playbackStabilityProfile])

  const endSession = useCallback(() => {
    clearTimers([loopTransitionTimerRef.current])
    loopTransitioningRef.current = false
    resetSessionContinuityTimer()
    resetMedia(primaryVideoRef.current)
    resetMedia(secondaryVideoRef.current)
    onClose()
  }, [onClose, resetSessionContinuityTimer])

  const recoverPlayback = useCallback(
    async (reason: 'freeze-detected' | 'waiting' | 'stalled') => {
      if (!shouldUsePlaybackStability) {
        return false
      }

      if (
        playbackStateRef.current === 'preloading' ||
        playbackStateRef.current === 'recovering' ||
        playbackStateRef.current === 'interaction-required'
      ) {
        return false
      }

      if (recoveryAttemptsRef.current >= MAX_RECOVERY_ATTEMPTS) {
        console.warn('[RAYD8] Playback recovery limit reached for this session.')
        return false
      }

      if (Date.now() - lastRecoveryTimestampRef.current < RECOVERY_COOLDOWN_MS) {
        return false
      }

      const activeLayer = activeVideoLayerRef.current
      const activeVideo = getVideoElement(activeLayer)
      const activeController = getVideoControllerRef(activeLayer).current

      if (!activeVideo) {
        return false
      }

      if (
        !isMediaActivelyPlaying(activeVideo) ||
        loopTransitioningRef.current ||
        playbackStateRef.current !== 'playing'
      ) {
        return false
      }

      setPlaybackState('recovering')
      recoveryAttemptsRef.current += 1
      freezeCounterRef.current = 0
      lastObservedVideoTimeRef.current = null
      lastRecoveryTimestampRef.current = Date.now()

      const storedTime = Number.isFinite(activeVideo.currentTime) ? activeVideo.currentTime : 0
      const resumeTime = storedTime + 0.1

      console.warn(
        `[RAYD8] Recovering playback after ${reason}. Attempt ${recoveryAttemptsRef.current}/${MAX_RECOVERY_ATTEMPTS}.`,
      )

      try {
        if (activeController && reason === 'freeze-detected') {
          const currentLevel =
            activeController.currentLevel >= 0 ? activeController.currentLevel : activeController.loadLevel

          if (currentLevel > 0) {
            const nextLevel = Math.max(0, currentLevel - 1)
            activeController.currentLevel = nextLevel
            activeController.nextLevel = nextLevel
            console.info(`[RAYD8] Downgrading HLS level from ${currentLevel} to ${nextLevel}.`)
          }
        }

        activeVideo.pause()
        activeController?.stopLoad()
        activeController?.recoverMediaError()
        activeVideo.load()
        activeController?.startLoad(storedTime)

        const seekToResumePoint = () => {
          try {
            const boundedResumeTime =
              Number.isFinite(activeVideo.duration) && activeVideo.duration > 0
                ? Math.min(resumeTime, Math.max(0, activeVideo.duration - 0.25))
                : resumeTime

            activeVideo.currentTime = Math.max(0, boundedResumeTime)
          } catch {
            // Ignore failed seeks while the media pipeline is rehydrating.
          }
        }

        if (activeVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
          seekToResumePoint()
        } else {
          activeVideo.addEventListener('loadedmetadata', seekToResumePoint, { once: true })
        }

        const resumed = await tryPlay(activeVideo)

        if (resumed) {
          setPlaybackState('playing')
          return true
        }

        setPlaybackState('interaction-required')
        return false
      } catch (error) {
        console.warn('[RAYD8] Playback recovery failed.', error)
        setPlaybackState('interaction-required')
        return false
      }
    },
    [getVideoControllerRef, getVideoElement, shouldUsePlaybackStability],
  )

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const activeVideo = getVideoElement(activeVideoLayerRef.current)

      if (
        !activeVideo ||
        loopTransitioningRef.current ||
        playbackStateRef.current !== 'playing' ||
        !isMediaActivelyPlaying(activeVideo)
      ) {
        return
      }

      uninterruptedPlaybackSecondsRef.current += 1

      if (uninterruptedPlaybackSecondsRef.current >= SESSION_CONTINUITY_THRESHOLD_SECONDS) {
        uninterruptedPlaybackSecondsRef.current = 0
        triggerSessionContinuityCheck()
      }
    }, SESSION_CONTINUITY_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [getVideoElement, triggerSessionContinuityCheck])

  useEffect(() => {
    let cancelled = false
    const preloadAbortController = new AbortController()
    const requestId = videoRequestRef.current + 1

    videoRequestRef.current = requestId

    async function syncVideoMode() {
      resetSessionContinuityTimer()
      setPlaybackState('preloading')
      setPreloadPercent(0)
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
        freezeCounterRef.current = 0
        lastObservedVideoTimeRef.current = null
        recoveryAttemptsRef.current = 0

        await setMediaSource(
          primaryVideoControllerRef,
          primaryVideoControllerProfileRef,
          video,
          sourceUrl,
          playbackStabilityProfile,
        )

        const preloadThreshold = getStartupBufferThreshold(mobileViewport, tabletViewport)
        const readyToStart = await waitForPlaybackReady(
          video,
          preloadThreshold,
          setPreloadPercent,
          preloadAbortController.signal,
        )

        if (!readyToStart || cancelled || requestId !== videoRequestRef.current) {
          return
        }

        setPlaybackState('ready')
        const started = await tryPlay(video)

        if (!cancelled) {
          setPreloadPercent(100)
          setPlaybackState(started ? 'playing' : 'interaction-required')
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

          setPlaybackState('ready')
          setVideoError(
            error instanceof Error ? error.message : 'Unable to load the current video mode.',
          )
        }
      } finally {
        if (cancelled && requestId === videoRequestRef.current) {
          setPreloadPercent(0)
        }
      }
    }

    void syncVideoMode()

    return () => {
      cancelled = true
      preloadAbortController.abort()
    }
  }, [
    experience,
    fetchPlaybackUrl,
    mobileViewport,
    playbackPlan,
    playbackStabilityProfile,
    resetSessionContinuityTimer,
    sessionConfig.videoMode,
    sessionType,
    tabletViewport,
  ])

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
    freezeCounterRef.current = 0
    lastObservedVideoTimeRef.current = null
  }, [activeVideoLayer, playbackState])

  useEffect(() => {
    if (!shouldUsePlaybackStability) {
      return
    }

    const intervalId = window.setInterval(() => {
      const activeVideo = getVideoElement(activeVideoLayerRef.current)

      if (!activeVideo) {
        freezeCounterRef.current = 0
        lastObservedVideoTimeRef.current = null
        return
      }

      if (
        !isMediaActivelyPlaying(activeVideo) ||
        loopTransitioningRef.current ||
        playbackStateRef.current !== 'playing'
      ) {
        freezeCounterRef.current = 0
        lastObservedVideoTimeRef.current = activeVideo?.currentTime ?? null
        return
      }

      const currentTime = activeVideo.currentTime
      const previousTime = lastObservedVideoTimeRef.current

      if (previousTime !== null && currentTime === previousTime) {
        freezeCounterRef.current += 1

        if (freezeCounterRef.current >= FREEZE_THRESHOLD) {
          void recoverPlayback('freeze-detected')
        }
      } else {
        freezeCounterRef.current = 0
      }

      lastObservedVideoTimeRef.current = currentTime
    }, FREEZE_CHECK_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [getVideoElement, recoverPlayback, shouldUsePlaybackStability])

  useEffect(() => {
    if (!shouldUsePlaybackStability) {
      return
    }

    const activeVideo = getVideoElement(activeVideoLayer)

    if (!activeVideo) {
      return
    }

    const handleBufferEvent = (event: Event) => {
      if (
        !isMediaActivelyPlaying(activeVideo) ||
        loopTransitioningRef.current ||
        playbackStateRef.current !== 'playing'
      ) {
        return
      }

      console.info(`[RAYD8] Detected ${event.type} on the active video element.`)
      void recoverPlayback(event.type === 'waiting' ? 'waiting' : 'stalled')
    }

    activeVideo.addEventListener('waiting', handleBufferEvent)
    activeVideo.addEventListener('stalled', handleBufferEvent)

    return () => {
      activeVideo.removeEventListener('waiting', handleBufferEvent)
      activeVideo.removeEventListener('stalled', handleBufferEvent)
    }
  }, [activeVideoLayer, getVideoElement, recoverPlayback, shouldUsePlaybackStability])

  useEffect(() => {
    const primaryVideoController = primaryVideoControllerRef.current
    const secondaryVideoController = secondaryVideoControllerRef.current
    const primaryVideo = primaryVideoRef.current
    const secondaryVideo = secondaryVideoRef.current

    return () => {
      clearTimers([loopTransitionTimerRef.current])
      primaryVideoController?.destroy()
      secondaryVideoController?.destroy()
      primaryVideoControllerProfileRef.current = null
      secondaryVideoControllerProfileRef.current = null
      resetMedia(primaryVideo)
      resetMedia(secondaryVideo)
    }
  }, [])

  useEffect(() => {
    if (audioError === 'Tap or press any key to continue the audio layer.') {
      const frameId = window.requestAnimationFrame(() => {
        setPlaybackState('interaction-required')
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [audioError])

  const resumeMediaWithRetry = useCallback(async (media: HTMLMediaElement | null) => {
    const started = await tryPlay(media)

    if (started) {
      return true
    }

    return await tryPlay(media)
  }, [])

  const handleResumePlayback = useCallback(async () => {
    resetSessionContinuityTimer()
    const visibleVideo = getVideoElement(activeVideoLayerRef.current)
    const standbyVideo = getVideoElement(activeVideoLayerRef.current === 0 ? 1 : 0)
    const videoStarted = await resumeMediaWithRetry(visibleVideo)
    const standbyStarted =
      standbyVideo && standbyVideo.currentSrc ? await resumeMediaWithRetry(standbyVideo) : true
    const audioStarted =
      audioTrack === 'none'
        ? true
        : (await resumeAudioPlayback()) || (await resumeAudioPlayback())

    setPlaybackState(videoStarted && standbyStarted && audioStarted ? 'playing' : 'interaction-required')
  }, [audioTrack, getVideoElement, resetSessionContinuityTimer, resumeAudioPlayback, resumeMediaWithRetry])

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
    if (amplification !== 'off' && amplification !== sessionConfig.amplification) {
      trackUmamiEvent('amplifier_used', {
        amplification,
      })
    }

    setSessionConfig((currentValue) => ({ ...currentValue, amplification }))
    setActivePanel(null)
  }, [sessionConfig.amplification])

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
    exitPromptOpen

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
        className={[
          'relative flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black transition-[opacity,transform] duration-300',
          isPseudoFullscreen ? 'touch-manipulation' : '',
        ].join(' ')}
        ref={playerRootRef}
      >
        <div
          className={[
            'absolute inset-0 flex items-center justify-center overflow-hidden bg-black transition-[filter,transform] duration-300',
            shouldBlurForTrialBlock ? 'scale-[1.02] blur-[6px]' : '',
          ].join(' ')}
          onPointerUp={handlePseudoFullscreenSurfacePointerUp}
        >
          <video
            className={[
              'absolute inset-0 h-full w-full bg-black transition-opacity duration-1000 ease-linear',
              fitMode === 'contain' ? 'object-contain' : 'object-cover',
              activeVideoLayer === 0 ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            muted
            ref={primaryVideoRef}
            style={{ filter: `brightness(${videoBrightness})` }}
          />
          <video
            className={[
              'absolute inset-0 h-full w-full bg-black transition-opacity duration-1000 ease-linear',
              fitMode === 'contain' ? 'object-contain' : 'object-cover',
              activeVideoLayer === 1 ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
            muted
            ref={secondaryVideoRef}
            style={{ filter: `brightness(${videoBrightness})` }}
          />
        </div>
        <OverlayLayer
          amplifierMode={sessionConfig.amplification}
          blueLightEnabled={blueLightEnabled}
          circadianEnabled={circadianEnabled}
          nightModeEnabled={nightModeEnabled}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/22 via-black/[0.03] to-black/36" />

        <div
          className={[
            'pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pb-4 transition-opacity duration-500 sm:px-5 sm:pb-5',
            shouldShowChrome ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          style={{
            paddingTop: `calc(env(safe-area-inset-top) + ${topChromeInset}px)`,
          }}
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

        {isFreeTrialUser ? (
          <div
            className={[
              'absolute bottom-0 right-0 z-30 p-4 transition-opacity duration-500 sm:p-5',
              shouldShowChrome ? 'opacity-100' : 'pointer-events-none opacity-0',
            ].join(' ')}
            style={{
              paddingBottom: `calc(env(safe-area-inset-bottom) + ${bottomChromeInset + 74}px)`,
              paddingRight: `calc(env(safe-area-inset-right) + ${smallScreenViewport ? 12 : 18}px)`,
            }}
          >
            <button
              className="flex flex-col items-start gap-1 rounded-[1.35rem] border border-emerald-200/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.18),rgba(59,130,246,0.2))] px-4 py-3 text-left text-white shadow-[0_14px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-emerald-200/35"
              onClick={() => void handleUpgradeNavigation()}
              type="button"
            >
              <span className="text-[10px] uppercase tracking-[0.28em] text-emerald-100/80">Upgrade</span>
              <span className="text-sm font-medium">Upgrade to REGEN</span>
              {trialMetaLabel ? <span className="text-xs text-slate-200/85">{trialMetaLabel}</span> : null}
            </button>
          </div>
        ) : null}

        {isPreloading ? (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/42 p-6 text-center">
            <div className="max-w-sm rounded-[2rem] border border-white/10 bg-slate-950/84 px-6 py-5 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-emerald-300" />
              <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-emerald-200/60">
                Preparing session
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Buffering the playback engine for a smoother start.
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">{preloadPercent}%</p>
            </div>
          </div>
        ) : null}

        {interactionRequired ? (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-6 text-center"
            onClick={() => void handleResumePlayback()}
          >
            <div
              className="max-w-md rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
                event.stopPropagation()
              }}
            >
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">
                Session focus needed
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Continue the active session
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Playback paused until you confirm the session is still active. Tap or click anywhere,
                or use the resume button below, to continue instantly.
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

        {activeSoftDenialState ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 p-6 text-center">
            <div className="max-w-lg rounded-[2rem] border border-rose-200/20 bg-slate-950/92 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.32em] text-rose-200/70">
                {activeSoftDenialState.eyebrow ??
                  (activeSoftDenialState.ctaTo ? 'Trial access locked' : 'Session limit reached')}
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">{activeSoftDenialState.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{activeSoftDenialState.description}</p>
              {activeSoftDenialState.ctaTo ? (
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    className="rounded-2xl bg-[linear-gradient(135deg,rgba(16,185,129,0.95),rgba(59,130,246,0.92))] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
                    onClick={() => void handleUpgradeNavigation()}
                    type="button"
                  >
                    {activeSoftDenialState.ctaLabel ?? 'Upgrade Now'}
                  </button>
                  <button
                    className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/5"
                    onClick={onClose}
                    type="button"
                  >
                    Return to Dashboard
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {usageWarningState && !activeSoftDenialState ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-4"
            style={{ top: `calc(env(safe-area-inset-top) + ${smallScreenViewport ? 72 : 80}px)` }}
          >
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

        {isFullscreen || showExitHint ? (
          <div
            className={[
              'pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-6 transition-all duration-300',
              showExitHint ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            ].join(' ')}
            style={{
              paddingBottom: `calc(env(safe-area-inset-bottom) + ${bottomChromeInset + 88}px)`,
            }}
          >
            <div className="rounded-full border border-white/10 bg-black/68 px-4 py-2 text-xs font-medium tracking-[0.02em] text-white shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              {fullscreenExitHintLabel}
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
              'flex w-[4.5rem] flex-col items-center justify-between rounded-[1.6rem] border border-white/10 bg-black/48 px-3 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl',
              smallScreenViewport ? 'h-[15rem]' : 'h-[18rem]',
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
            'pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pt-4 transition-opacity duration-500 sm:px-5 sm:pt-5',
            shouldShowChrome ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          style={{
            paddingBottom: `calc(env(safe-area-inset-bottom) + ${bottomChromeInset}px)`,
          }}
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
                          onToggle: () =>
                            setBlueLightEnabled((currentValue) => {
                              const nextValue = !currentValue

                              if (nextValue) {
                                trackUmamiEvent('anti_blue_light_enabled')
                              }

                              return nextValue
                            }),
                        },
                        {
                          checked: circadianEnabled,
                          label: 'Circadian rhythm',
                          onToggle: () => setCircadianEnabled((currentValue) => !currentValue),
                        },
                        {
                          checked: nightModeEnabled,
                          label: 'Night mode',
                          onToggle: () =>
                            setNightModeEnabled((currentValue) => {
                              const nextValue = !currentValue

                              if (nextValue) {
                                trackUmamiEvent('night_mode_enabled')
                              }

                              return nextValue
                            }),
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
                <GuideControlButton onClick={openManualGuide} />
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
                  active={isFullscreen}
                  ariaLabel={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                  onClick={() => void toggleFullscreen()}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  <FullscreenIcon active={isFullscreen} />
                </CompactIconButton>
              </div>
            </div>

            {(videoError || audioError) && !trialOverlayState ? (
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
      {manualGuideOpen ? (
        <GuideModal
          isClosing={manualGuideClosing}
          mode="manual"
          onClose={closeManualGuide}
          onPrimary={closeManualGuide}
        />
      ) : null}
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

function GuideControlButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="inline-flex h-11 items-center gap-2 rounded-[1rem] border border-emerald-300/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(59,130,246,0.14))] px-3 text-sm font-medium text-white transition hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.2),rgba(59,130,246,0.2))]"
      onClick={onClick}
      type="button"
    >
      <GuideIcon />
      <span>Guide</span>
    </button>
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

function GuideIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M6.5 5.5h7A2.5 2.5 0 0 1 16 8v10.5a1 1 0 0 1-1.54.84L11 17.2l-3.46 2.14A1 1 0 0 1 6 18.5V6a.5.5 0 0 1 .5-.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path d="M9 9.25h4.5" opacity="0.75" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M9 12.5h4.5" opacity="0.45" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
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
