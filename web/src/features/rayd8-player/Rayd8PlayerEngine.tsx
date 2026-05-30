import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import type { SessionType } from '../../app/types'
import { ConfirmModal } from '../../components/ConfirmModal'
import { GuideModal } from './GuideModal'
import { PlayerPerformanceNotice } from './PlayerPerformanceNotice'
import {
  InteractionRequiredOverlay,
  PlaybackHealthFallbackOverlay,
  PreloadOverlay,
  UsageWarningOverlay,
} from './PlayerSessionStatusOverlays'
import { VideoSurface } from './VideoSurface'
import { acquireBodyScrollLock } from './bodyScrollLock'
import { isMobilePlaybackRefactorEnabled } from './mobilePlaybackFeatureFlag'
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
import type { PlaybackPresentationSnapshot } from '../playback-authority/playbackPresentation'
import {
  isCombinedAvPlaybackEnabled,
  resolveCombinedPlaybackAsset,
} from '../../lib/resolveCombinedPlaybackAsset'
import { getAdminMuxPlaybackToken } from '../../services/admin'
import {
  computeMuxPlaybackExpiryMs,
  getMemberPlaybackToken,
  type MuxPlaybackPayload,
} from '../../services/player'
import type { ExperienceAccessSummary } from '../../services/player'
import { getSettings } from '../../services/settings'
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
import { usePlaybackAuthority, useSession } from '../session/SessionProvider'
import {
  resetMedia,
  setMediaSource,
  tryPlay,
  type HlsController,
} from './mediaController'
import { logExpressPlaybackDebug } from './expressPlaybackDebug'
import { PlaybackScheduler } from './playbackScheduler'
import {
  addTrackedDomEventListener,
  addTrackedEventListener,
  recordHlsController,
  recordPlayerRender,
  recordSourceLoad,
  recordVideoMount,
} from './playerDiagnostics'
import {
  resolvePlaybackPolicyProfile,
  shouldSuppressContinuityTimer,
} from '../playback-authority/playbackPolicy'
import {
  getConsecutivePlaybackStartTime,
  shouldTriggerSessionWarning,
  TWO_HOURS_MS,
  type SessionPlaybackStatus,
} from './sessionWarning'
import { useMobilePlaybackLifecycle } from './useMobilePlaybackLifecycle'
import { usePlaybackHealthGuard } from './usePlaybackHealthGuard'
import { useRayd8Fullscreen } from './useRayd8Fullscreen'
import { useWakeLock } from './useWakeLock'

const FALLBACK_PLAYBACK_PRESENTATION: PlaybackPresentationSnapshot = {
  interactionOverlayVisible: false,
  legacyPlaybackState: 'preloading',
  machine: 'PRELOADING',
}

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

  const serializedValue = JSON.stringify(nextValue)

  if (window.localStorage.getItem(LAST_SESSION_STORAGE_KEY) === serializedValue) {
    return
  }

  window.localStorage.setItem(LAST_SESSION_STORAGE_KEY, serializedValue)
}

function clearTimers(timerIds: Array<number | null>) {
  timerIds.forEach((timerId) => {
    if (timerId !== null) {
      window.clearTimeout(timerId)
    }
  })
}

function configureVideoElement(video: HTMLVideoElement | null) {
  if (!video) {
    return
  }

  video.loop = true
  video.defaultMuted = true
  video.muted = true
  video.volume = 0
  video.playsInline = true
  video.setAttribute('playsinline', 'true')
  video.preload = 'metadata'
}

interface Rayd8PlayerEngineProps {
  isAdminPreview: boolean
  onClose: () => void
  sessionType: SessionType
}

type ControlPanel = 'mode' | 'audio' | 'volume' | 'amplification' | 'gear' | null

const PLAYER_CHROME_IDLE_MS = 2200
const DEFAULT_BRIGHTNESS_PERCENT = 100
const FREEZE_CHECK_INTERVAL_MS = 1000
const FREEZE_THRESHOLD = 12
const MOBILE_FREEZE_THRESHOLD = 15
const RECOVERY_COOLDOWN_MS = 30_000
const BUFFER_HEALTH_CHECK_MS = 60_000
/** Refresh Mux signed URLs this long before JWT expiry so playback never hits 403 mid-stream. */
const MUX_REFRESH_LEAD_MS = 90_000
const MUX_REFRESH_MIN_DELAY_MS = 30 * 60 * 1000
const SESSION_WARNING_CHECK_MS = 10_000
const FULLSCREEN_EXIT_HINT_MS = 2500
const DOUBLE_TAP_EXIT_WINDOW_MS = 300
const VIDEO_REF_RETRY_FRAMES = [1, 2, 4] as const
const PLAYBACK_READY_TIMEOUT_MS = 8_000
const COMPACT_PLAYER_STAGE_HEIGHT_PX = 600
const DESKTOP_FULLSCREEN_EXIT_HINT_STORAGE_KEY = 'rayd8_fullscreen_exit_hint_desktop'
const MOBILE_FULLSCREEN_EXIT_HINT_STORAGE_KEY = 'rayd8_fullscreen_exit_hint_mobile'
const playbackPresentationMode =
  import.meta.env.VITE_RAYD8_PLAYBACK_PRESENTATION_MODE === 'performance'
    ? 'performance'
    : 'cinematic'

interface PlaybackStabilityProfile {
  backBufferLength: number
  mobileOptimized: boolean
  maxBufferLength: number
  maxMaxBufferLength: number
  startLevel: number
}

type PlayerUiDensity = 'compact' | 'desktop'

interface PlayerControlSizing {
  density: PlayerUiDensity
  dockOuterClassName: string
  dockInnerClassName: string
  dockRowClassName: string
  flyoutClassName: string
  flyoutGridClassName: string
  flyoutScrollClassName: string
  flyoutScrollStyle?: CSSProperties
  flyoutMaxHeight: number | null
  flyoutPanelHeaderClassName: string
  flyoutPanelTitleClassName: string
  flyoutPanelMetaClassName: string
  flyoutOptionClassName: string
  statusPillClassName: string
  guideButtonClassName: string
  guideLabelClassName: string
  iconButtonClassName: string
  volumePanelClassName: string
  volumeButtonClassName: string
  errorClassName: string
}

function getPlaybackStabilityProfile(mobileOptimized: boolean): PlaybackStabilityProfile {
  if (mobileOptimized) {
    return {
      backBufferLength: 60,
      mobileOptimized: true,
      maxBufferLength: 24,
      maxMaxBufferLength: 72,
      startLevel: 1,
    }
  }

  return {
    backBufferLength: 90,
    mobileOptimized: false,
    maxBufferLength: 40,
    maxMaxBufferLength: 120,
    startLevel: -1,
  }
}

function waitForAnimationFrames(frameCount: number) {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    let remainingFrames = frameCount

    const tick = () => {
      remainingFrames -= 1

      if (remainingFrames <= 0) {
        resolve()
        return
      }

      window.requestAnimationFrame(tick)
    }

    window.requestAnimationFrame(tick)
  })
}

function getCinematicStageHeight() {
  if (typeof window === 'undefined') {
    return 0
  }

  return Math.min(window.innerHeight, window.innerWidth * (9 / 16))
}

function createPlayerControlSizing({
  bottomChromeInset,
  cinematicStageHeight,
  isCompact,
}: {
  bottomChromeInset: number
  cinematicStageHeight: number
  isCompact: boolean
}): PlayerControlSizing {
  if (!isCompact) {
    return {
      density: 'desktop',
      dockInnerClassName: 'rounded-[1.6rem] border border-white/10 bg-black/48 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl',
      dockOuterClassName: 'mx-auto flex w-full max-w-4xl flex-col items-center gap-3',
      dockRowClassName: 'flex items-center gap-2',
      errorClassName: 'w-full max-w-[23rem] rounded-[1.4rem] border border-amber-300/20 bg-slate-950/90 px-4 py-3 text-sm leading-6 text-amber-100',
      flyoutClassName: 'w-full max-w-[23rem] rounded-[1.5rem] border border-white/10 bg-black/58 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl',
      flyoutGridClassName: 'grid gap-2',
      flyoutMaxHeight: null,
      flyoutOptionClassName: 'flex w-full items-center justify-between gap-3 rounded-[1.1rem] border px-3 py-3 text-left text-sm transition',
      flyoutPanelHeaderClassName: 'mb-3 flex items-center justify-between gap-3 px-1',
      flyoutPanelMetaClassName: 'text-[10px] text-slate-400',
      flyoutPanelTitleClassName: 'text-[10px] uppercase tracking-[0.3em] text-emerald-200/60',
      flyoutScrollClassName: '',
      guideButtonClassName: 'inline-flex h-11 items-center gap-2 rounded-[1rem] border border-emerald-300/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(59,130,246,0.14))] px-3 text-sm font-medium text-white transition hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.2),rgba(59,130,246,0.2))]',
      guideLabelClassName: '',
      iconButtonClassName: 'inline-flex h-11 w-11 items-center justify-center rounded-[1rem] border transition',
      statusPillClassName: 'rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-slate-300',
      volumeButtonClassName: 'inline-flex h-9 items-center justify-center rounded-[0.95rem] border border-white/10 bg-black/20 px-3 text-[11px] font-medium uppercase tracking-[0.24em] text-slate-200 transition hover:bg-white/[0.06]',
      volumePanelClassName: 'space-y-3 rounded-[1.15rem] border border-white/10 bg-white/[0.045] px-4 py-4',
    }
  }

  const flyoutMaxHeight = Math.max(
    144,
    Math.round(
      Math.min(
        cinematicStageHeight * 0.72,
        Math.max(144, cinematicStageHeight - bottomChromeInset - 84),
      ),
    ),
  )

  return {
    density: 'compact',
    dockInnerClassName: 'rounded-[1.25rem] border border-white/10 bg-black/52 p-1.5 shadow-[0_14px_44px_rgba(0,0,0,0.4)] backdrop-blur-2xl',
    dockOuterClassName: 'mx-auto flex w-full max-w-[min(100vw,30rem)] flex-col items-center gap-2',
    dockRowClassName: 'flex max-w-full items-center gap-1.5 overflow-x-auto overscroll-x-contain px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    errorClassName: 'w-[min(88vw,18rem)] max-w-[calc(100vw-1rem)] rounded-[1.1rem] border border-amber-300/20 bg-slate-950/90 px-3 py-2.5 text-xs leading-5 text-amber-100',
    flyoutClassName: 'w-[min(88vw,18rem)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/62 p-2 shadow-[0_14px_44px_rgba(0,0,0,0.44)] backdrop-blur-2xl',
    flyoutGridClassName: 'grid gap-1.5',
    flyoutMaxHeight,
    flyoutOptionClassName: 'flex w-full min-h-10 items-center justify-between gap-2 rounded-[0.95rem] border px-2.5 py-2 text-left text-xs transition',
    flyoutPanelHeaderClassName: 'mb-2 flex items-center justify-between gap-2 px-0.5',
    flyoutPanelMetaClassName: 'max-w-[8.5rem] truncate text-[10px] text-slate-400',
    flyoutPanelTitleClassName: 'text-[9px] uppercase tracking-[0.24em] text-emerald-200/60',
    flyoutScrollClassName: 'overflow-y-auto overscroll-contain pr-1',
    flyoutScrollStyle: {
      maskImage: 'linear-gradient(to bottom, transparent, black 0.75rem, black calc(100% - 0.75rem), transparent)',
      WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 0.75rem, black calc(100% - 0.75rem), transparent)',
    },
    guideButtonClassName: 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] border border-emerald-300/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(59,130,246,0.16))] text-white transition hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(59,130,246,0.22))] [&>svg]:h-4 [&>svg]:w-4',
    guideLabelClassName: 'sr-only',
    iconButtonClassName: 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.9rem] border transition [&>svg]:h-4 [&>svg]:w-4',
    statusPillClassName: 'shrink-0 rounded-full border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-slate-300',
    volumeButtonClassName: 'inline-flex h-8 items-center justify-center rounded-[0.85rem] border border-white/10 bg-black/20 px-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-200 transition hover:bg-white/[0.06]',
    volumePanelClassName: 'space-y-2 rounded-[1rem] border border-white/10 bg-white/[0.045] px-3 py-3',
  }
}

/** Reduce false-positive freeze recovery: time must stall *and* the element looks starved or loading. */
function isPlaybackStallCorroborated(video: HTMLVideoElement) {
  if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
    return true
  }

  return video.networkState === HTMLMediaElement.NETWORK_LOADING
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
  timeoutMs = PLAYBACK_READY_TIMEOUT_MS,
) {
  if (!media) {
    return false
  }

  return await new Promise<boolean>((resolve, reject) => {
    let settled = false
    let removeListeners: Array<() => void> = []
    let timeoutId: number | null = null

    const cleanup = () => {
      removeListeners.forEach((removeListener) => removeListener())
      removeListeners = []
      signal?.removeEventListener('abort', handleAbort)

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
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

    const handleTimeout = () => {
      logExpressPlaybackDebug('playback_ready_timeout', {
        bufferedPercent: getBufferedPercent(media),
        currentTime: media.currentTime,
        readyState: media.readyState,
        timeoutMs,
        videoWidth: media instanceof HTMLVideoElement ? media.videoWidth : 0,
      })
      finish(false)
    }

    removeListeners = [
      addTrackedEventListener(media, 'canplay', handleCanPlay, 'video:ready:canplay'),
      addTrackedEventListener(media, 'progress', handleProgress, 'video:ready:progress'),
      addTrackedEventListener(
        media,
        'loadedmetadata',
        handleProgress,
        'video:ready:loadedmetadata',
      ),
      addTrackedEventListener(
        media,
        'durationchange',
        handleProgress,
        'video:ready:durationchange',
      ),
      addTrackedEventListener(media, 'error', handleError, 'video:ready:error'),
    ]
    signal?.addEventListener('abort', handleAbort, { once: true })
    timeoutId = window.setTimeout(handleTimeout, timeoutMs)

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
  recordPlayerRender('Rayd8PlayerEngine')
  const [playbackScheduler] = useState(() => new PlaybackScheduler())
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
    setAudioMuted,
    setAudioTrack,
    setAudioVolume,
    setSingleAvAudioActive,
    softDenialState,
    startSession,
    usageWarningState,
  } = useSession()
  const primaryVideoControllerRef = useRef<HlsController | null>(null)
  const primaryVideoControllerProfileRef = useRef<string | null>(null)
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null)
  const playerRootRef = useRef<HTMLDivElement | null>(null)
  const brightnessTrackRef = useRef<HTMLDivElement | null>(null)
  const brightnessDraggingRef = useRef(false)
  const controlDockRef = useRef<HTMLDivElement | null>(null)
  const [currentVideoSignedUrl, setCurrentVideoSignedUrl] = useState<string | null>(null)
  const chromeHideTimerRef = useRef<number | null>(null)
  const fullscreenHintTimerRef = useRef<number | null>(null)
  const videoRequestRef = useRef(0)
  const freezeCounterRef = useRef(0)
  const lastObservedVideoTimeRef = useRef<number | null>(null)
  const previousFullscreenRef = useRef(false)
  const lastFullscreenTapTimestampRef = useRef(0)
  const releaseBodyScrollLockRef = useRef<(() => void) | null>(null)
  const sessionStartTimeRef = useRef<number | null>(null)
  const sessionWarningTimerRef = useRef<number | null>(null)
  const bufferHealthTimerRef = useRef<number | null>(null)
  const muxRefreshTimerRef = useRef<number | null>(null)
  const manualGuideTimerRef = useRef<number | null>(null)
  const chromeActivityFrameRef = useRef<number | null>(null)
  const brightnessUpdateFrameRef = useRef<number | null>(null)
  const pendingBrightnessPercentRef = useRef(DEFAULT_BRIGHTNESS_PERCENT)
  const mobileViewportRef = useRef(isMobileViewport())
  const tabletViewportRef = useRef(isTabletViewport())
  const orientationSettlingRef = useRef(false)
  const systemPausedRef = useRef(false)
  const playbackStateRef = useRef<SessionPlaybackStatus>('preloading')
  const singleAvAudioActiveRef = useRef(false)
  const audioMutedRef = useRef(audioMuted)
  const audioVolumeRef = useRef(audioVolume)
  const [sessionConfig, setSessionConfig] = useState<LastSessionConfig>(() => readLastSessionConfig())
  const [blueLightEnabled, setBlueLightEnabled] = useState(false)
  const [circadianEnabled, setCircadianEnabled] = useState(false)
  const [nightModeEnabled, setNightModeEnabled] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [preloadPercent, setPreloadPercent] = useState(0)
  const [exitPromptOpen, setExitPromptOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<ControlPanel>(null)
  const [manualGuideOpen, setManualGuideOpen] = useState(false)
  const [manualGuideClosing, setManualGuideClosing] = useState(false)
  const [showExitHint, setShowExitHint] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [brightnessPercent, setBrightnessPercent] = useState(DEFAULT_BRIGHTNESS_PERCENT)
  const [primaryVideoReady, setPrimaryVideoReady] = useState(false)
  const [initFailureVisible, setInitFailureVisible] = useState(false)
  const [initRetryKey, setInitRetryKey] = useState(0)
  const [mobileViewport, setMobileViewport] = useState(() => isMobileViewport())
  const [tabletViewport, setTabletViewport] = useState(() => isTabletViewport())
  const [smallScreenViewport, setSmallScreenViewport] = useState(() => isSmallScreen())
  const [cinematicStageHeight, setCinematicStageHeight] = useState(() => getCinematicStageHeight())
  const [allowExtendedSessions, setAllowExtendedSessions] = useState(false)

  const playbackAuthority = usePlaybackAuthority()
  const playbackPresentation = useSyncExternalStore(
    playbackAuthority ? playbackAuthority.subscribe : () => () => {},
    playbackAuthority ? playbackAuthority.getSnapshot : () => FALLBACK_PLAYBACK_PRESENTATION,
    playbackAuthority ? playbackAuthority.getSnapshot : () => FALLBACK_PLAYBACK_PRESENTATION,
  )

  const playbackMode = isAdminPreview ? 'admin' : 'member'
  const mobilePlaybackRefactorEnabled = isMobilePlaybackRefactorEnabled()
  const shouldUsePlaybackStability = true
  const smoothPlaybackMode = useMemo(
    () =>
      typeof window !== 'undefined' &&
      import.meta.env.DEV &&
      window.localStorage.getItem('rayd8-smooth-playback') === 'true',
    [],
  )
  const effectiveAllowExtendedSessions = playbackMode === 'member' && allowExtendedSessions
  const continuityTimerSuppressed = shouldSuppressContinuityTimer(
    resolvePlaybackPolicyProfile(),
    effectiveAllowExtendedSessions,
  )
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
    () => getPlaybackStabilityProfile(smoothPlaybackMode || mobileViewport || tabletViewport),
    [mobileViewport, smoothPlaybackMode, tabletViewport],
  )
  const playbackStabilityProfileRef = useRef(playbackStabilityProfile)
  const touchLikeFullscreenViewport = mobileViewport || tabletViewport
  const {
    exitFullscreen,
    isAppShellFullscreen,
    isFullscreen,
    toggleFullscreen,
  } = useRayd8Fullscreen({
    enabled: mobilePlaybackRefactorEnabled,
    playerRootRef,
    touchLikeViewport: touchLikeFullscreenViewport,
    videoRef: primaryVideoRef,
  })
  const isPseudoFullscreen = isAppShellFullscreen
  const isPreloading = playbackPresentation.legacyPlaybackState === 'preloading'
  const isRecovering = playbackPresentation.legacyPlaybackState === 'recovering'
  const interactionRequired = playbackPresentation.interactionOverlayVisible
  const isVideoLoading = isPreloading || isRecovering
  const topChromeInset = smallScreenViewport ? 12 : 16
  const bottomChromeInset = smallScreenViewport ? 20 : 24
  const isCompactPlayerUI =
    mobileViewport || smallScreenViewport || cinematicStageHeight < COMPACT_PLAYER_STAGE_HEIGHT_PX
  const playerControlSizing = useMemo(
    () =>
      createPlayerControlSizing({
        bottomChromeInset,
        cinematicStageHeight,
        isCompact: isCompactPlayerUI,
      }),
    [bottomChromeInset, cinematicStageHeight, isCompactPlayerUI],
  )
  const fullscreenExitHintLabel = touchLikeFullscreenViewport
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

  useLayoutEffect(() => {
    playbackStateRef.current = playbackPresentation.legacyPlaybackState
  }, [playbackPresentation.legacyPlaybackState])

  useEffect(() => {
    logExpressPlaybackDebug('player_mount', { sessionType })
  }, [sessionType])

  useEffect(() => {
    playbackAuthority?.setAllowExtendedSessions(effectiveAllowExtendedSessions)
  }, [effectiveAllowExtendedSessions, playbackAuthority])

  useEffect(() => {
    audioMutedRef.current = audioMuted
    audioVolumeRef.current = audioVolume

    if (singleAvAudioActiveRef.current && primaryVideoRef.current) {
      primaryVideoRef.current.muted = audioMuted
      primaryVideoRef.current.defaultMuted = audioMuted
      primaryVideoRef.current.volume = audioMuted ? 0 : audioVolume
    }
  }, [audioMuted, audioVolume])

  useEffect(() => {
    mobileViewportRef.current = mobileViewport
    tabletViewportRef.current = tabletViewport
    playbackStabilityProfileRef.current = playbackStabilityProfile
  }, [mobileViewport, playbackStabilityProfile, tabletViewport])

  const setPrimaryVideoElement = useCallback((node: HTMLVideoElement | null) => {
    if (primaryVideoRef.current === node) {
      return
    }

    recordVideoMount('primary', node !== null)
    primaryVideoRef.current = node
    setPrimaryVideoReady(node !== null)
    if (!node) {
      logExpressPlaybackDebug('video_ref_null', { attached: false })
      return
    }

    logExpressPlaybackDebug('video_ref_attached', {
      attached: true,
      readyState: node.readyState,
      videoWidth: node.videoWidth,
    })
  }, [])

  useEffect(() => {
    const video = primaryVideoRef.current

    if (!video) {
      return
    }

    return addTrackedEventListener(
      video,
      'loadedmetadata',
      () => {
        logExpressPlaybackDebug('video_metadata_loaded', {
          currentTime: video.currentTime,
          readyState: video.readyState,
          videoHeight: video.videoHeight,
          videoWidth: video.videoWidth,
        })
      },
      'video:metadata:express-playback-debug',
    )
  }, [primaryVideoReady, initRetryKey])

  useEffect(() => {
    if (playbackMode !== 'member') {
      return
    }

    let cancelled = false

    async function loadExtendedSessionSetting() {
      const tokenResult = await getTokenSafe()

      if (!tokenResult.token || cancelled) {
        return
      }

      try {
        const response = await getSettings(tokenResult.token)

        if (!cancelled) {
          setAllowExtendedSessions(response.settings.allowExtendedSessions)
        }
      } catch {
        if (!cancelled) {
          setAllowExtendedSessions(false)
        }
      }
    }

    void loadExtendedSessionSetting()

    return () => {
      cancelled = true
    }
  }, [getTokenSafe, playbackMode])

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
    sessionStartTimeRef.current = Date.now()
  }, [])

  const clearSessionContinuityTimer = useCallback(() => {
    sessionStartTimeRef.current = null

    if (sessionWarningTimerRef.current !== null) {
      window.clearTimeout(sessionWarningTimerRef.current)
      sessionWarningTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const syncViewportFlags = () => {
      const nextMobileViewport = isMobileViewport()
      const nextTabletViewport = isTabletViewport()
      const nextSmallScreenViewport = isSmallScreen()
      const nextCinematicStageHeight = getCinematicStageHeight()

      setMobileViewport((currentValue) =>
        currentValue === nextMobileViewport ? currentValue : nextMobileViewport,
      )
      setTabletViewport((currentValue) =>
        currentValue === nextTabletViewport ? currentValue : nextTabletViewport,
      )
      setSmallScreenViewport((currentValue) =>
        currentValue === nextSmallScreenViewport ? currentValue : nextSmallScreenViewport,
      )
      setCinematicStageHeight((currentValue) =>
        Math.abs(currentValue - nextCinematicStageHeight) < 1 ? currentValue : nextCinematicStageHeight,
      )
    }

    syncViewportFlags()
    const removeResizeListener = addTrackedDomEventListener(
      window,
      'resize',
      syncViewportFlags,
      'window:resize:viewport',
    )
    const removeOrientationListener = addTrackedDomEventListener(
      window,
      'orientationchange',
      syncViewportFlags,
      'window:orientationchange:viewport',
    )

    return () => {
      removeResizeListener()
      removeOrientationListener()
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

    const removePointerListener = addTrackedDomEventListener(
      window,
      'pointerdown',
      handlePointerDown as EventListener,
      'window:pointerdown:panel',
    )
    const removeKeyListener = addTrackedDomEventListener(
      window,
      'keydown',
      handleKeyDown as EventListener,
      'window:keydown:panel',
    )

    return () => {
      removePointerListener()
      removeKeyListener()
    }
  }, [activePanel])

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

    if (manualGuideTimerRef.current !== null) {
      window.clearTimeout(manualGuideTimerRef.current)
    }

    manualGuideTimerRef.current = window.setTimeout(() => {
      setManualGuideOpen(false)
      setManualGuideClosing(false)
      manualGuideTimerRef.current = null
    }, GUIDE_MODAL_TRANSITION_MS)
  }, [experience])

  useEffect(() => {
    const handleEscapeFullscreen = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement === playerRootRef.current) {
        void exitFullscreen()
      }
    }

    const removeKeyListener = addTrackedDomEventListener(
      window,
      'keydown',
      handleEscapeFullscreen as EventListener,
      'window:keydown:fullscreen',
    )

    return () => {
      removeKeyListener()
    }
  }, [exitFullscreen])

  const pingChromeVisibility = useCallback(() => {
    setChromeVisible((currentValue) => (currentValue ? currentValue : true))

    if (chromeHideTimerRef.current !== null) {
      window.clearTimeout(chromeHideTimerRef.current)
    }

    chromeHideTimerRef.current = window.setTimeout(() => {
      setChromeVisible(false)
    }, PLAYER_CHROME_IDLE_MS)
  }, [])

  const scheduleChromeVisibilityPing = useCallback(() => {
    if (chromeActivityFrameRef.current !== null) {
      return
    }

    chromeActivityFrameRef.current = window.requestAnimationFrame(() => {
      chromeActivityFrameRef.current = null
      pingChromeVisibility()
    })
  }, [pingChromeVisibility])

  useEffect(() => {
    if (!isPseudoFullscreen) {
      releaseBodyScrollLockRef.current?.()
      releaseBodyScrollLockRef.current = null

      return
    }

    releaseBodyScrollLockRef.current ??= acquireBodyScrollLock()

    return () => {
      releaseBodyScrollLockRef.current?.()
      releaseBodyScrollLockRef.current = null
    }
  }, [isPseudoFullscreen])

  useEffect(() => {
    if (isFullscreen && !previousFullscreenRef.current) {
      pingChromeVisibility()
      showFullscreenExitHint(touchLikeFullscreenViewport)
    }

    if (!isFullscreen && previousFullscreenRef.current) {
      setShowExitHint(false)
      lastFullscreenTapTimestampRef.current = 0
    }

    previousFullscreenRef.current = isFullscreen
  }, [isFullscreen, pingChromeVisibility, touchLikeFullscreenViewport, showFullscreenExitHint])

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

  const handleVideoSurfacePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pingChromeVisibility()
      handlePseudoFullscreenSurfacePointerUp(event)
    },
    [handlePseudoFullscreenSurfacePointerUp, pingChromeVisibility],
  )

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      pingChromeVisibility()
    })

    const handlePlayerActivity = () => {
      scheduleChromeVisibilityPing()
    }

    const removeActivityListeners = [
      addTrackedDomEventListener(window, 'mousemove', handlePlayerActivity, 'window:mousemove'),
      addTrackedDomEventListener(window, 'click', handlePlayerActivity, 'window:click'),
      addTrackedDomEventListener(window, 'pointerdown', handlePlayerActivity, 'window:pointerdown'),
      addTrackedDomEventListener(window, 'keydown', handlePlayerActivity, 'window:keydown:activity'),
      addTrackedDomEventListener(window, 'touchstart', handlePlayerActivity, 'window:touchstart'),
      addTrackedDomEventListener(window, 'focus', handlePlayerActivity, 'window:focus'),
    ]

    return () => {
      window.cancelAnimationFrame(frameId)
      if (chromeActivityFrameRef.current !== null) {
        window.cancelAnimationFrame(chromeActivityFrameRef.current)
        chromeActivityFrameRef.current = null
      }
      clearTimers([chromeHideTimerRef.current, fullscreenHintTimerRef.current])
      removeActivityListeners.forEach((removeListener) => removeListener())
    }
  }, [pingChromeVisibility, scheduleChromeVisibilityPing])

  const fetchPlaybackPayload = useCallback(
    async (assetId: string): Promise<MuxPlaybackPayload> => {
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

      return response.playback
    },
    [getTokenSafe, playbackMode, sessionType],
  )

  const getVideoElement = useCallback(() => primaryVideoRef.current, [])

  const resumeMediaWithRetry = useCallback(async (media: HTMLMediaElement | null) => {
    const started = await tryPlay(media)

    if (started) {
      return true
    }

    return await tryPlay(media)
  }, [])

  const playbackHealthResetKey = `${sessionType}:${sessionConfig.videoMode}:${audioTrack}:${initRetryKey}`
  const handlePlaybackHealthSoftRecovery = useCallback(
    async (reason: string) => {
      logExpressPlaybackDebug('health_soft_recovery_attempt', {
        reason,
        currentTime: getVideoElement()?.currentTime ?? null,
        readyState: getVideoElement()?.readyState ?? null,
        videoWidth: getVideoElement()?.videoWidth ?? null,
      })
      return await resumeMediaWithRetry(getVideoElement())
    },
    [getVideoElement, resumeMediaWithRetry],
  )
  const playbackHealthGuard = usePlaybackHealthGuard({
    enabled: !activeSoftDenialState,
    getVideoElement,
    onSoftRecovery: handlePlaybackHealthSoftRecovery,
    resetKey: playbackHealthResetKey,
  })
  const playbackHealthFallbackVisible = playbackHealthGuard.fallbackVisible
  const reportPlaybackStartupFailure = playbackHealthGuard.reportStartupFailure
  const resetPlaybackHealth = playbackHealthGuard.reset

  const triggerSessionContinuityCheck = useCallback(() => {
    playbackAuthority?.dispatch({ type: 'continuity_threshold_reached' })
    resetSessionContinuityTimer()
    pingChromeVisibility()
  }, [playbackAuthority, pingChromeVisibility, resetSessionContinuityTimer])

  const destroyPrimaryVideoPipeline = useCallback((diagnosticsLabel: string) => {
    if (muxRefreshTimerRef.current !== null) {
      window.clearTimeout(muxRefreshTimerRef.current)
      muxRefreshTimerRef.current = null
    }

    if (primaryVideoControllerRef.current) {
      recordHlsController(diagnosticsLabel, 'destroy')
      primaryVideoControllerRef.current.destroy()
      primaryVideoControllerRef.current = null
    }

    primaryVideoControllerProfileRef.current = null
    resetMedia(primaryVideoRef.current)
    setCurrentVideoSignedUrl(null)
  }, [])

  const endSession = useCallback(() => {
    void exitFullscreen()
    playbackScheduler.clearAll()
    clearTimers([
      bufferHealthTimerRef.current,
      muxRefreshTimerRef.current,
      sessionWarningTimerRef.current,
      manualGuideTimerRef.current,
    ])
    bufferHealthTimerRef.current = null
    muxRefreshTimerRef.current = null
    sessionWarningTimerRef.current = null
    manualGuideTimerRef.current = null
    systemPausedRef.current = true
    singleAvAudioActiveRef.current = false
    setSingleAvAudioActive(false)
    clearSessionContinuityTimer()
    destroyPrimaryVideoPipeline('primary:end-session')
    onClose()
  }, [
    clearSessionContinuityTimer,
    destroyPrimaryVideoPipeline,
    exitFullscreen,
    onClose,
    playbackScheduler,
    setSingleAvAudioActive,
  ])

  const shouldVideoBePlaying = useCallback((video: HTMLVideoElement | null) => {
    return Boolean(
      video?.currentSrc &&
        playbackStateRef.current === 'playing' &&
        !systemPausedRef.current,
    )
  }, [])

  useWakeLock({
    enabled: mobilePlaybackRefactorEnabled,
    playbackState: playbackPresentation.legacyPlaybackState,
    systemPausedRef,
    title: sessionHeading.title,
    videoRef: primaryVideoRef,
  })

  useMobilePlaybackLifecycle({
    enabled: mobilePlaybackRefactorEnabled && touchLikeFullscreenViewport,
    getVideoElement,
    orientationSettlingRef,
    playbackAuthority,
    shouldVideoBePlaying,
  })

  const runVideoMajorRecovery = useCallback(
    async (reason: 'stalled' | 'error'): Promise<boolean> => {
      if (!shouldUsePlaybackStability) {
        return false
      }

      const stateNow = playbackStateRef.current

      if (stateNow === 'preloading' || stateNow === 'interaction-required') {
        return false
      }

      const activeVideo = getVideoElement()
      const activeController = primaryVideoControllerRef.current

      if (!activeVideo?.currentSrc) {
        return false
      }

      if (systemPausedRef.current) {
        return false
      }

      freezeCounterRef.current = 0
      lastObservedVideoTimeRef.current = null

      const storedTime = Number.isFinite(activeVideo.currentTime) ? activeVideo.currentTime : 0

      if (import.meta.env.DEV) {
        console.warn(`[RAYD8] Recovering playback after ${reason}.`)
      }

      try {
        activeVideo.muted = true
        activeVideo.setAttribute('playsinline', 'true')

        if (reason === 'error') {
          activeController?.recoverMediaError()
        }

        activeController?.startLoad(storedTime)

        const resumed = await tryPlay(activeVideo)

        if (resumed) {
          if (activeVideo.currentTime < Math.max(0, storedTime - 0.5)) {
            try {
              activeVideo.currentTime = storedTime
            } catch {
              // Ignore failed corrective seeks while the stream is recovering.
            }
          }

          return true
        }

        return false
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[RAYD8] Playback recovery failed.', error)
        }

        return false
      }
    },
    [getVideoElement, shouldUsePlaybackStability],
  )

  useEffect(() => {
    const auth = playbackAuthority

    if (!auth) {
      return
    }

    auth.registerVideoDelegate({
      attemptMajorRecovery: runVideoMajorRecovery,
      attemptSoftResume: async () => {
        systemPausedRef.current = false
        return resumeMediaWithRetry(getVideoElement())
      },
      pauseForUserPrompt: () => {
        systemPausedRef.current = true
        getVideoElement()?.pause()
      },
    })

    return () => auth.clearVideoDelegate()
  }, [getVideoElement, playbackAuthority, resumeMediaWithRetry, runVideoMajorRecovery])

  useEffect(() => {
    if (continuityTimerSuppressed) {
      clearSessionContinuityTimer()
      return
    }

    const nextSessionStartTime = getConsecutivePlaybackStartTime({
      allowExtendedSessions: continuityTimerSuppressed,
      now: Date.now(),
      playbackState: playbackPresentation.legacyPlaybackState,
      sessionStartTime: sessionStartTimeRef.current,
    })

    if (nextSessionStartTime === null) {
      clearSessionContinuityTimer()
      return
    }

    sessionStartTimeRef.current = nextSessionStartTime

    const checkTimer = () => {
      const now = Date.now()

      if (
        shouldTriggerSessionWarning({
          allowExtendedSessions: continuityTimerSuppressed,
          now,
          sessionStartTime: sessionStartTimeRef.current,
        })
      ) {
        triggerSessionContinuityCheck()
      }

      const nextDelay =
        sessionStartTimeRef.current === null
          ? SESSION_WARNING_CHECK_MS
          : Math.max(
              0,
              Math.min(
                SESSION_WARNING_CHECK_MS,
                TWO_HOURS_MS - (Date.now() - sessionStartTimeRef.current),
              ),
            )

      sessionWarningTimerRef.current = playbackScheduler.setTimeout(
        'session-warning',
        checkTimer,
        nextDelay,
      )
    }

    const initialDelay = Math.max(
      0,
      Math.min(SESSION_WARNING_CHECK_MS, TWO_HOURS_MS - (Date.now() - nextSessionStartTime)),
    )

    sessionWarningTimerRef.current = playbackScheduler.setTimeout(
      'session-warning',
      checkTimer,
      initialDelay,
    )

    return () => {
      playbackScheduler.clear('session-warning')
      sessionWarningTimerRef.current = null
    }
  }, [
    clearSessionContinuityTimer,
    continuityTimerSuppressed,
    playbackAuthority,
    playbackPresentation.legacyPlaybackState,
    playbackScheduler,
    triggerSessionContinuityCheck,
  ])

  useEffect(() => {
    let cancelled = false
    const preloadAbortController = new AbortController()
    const requestId = videoRequestRef.current + 1

    videoRequestRef.current = requestId

    const clearMuxRefreshTimer = () => {
      if (muxRefreshTimerRef.current !== null) {
        playbackScheduler.clear('video-mux-refresh')
        muxRefreshTimerRef.current = null
      }
    }

    async function waitForPrimaryVideoElement() {
      const immediateVideo = primaryVideoRef.current

      if (immediateVideo) {
        return immediateVideo
      }

      for (const frameCount of VIDEO_REF_RETRY_FRAMES) {
        logExpressPlaybackDebug('syncVideoMode_retry', { frameCount, reason: 'video_ref_missing' })
        await waitForAnimationFrames(frameCount)

        if (cancelled || requestId !== videoRequestRef.current) {
          return null
        }

        const retryVideo = primaryVideoRef.current

        if (retryVideo) {
          return retryVideo
        }
      }

      logExpressPlaybackDebug('syncVideoMode_fail', { reason: 'video_ref_missing' })
      return null
    }

    async function syncVideoMode() {
      resetSessionContinuityTimer()
      playbackAuthority?.dispatch({ type: 'lifecycle_preloading' })
      setPreloadPercent(0)
      setVideoError(null)
      setInitFailureVisible(false)
      resetPlaybackHealth()
      logExpressPlaybackDebug('syncVideoMode_start', {
        audioTrack,
        experience,
        mode: sessionConfig.videoMode,
      })

      try {
        const videoAssetInput = {
          experience,
          plan: playbackPlan,
          speed: sessionConfig.videoMode,
        }
        const combinedAssetId =
          isCombinedAvPlaybackEnabled() && audioTrack !== 'none'
            ? resolveCombinedPlaybackAsset({
                ...videoAssetInput,
                audioTrack,
              })
            : null
        const singleAvAudioActive = Boolean(combinedAssetId)
        singleAvAudioActiveRef.current = singleAvAudioActive
        const assetId = combinedAssetId ?? resolvePlaybackAsset(videoAssetInput)
        setSingleAvAudioActive(singleAvAudioActive)
        playbackAuthority?.setPlaybackKind(singleAvAudioActive ? 'combined' : 'dual')
        const playback = await fetchPlaybackPayload(assetId)

        if (cancelled || requestId !== videoRequestRef.current) {
          return
        }

        const video = await waitForPrimaryVideoElement()

        if (!video) {
          if (!cancelled) {
            setPreloadPercent(0)
            setInitFailureVisible(true)
            playbackAuthority?.dispatch({ type: 'lifecycle_fatal', message: 'Video element was not ready.' })
            logExpressPlaybackDebug('init_failure_fallback_shown', { reason: 'video_ref_missing' })
          }

          return
        }

        setCurrentVideoSignedUrl(playback.signed_url)

        configureVideoElement(video)
        video.muted = singleAvAudioActive ? audioMutedRef.current : true
        video.defaultMuted = singleAvAudioActive ? audioMutedRef.current : true
        video.volume = singleAvAudioActive && !audioMutedRef.current ? audioVolumeRef.current : 0
        freezeCounterRef.current = 0
        lastObservedVideoTimeRef.current = null
        systemPausedRef.current = true

        clearMuxRefreshTimer()

        const diagnosticsLabel = `primary:${experience}:${sessionConfig.videoMode}`
        logExpressPlaybackDebug('mux_source_load', { diagnosticsLabel })
        const applied = await setMediaSource({
          controllerProfileRef: primaryVideoControllerProfileRef,
          controllerRef: primaryVideoControllerRef,
          diagnostics: {
            recordController: (action) => recordHlsController(diagnosticsLabel, action),
            recordSourceLoad: (sourceUrl) => recordSourceLoad(diagnosticsLabel, sourceUrl),
          },
          generationRef: videoRequestRef,
          media: video,
          profileKey: playbackStabilityProfileRef.current.mobileOptimized ? 'mobile' : 'desktop',
          requestGeneration: requestId,
          sourceUrl: playback.signed_url,
          stabilityProfile: playbackStabilityProfileRef.current,
        })

        if (!applied || cancelled || requestId !== videoRequestRef.current) {
          if (!cancelled && requestId === videoRequestRef.current) {
            reportPlaybackStartupFailure('media_source_not_applied')
          }
          return
        }

        function scheduleMuxRefreshFromPayload(payload: MuxPlaybackPayload) {
          clearMuxRefreshTimer()
          const msUntilExpiry = computeMuxPlaybackExpiryMs(payload) - Date.now()

          if (msUntilExpiry > MUX_REFRESH_MIN_DELAY_MS) {
            if (import.meta.env.DEV) {
              console.info('[RAYD8] Skipping Mux refresh during active playback; token has ample lifetime.')
            }
            return
          }

          const delay = Math.max(4000, msUntilExpiry - MUX_REFRESH_LEAD_MS)

          if (import.meta.env.DEV) {
            console.info(`[RAYD8] Scheduling emergency Mux refresh in ${Math.round(delay / 1000)}s.`)
          }

          muxRefreshTimerRef.current = playbackScheduler.setTimeout('video-mux-refresh', () => {
            muxRefreshTimerRef.current = null

            if (cancelled || requestId !== videoRequestRef.current) {
              return
            }

            void (async () => {
              try {
                if (import.meta.env.DEV) {
                  console.info('[RAYD8] Running emergency Mux refresh for active video.')
                }
                const tokenResult = await getTokenSafe()

                if (!tokenResult.token || requestId !== videoRequestRef.current) {
                  return
                }

                const response =
                  playbackMode === 'admin'
                    ? await getAdminMuxPlaybackToken(assetId, tokenResult.token)
                    : await getMemberPlaybackToken(
                        assetId,
                        getExperienceFromSessionType(sessionType),
                        tokenResult.token,
                      )

                const nextPlayback = response.playback

                if (cancelled || requestId !== videoRequestRef.current) {
                  return
                }

                const activeVideo = primaryVideoRef.current

                if (!activeVideo) {
                  return
                }

                const refreshDiagnosticsLabel = `primary:mux-refresh:${experience}:${sessionConfig.videoMode}`
                const refreshed = await setMediaSource({
                  controllerProfileRef: primaryVideoControllerProfileRef,
                  controllerRef: primaryVideoControllerRef,
                  diagnostics: {
                    recordController: (action) => recordHlsController(refreshDiagnosticsLabel, action),
                    recordSourceLoad: (sourceUrl) => recordSourceLoad(refreshDiagnosticsLabel, sourceUrl),
                  },
                  generationRef: videoRequestRef,
                  media: activeVideo,
                  options: { pauseBeforeLoad: false },
                  profileKey: playbackStabilityProfileRef.current.mobileOptimized ? 'mobile' : 'desktop',
                  requestGeneration: requestId,
                  sourceUrl: nextPlayback.signed_url,
                  stabilityProfile: playbackStabilityProfileRef.current,
                })

                if (!refreshed || requestId !== videoRequestRef.current) {
                  return
                }

                setCurrentVideoSignedUrl(nextPlayback.signed_url)
                scheduleMuxRefreshFromPayload(nextPlayback)
              } catch {
                // Best-effort refresh; next mode change or recovery path may reload.
              }
            })()
          }, delay)
        }

        scheduleMuxRefreshFromPayload(playback)

        const preloadThreshold = getStartupBufferThreshold(
          mobileViewportRef.current,
          tabletViewportRef.current,
        )
        const readyToStart = await waitForPlaybackReady(
          video,
          preloadThreshold,
          setPreloadPercent,
          preloadAbortController.signal,
        )

        if (!readyToStart || cancelled || requestId !== videoRequestRef.current) {
          if (!cancelled && requestId === videoRequestRef.current) {
            reportPlaybackStartupFailure('playback_not_ready')
          }
          return
        }

        logExpressPlaybackDebug('playback_ready', {
          currentTime: video.currentTime,
          preloadThreshold,
          readyState: video.readyState,
          videoWidth: video.videoWidth,
        })
        playbackAuthority?.dispatch({ type: 'lifecycle_ready' })
        const started = await tryPlay(video)

        if (!cancelled) {
          systemPausedRef.current = false
          setPreloadPercent(100)
          playbackAuthority?.dispatch({ type: 'lifecycle_play_attempt_finished', ok: started })

          if (!started) {
            reportPlaybackStartupFailure('play_failed')
          }
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

          playbackAuthority?.dispatch({ type: 'lifecycle_ready' })
          setInitFailureVisible(true)
          logExpressPlaybackDebug('init_failure_fallback_shown', {
            reason: error instanceof Error ? error.message : 'unknown',
          })
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
      clearMuxRefreshTimer()
      preloadAbortController.abort()
    }
  }, [
    experience,
    audioTrack,
    fetchPlaybackPayload,
    getTokenSafe,
    playbackAuthority,
    playbackMode,
    playbackPlan,
    playbackScheduler,
    resetSessionContinuityTimer,
    reportPlaybackStartupFailure,
    resetPlaybackHealth,
    sessionConfig.videoMode,
    sessionType,
    setSingleAvAudioActive,
    primaryVideoReady,
    initRetryKey,
  ])

  useEffect(() => {
    freezeCounterRef.current = 0
    lastObservedVideoTimeRef.current = null
  }, [playbackPresentation.legacyPlaybackState])

  useEffect(() => {
    if (!shouldUsePlaybackStability) {
      return
    }

    playbackScheduler.setInterval('video-freeze-check', () => {
      const activeVideo = getVideoElement()

      if (!activeVideo) {
        freezeCounterRef.current = 0
        lastObservedVideoTimeRef.current = null
        return
      }

      if (!shouldVideoBePlaying(activeVideo) || activeVideo.paused || orientationSettlingRef.current) {
        freezeCounterRef.current = 0
        lastObservedVideoTimeRef.current = activeVideo?.currentTime ?? null
        return
      }

      const currentTime = activeVideo.currentTime
      const previousTime = lastObservedVideoTimeRef.current

      if (
        previousTime !== null &&
        currentTime === previousTime &&
        isPlaybackStallCorroborated(activeVideo)
      ) {
        freezeCounterRef.current += 1
        const freezeThreshold =
          mobilePlaybackRefactorEnabled && (mobileViewportRef.current || tabletViewportRef.current)
            ? MOBILE_FREEZE_THRESHOLD
            : FREEZE_THRESHOLD

        if (freezeCounterRef.current >= freezeThreshold) {
          playbackAuthority?.dispatch({ type: 'video_persistent_freeze', reason: 'stalled' })
        }
      } else {
        freezeCounterRef.current = 0
      }

      lastObservedVideoTimeRef.current = currentTime
    }, FREEZE_CHECK_INTERVAL_MS)

    return () => {
      playbackScheduler.clear('video-freeze-check')
    }
  }, [
    getVideoElement,
    mobilePlaybackRefactorEnabled,
    playbackAuthority,
    playbackScheduler,
    shouldUsePlaybackStability,
    shouldVideoBePlaying,
  ])

  useEffect(() => {
    if (!shouldUsePlaybackStability) {
      return
    }

    const activeVideo = getVideoElement()

    if (!activeVideo) {
      return
    }

    const handleBufferEvent = (event: Event) => {
      if (!shouldVideoBePlaying(activeVideo)) {
        return
      }

      if (!isPlaybackStallCorroborated(activeVideo)) {
        return
      }

      if (import.meta.env.DEV) {
        console.info(`[RAYD8] Observed transient ${event.type} on the active video element.`)
      }
    }

    const handlePause = () => {
      if (!shouldVideoBePlaying(activeVideo) || !activeVideo.paused) {
        return
      }

      playbackScheduler.setTimeout('video-pause-confirmation', () => {
        if (shouldVideoBePlaying(activeVideo) && activeVideo.paused) {
          playbackAuthority?.dispatch({ type: 'video_pause_while_expecting_play' })
        }
      }, RECOVERY_COOLDOWN_MS)
    }

    const handleError = () => {
      if (shouldVideoBePlaying(activeVideo)) {
        playbackAuthority?.dispatch({ type: 'video_error' })
      }
    }

    const handleEnded = () => {
      if (shouldVideoBePlaying(activeVideo)) {
        try {
          activeVideo.currentTime = 0
        } catch {
          // Native looping should handle HLS; this is only a single-pipeline fallback.
        }

        playbackAuthority?.dispatch({ type: 'video_ended_loop' })
      }
    }

    const removeWaitingListener = addTrackedEventListener(
      activeVideo,
      'waiting',
      handleBufferEvent,
      'video:primary:waiting',
    )
    const removeStalledListener = addTrackedEventListener(
      activeVideo,
      'stalled',
      handleBufferEvent,
      'video:primary:stalled',
    )
    const removePauseListener = addTrackedEventListener(
      activeVideo,
      'pause',
      handlePause,
      'video:primary:pause',
    )
    const removeErrorListener = addTrackedEventListener(
      activeVideo,
      'error',
      handleError,
      'video:primary:error',
    )
    const removeEndedListener = addTrackedEventListener(
      activeVideo,
      'ended',
      handleEnded,
      'video:primary:ended',
    )

    return () => {
      playbackScheduler.clear('video-pause-confirmation')
      removeWaitingListener()
      removeStalledListener()
      removePauseListener()
      removeErrorListener()
      removeEndedListener()
    }
  }, [
    getVideoElement,
    playbackAuthority,
    playbackScheduler,
    shouldUsePlaybackStability,
    shouldVideoBePlaying,
  ])

  useEffect(() => {
    if (!shouldUsePlaybackStability) {
      return
    }

    const checkBufferHealth = () => {
      const activeVideo = getVideoElement()

      if (
        activeVideo &&
        shouldVideoBePlaying(activeVideo) &&
        !orientationSettlingRef.current &&
        activeVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
      ) {
        playbackAuthority?.dispatch({ type: 'video_persistent_freeze', reason: 'buffer_health' })
      }

      bufferHealthTimerRef.current = playbackScheduler.setTimeout(
        'video-buffer-health',
        checkBufferHealth,
        BUFFER_HEALTH_CHECK_MS,
      )
    }

    bufferHealthTimerRef.current = playbackScheduler.setTimeout(
      'video-buffer-health',
      checkBufferHealth,
      BUFFER_HEALTH_CHECK_MS,
    )

    return () => {
      playbackScheduler.clear('video-buffer-health')
      bufferHealthTimerRef.current = null
    }
  }, [
    getVideoElement,
    playbackAuthority,
    playbackScheduler,
    shouldUsePlaybackStability,
    shouldVideoBePlaying,
  ])

  useEffect(() => {
    return () => {
      playbackScheduler.clearAll()
      clearTimers([
        bufferHealthTimerRef.current,
        muxRefreshTimerRef.current,
        sessionWarningTimerRef.current,
        manualGuideTimerRef.current,
      ])
      bufferHealthTimerRef.current = null
      muxRefreshTimerRef.current = null
      sessionWarningTimerRef.current = null
      manualGuideTimerRef.current = null
      if (brightnessUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(brightnessUpdateFrameRef.current)
        brightnessUpdateFrameRef.current = null
      }
      if (chromeActivityFrameRef.current !== null) {
        window.cancelAnimationFrame(chromeActivityFrameRef.current)
        chromeActivityFrameRef.current = null
      }
      releaseBodyScrollLockRef.current?.()
      releaseBodyScrollLockRef.current = null
      singleAvAudioActiveRef.current = false
      setSingleAvAudioActive(false)
      if (primaryVideoControllerRef.current) {
        recordHlsController('primary:unmount', 'destroy')
        primaryVideoControllerRef.current.destroy()
        primaryVideoControllerRef.current = null
      }
      primaryVideoControllerProfileRef.current = null
      resetMedia(primaryVideoRef.current)
      setCurrentVideoSignedUrl(null)
    }
  }, [playbackScheduler, setSingleAvAudioActive])

  useEffect(() => {
    if (audioError === 'Tap or press any key to continue the audio layer.') {
      const frameId = window.requestAnimationFrame(() => {
        playbackAuthority?.dispatch({ type: 'audio_autoplay_blocked' })
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [audioError, playbackAuthority])

  const handleResumePlayback = useCallback(() => {
    resetSessionContinuityTimer()
    systemPausedRef.current = false
    playbackAuthority?.dispatch({ type: 'user_resume_requested' })
  }, [playbackAuthority, resetSessionContinuityTimer])

  const handleRetryInitialization = useCallback(() => {
    logExpressPlaybackDebug('init_retry_tapped', {
      experience,
      mode: sessionConfig.videoMode,
    })
    setInitFailureVisible(false)
    setVideoError(null)
    resetPlaybackHealth()
    setInitRetryKey((currentValue) => currentValue + 1)
  }, [experience, resetPlaybackHealth, sessionConfig.videoMode])

  const handleReloadSession = useCallback(() => {
    logExpressPlaybackDebug('health_reload_session', {
      experience,
      mode: sessionConfig.videoMode,
      sessionType,
    })
    onClose()
    window.requestAnimationFrame(() => {
      startSession(sessionType, { source: isAdminPreview ? 'admin' : 'member' })
    })
  }, [experience, isAdminPreview, onClose, sessionConfig.videoMode, sessionType, startSession])

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
  const brightnessFillPercent = `${brightnessPercent}%`
  const debugChromePinned =
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.location.search.includes('rayd8PlayerDebug=true')
  const shouldShowChrome =
    debugChromePinned ||
    chromeVisible ||
    activePanel !== null ||
    isVideoLoading ||
    interactionRequired ||
    exitPromptOpen
  const performancePresentationMode = playbackPresentationMode === 'performance'

  const updateBrightnessFromClientY = useCallback((clientY: number) => {
    const track = brightnessTrackRef.current

    if (!track) {
      return
    }

    const rect = track.getBoundingClientRect()
    const offset = rect.bottom - clientY
    const percent = (offset / rect.height) * 100

    pendingBrightnessPercentRef.current = clampPercent(percent)

    if (brightnessUpdateFrameRef.current !== null) {
      return
    }

    brightnessUpdateFrameRef.current = window.requestAnimationFrame(() => {
      brightnessUpdateFrameRef.current = null
      setBrightnessPercent((currentValue) =>
        currentValue === pendingBrightnessPercentRef.current
          ? currentValue
          : pendingBrightnessPercentRef.current,
      )
    })
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

    const removeMoveListener = addTrackedDomEventListener(
      window,
      'pointermove',
      handlePointerMove as EventListener,
      'window:pointermove:brightness',
    )
    const removeUpListener = addTrackedDomEventListener(
      window,
      'pointerup',
      stopDragging,
      'window:pointerup:brightness',
    )
    const removeCancelListener = addTrackedDomEventListener(
      window,
      'pointercancel',
      stopDragging,
      'window:pointercancel:brightness',
    )

    return () => {
      removeMoveListener()
      removeUpListener()
      removeCancelListener()
    }
  }, [updateBrightnessFromClientY])

  return (
    <>
      <div
        className={[
          'relative flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black transition-[opacity,transform] duration-300',
          isPseudoFullscreen ? 'touch-manipulation' : '',
        ].join(' ')}
        onClick={pingChromeVisibility}
        onPointerDown={pingChromeVisibility}
        onPointerMove={scheduleChromeVisibilityPing}
        ref={playerRootRef}
      >
        <VideoSurface
          brightnessPercent={brightnessPercent}
          onPointerUp={handleVideoSurfacePointerUp}
          performanceMode={performancePresentationMode}
          videoRef={setPrimaryVideoElement}
          shouldBlurForTrialBlock={shouldBlurForTrialBlock}
        />
        <OverlayLayer
          amplifierMode={sessionConfig.amplification}
          blueLightEnabled={blueLightEnabled}
          circadianEnabled={circadianEnabled}
          nightModeEnabled={nightModeEnabled}
          performanceMode={performancePresentationMode}
        />
        <PlayerPerformanceNotice
          playbackState={`${playbackPresentation.machine}:${playbackPresentation.legacyPlaybackState}`}
          smoothPlaybackMode={smoothPlaybackMode}
          sourceUrl={currentVideoSignedUrl}
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

        {isPreloading ? <PreloadOverlay preloadPercent={preloadPercent} /> : null}

        {interactionRequired ? (
          <InteractionRequiredOverlay onResume={() => void handleResumePlayback()} />
        ) : null}

        {playbackHealthFallbackVisible && !activeSoftDenialState ? (
          <PlaybackHealthFallbackOverlay
            onReloadSession={handleReloadSession}
            onReturnHome={onClose}
            onTryAgain={handleRetryInitialization}
          />
        ) : null}

        {initFailureVisible && !activeSoftDenialState && !playbackHealthFallbackVisible ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/78 p-6 text-center">
            <div className="max-w-sm rounded-[2rem] border border-white/12 bg-slate-950/92 p-6 text-white shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/70">
                Session interrupted
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Unable to initialize session.
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                The session did not become ready. Try again when the app is foregrounded and connected.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  className="rounded-2xl bg-[linear-gradient(135deg,rgba(16,185,129,0.95),rgba(59,130,246,0.92))] px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5"
                  onClick={handleRetryInitialization}
                  type="button"
                >
                  Tap to Retry
                </button>
                <button
                  className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/5"
                  onClick={onClose}
                  type="button"
                >
                  Exit session
                </button>
              </div>
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
          <UsageWarningOverlay
            smallScreenViewport={smallScreenViewport}
            usageWarningState={usageWarningState}
          />
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
              playerControlSizing.dockOuterClassName,
              shouldShowChrome ? 'pointer-events-auto' : 'pointer-events-none',
            ].join(' ')}
            ref={controlDockRef}
          >
            {activePanel ? (
              <div className={playerControlSizing.flyoutClassName}>
                <div
                  className={playerControlSizing.flyoutScrollClassName}
                  style={
                    playerControlSizing.flyoutMaxHeight
                      ? {
                          ...playerControlSizing.flyoutScrollStyle,
                          maxHeight: playerControlSizing.flyoutMaxHeight,
                        }
                      : undefined
                  }
                >
                  {activePanel === 'mode' ? (
                    <FlyoutPanel sizing={playerControlSizing} title="Motion state">
                      <div className={playerControlSizing.flyoutGridClassName}>
                        {videoModes.map(([modeKey, modeValue]) => {
                          const isActive = sessionConfig.videoMode === modeKey

                          return (
                            <FlyoutOptionButton
                              active={isActive}
                              key={modeKey}
                              onClick={() => setVideoMode(modeKey as FreeTrialVideoMode)}
                              sizing={playerControlSizing}
                            >
                              <span>{modeValue.label}</span>
                              {isActive ? <StatusPill label="Active" sizing={playerControlSizing} /> : null}
                            </FlyoutOptionButton>
                          )
                        })}
                      </div>
                    </FlyoutPanel>
                  ) : null}

                  {activePanel === 'audio' ? (
                    <FlyoutPanel
                      meta={isAudioLoading ? 'Updating sound layer...' : 'Independent from video mode switching'}
                      sizing={playerControlSizing}
                      title="Audio track"
                    >
                      <div className={playerControlSizing.flyoutGridClassName}>
                        {audioTracks.map(([audioKey, audioValue]) => {
                          const isActive = audioTrack === audioKey

                          return (
                            <FlyoutOptionButton
                              active={isActive}
                              key={audioKey}
                              onClick={() =>
                                handleAudioTrackChange(audioKey as keyof typeof FREE_TRIAL_AUDIO_TRACKS)
                              }
                              sizing={playerControlSizing}
                            >
                              <span>{audioValue.label}</span>
                              {isActive ? <StatusPill label="Active" sizing={playerControlSizing} /> : null}
                            </FlyoutOptionButton>
                          )
                        })}
                      </div>
                    </FlyoutPanel>
                  ) : null}

                  {activePanel === 'volume' ? (
                    <FlyoutPanel
                      meta={audioIsSilent ? 'Muted' : `${Math.round(audioVolume * 100)}%`}
                      sizing={playerControlSizing}
                      title="Volume"
                    >
                      <div className={playerControlSizing.volumePanelClassName}>
                        <button
                          className={playerControlSizing.volumeButtonClassName}
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
                    <FlyoutPanel sizing={playerControlSizing} title="Amplifiers">
                      <div className={`${playerControlSizing.flyoutGridClassName} grid-cols-2`}>
                        {(['off', '5x', '10x', '20x'] as const).map((amplification) => (
                          <FlyoutOptionButton
                            active={sessionConfig.amplification === amplification}
                            key={amplification}
                            onClick={() => setAmplification(amplification)}
                            sizing={playerControlSizing}
                          >
                            <span>{amplification === 'off' ? 'Off' : amplification}</span>
                            {sessionConfig.amplification === amplification ? (
                              <StatusPill label="Active" sizing={playerControlSizing} />
                            ) : null}
                          </FlyoutOptionButton>
                        ))}
                      </div>
                    </FlyoutPanel>
                  ) : null}

                  {activePanel === 'gear' ? (
                    <FlyoutPanel sizing={playerControlSizing} title="Gearbox">
                      <div className={playerControlSizing.flyoutGridClassName}>
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
                            sizing={playerControlSizing}
                          >
                            <span>{item.label}</span>
                            <StatusPill label={item.checked ? 'On' : 'Off'} sizing={playerControlSizing} />
                          </FlyoutOptionButton>
                        ))}
                      </div>
                    </FlyoutPanel>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className={playerControlSizing.dockInnerClassName}>
              <div className={playerControlSizing.dockRowClassName}>
                <GuideControlButton onClick={openManualGuide} sizing={playerControlSizing} />
                <CompactIconButton
                  active={activePanel === 'mode'}
                  ariaLabel={`Select motion state. Current ${videoModeLabel}`}
                  onClick={() => setActivePanel((currentValue) => (currentValue === 'mode' ? null : 'mode'))}
                  sizing={playerControlSizing}
                  title={videoModeLabel}
                >
                  <MotionIcon />
                </CompactIconButton>
                <CompactIconButton
                  active={activePanel === 'audio'}
                  ariaLabel={`Select audio track. Current ${audioTrackLabel}`}
                  onClick={() => setActivePanel((currentValue) => (currentValue === 'audio' ? null : 'audio'))}
                  sizing={playerControlSizing}
                  title={audioTrackLabel}
                >
                  <AudioTrackIcon />
                </CompactIconButton>
                <CompactIconButton
                  active={activePanel === 'volume'}
                  ariaLabel={`Adjust volume. Current ${audioIsSilent ? 'muted' : `${Math.round(audioVolume * 100)} percent`}`}
                  onClick={() => setActivePanel((currentValue) => (currentValue === 'volume' ? null : 'volume'))}
                  sizing={playerControlSizing}
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
                  sizing={playerControlSizing}
                  title={`Amplifier ${amplificationLabel}`}
                >
                  <AmplifierIcon />
                </CompactIconButton>
                <CompactIconButton
                  active={activePanel === 'gear'}
                  ariaLabel="Open gearbox settings"
                  onClick={() => setActivePanel((currentValue) => (currentValue === 'gear' ? null : 'gear'))}
                  sizing={playerControlSizing}
                  title="Gearbox"
                >
                  <GearIcon />
                </CompactIconButton>
                <CompactIconButton
                  active={isFullscreen}
                  ariaLabel={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
                  onClick={() => void toggleFullscreen()}
                  sizing={playerControlSizing}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  <FullscreenIcon active={isFullscreen} />
                </CompactIconButton>
              </div>
            </div>

            {(videoError || audioError) && !trialOverlayState ? (
              <div className={playerControlSizing.errorClassName}>
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
  sizing,
  title,
}: {
  children: ReactNode
  meta?: string
  sizing: PlayerControlSizing
  title: string
}) {
  return (
    <div>
      <div className={sizing.flyoutPanelHeaderClassName}>
        <p className={sizing.flyoutPanelTitleClassName}>{title}</p>
        {meta ? <p className={sizing.flyoutPanelMetaClassName}>{meta}</p> : null}
      </div>
      {children}
    </div>
  )
}

function FlyoutOptionButton({
  active,
  children,
  onClick,
  sizing,
}: {
  active?: boolean
  children: ReactNode
  onClick: () => void
  sizing: PlayerControlSizing
}) {
  return (
    <button
      className={[
        sizing.flyoutOptionClassName,
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

function StatusPill({ label, sizing }: { label: string; sizing: PlayerControlSizing }) {
  return (
    <span className={sizing.statusPillClassName}>
      {label}
    </span>
  )
}

function GuideControlButton({
  onClick,
  sizing,
}: {
  onClick: () => void
  sizing: PlayerControlSizing
}) {
  return (
    <button
      aria-label="Guide"
      className={sizing.guideButtonClassName}
      onClick={onClick}
      type="button"
    >
      <GuideIcon />
      <span className={sizing.guideLabelClassName}>Guide</span>
    </button>
  )
}

function CompactIconButton({
  active = false,
  ariaLabel,
  children,
  onClick,
  sizing,
  title,
}: {
  active?: boolean
  ariaLabel: string
  children: ReactNode
  onClick: () => void
  sizing: PlayerControlSizing
  title: string
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={[
        sizing.iconButtonClassName,
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
