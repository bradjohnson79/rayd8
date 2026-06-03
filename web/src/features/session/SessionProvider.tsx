/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PropsWithChildren,
} from 'react'
import type { Experience, SessionType } from '../../app/types'
import {
  AUDIO_STORAGE_KEY,
  DEFAULT_SHARED_AUDIO_TRACK,
  FREE_TRIAL_AUDIO_TRACKS,
  getExperienceFromSessionType,
  isSharedAudioTrack,
  type SharedAudioTrack,
} from '../../config/rayd8Expansion'
import { getAdminMuxPlaybackToken } from '../../services/admin'
import {
  computeMuxPlaybackExpiryMs,
  endPlaybackSession,
  getMemberPlaybackToken,
  heartbeatPlaybackSession,
  startPlaybackSession,
  type ExperienceAccessSummary,
  type MuxPlaybackPayload,
} from '../../services/player'
import { ApiRequestError } from '../../services/api'
import {
  getExperiencePreviewLimitContent,
  getTrialBlockContent,
  isFreeExperiencePreviewBlockReason,
  isTrialBlockReason,
  RESTRICTION_UPGRADE_ACTIONS,
  type UpgradeAction,
} from '../../services/trial'
import { trackUmamiEvent } from '../../services/umami'
import { SESSION_RESUME_MESSAGE, useAuthReadiness } from '../auth/useAuthReadiness'
import {
  createPlaybackAuthority,
  type PlaybackAuthorityController,
} from '../playback-authority/playbackAuthority'
import {
  destroyHlsController,
  resetMedia,
  setMediaSource,
  tryPlayAudio,
  type HlsController,
  type TryPlayResult,
} from '../rayd8-player/mediaController'
import { AUDIO_UNLOCK_PROMPT } from '../rayd8-player/audioUnlock'
import { logExpressPlaybackDebug } from '../rayd8-player/expressPlaybackDebug'
import { PlaybackScheduler } from '../rayd8-player/playbackScheduler'

const PlaybackAuthorityContext = createContext<PlaybackAuthorityController | null>(null)

export function usePlaybackAuthority(): PlaybackAuthorityController | null {
  return useContext(PlaybackAuthorityContext)
}

type SessionSource = 'member' | 'admin'

interface SessionState {
  isActive: boolean
  sessionSource: SessionSource
  sessionType: SessionType | null
}

interface AudioState {
  audioMuted: boolean
  audioTrack: SharedAudioTrack
  audioVolume: number
}

interface SoftDenialState {
  ctaLabel?: string
  ctaTo?: string
  description: string
  eyebrow?: string
  title: string
  upgradeActions?: UpgradeAction[]
}

interface UsageWarningState {
  description: string
  title: string
}

interface SessionContextValue extends SessionState, AudioState {
  audioError: string | null
  endSession: () => void
  experienceAccess: Partial<Record<Experience, ExperienceAccessSummary>>
  isAudioLoading: boolean
  resumeAudioPlayback: () => Promise<boolean>
  setAudioMuted: (nextValue: boolean) => void
  setAudioTrack: (nextValue: SharedAudioTrack) => void
  setAudioVolume: (nextValue: number) => void
  setSingleAvAudioActive: (nextValue: boolean) => void
  softDenialState: SoftDenialState | null
  startSession: (type: SessionType, options?: { source?: SessionSource }) => void
  updateExperienceAccess: (nextValue: ExperienceAccessSummary | null) => void
  usageWarningState: UsageWarningState | null
}

const HEARTBEAT_MS = 30_000
const SOFT_DENIAL_EXIT_MS = 3_500
const UPGRADE_PATH = '/subscription?plan=regen'
const AUDIO_RECOVERY_COOLDOWN_MS = 30_000
const AUDIO_HEALTH_CHECK_MS = 60_000
/** Align with primary video: refresh Mux JWT before streaming endpoints reject the old token. */
const MUX_AUDIO_REFRESH_LEAD_MS = 90_000
const MUX_AUDIO_REFRESH_MIN_DELAY_MS = 30 * 60 * 1000
const AUDIO_STABILITY_PROFILE = {
  backBufferLength: 90,
  maxBufferLength: 40,
  maxMaxBufferLength: 120,
}
const AUDIO_LAYER_UNAVAILABLE_MESSAGE = 'Unable to load the current audio layer.'

const SessionContext = createContext<SessionContextValue | null>(null)

function clearTimer(timerRef: MutableRefObject<number | null>) {
  if (timerRef.current !== null) {
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
}

function readAudioState(): AudioState {
  if (typeof window === 'undefined') {
    return {
      audioMuted: false,
      audioTrack: DEFAULT_SHARED_AUDIO_TRACK,
      audioVolume: 0.8,
    }
  }

  const rawValue = window.localStorage.getItem(AUDIO_STORAGE_KEY)

  if (!rawValue) {
    return {
      audioMuted: false,
      audioTrack: DEFAULT_SHARED_AUDIO_TRACK,
      audioVolume: 0.8,
    }
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AudioState>

    return {
      audioMuted: parsed.audioMuted === true,
      audioTrack: isSharedAudioTrack(parsed.audioTrack)
        ? parsed.audioTrack
        : DEFAULT_SHARED_AUDIO_TRACK,
      audioVolume:
        typeof parsed.audioVolume === 'number' && Number.isFinite(parsed.audioVolume)
          ? Math.max(0, Math.min(1, parsed.audioVolume))
          : 0.8,
    }
  } catch {
    return {
      audioMuted: false,
      audioTrack: DEFAULT_SHARED_AUDIO_TRACK,
      audioVolume: 0.8,
    }
  }
}

function persistAudioState(nextValue: AudioState) {
  if (typeof window === 'undefined') {
    return
  }

  const serializedValue = JSON.stringify(nextValue)

  if (window.localStorage.getItem(AUDIO_STORAGE_KEY) === serializedValue) {
    return
  }

  window.localStorage.setItem(AUDIO_STORAGE_KEY, serializedValue)
}

function getAudioPlaybackFailureMessage(result: TryPlayResult) {
  if (result.ok) {
    return null
  }

  switch (result.reason) {
    case 'NotAllowedError':
      return AUDIO_UNLOCK_PROMPT
    case 'DocumentNotVisible':
      return 'Audio will resume when the session tab is visible.'
    case 'MediaElementMissing':
    case 'MediaNotConnected':
    case 'MediaSourceMissing':
    case 'PlaybackSurfaceNotReady':
      return AUDIO_LAYER_UNAVAILABLE_MESSAGE
    case 'UnknownError':
      return result.message ?? AUDIO_LAYER_UNAVAILABLE_MESSAGE
  }
}

async function fadeTo(media: HTMLMediaElement | null, targetVolume: number, durationMs: number) {
  if (!media) {
    return
  }

  const startingVolume = media.volume
  const delta = targetVolume - startingVolume
  const steps = 8

  for (let step = 1; step <= steps; step += 1) {
    media.volume = Math.max(0, Math.min(1, startingVolume + (delta * step) / steps))

    await new Promise((resolve) => {
      window.setTimeout(resolve, durationMs / steps)
    })
  }

  media.volume = targetVolume
}

function toSoftDenialState(access: ExperienceAccessSummary): SoftDenialState | null {
  if (access.state !== 'soft_denied') {
    return null
  }

  const sessionLabel =
    access.experience === 'regen'
      ? 'REGEN'
      : access.experience === 'premium'
        ? 'Premium'
        : 'Expansion'

  if (access.blockReason === 'regen_total_limit_reached') {
    return {
      description:
        'Your REGEN plan has reached the current monthly watch limit. Returning you to the dashboard to review usage and plan options.',
      title: "You've reached your monthly watch limit",
    }
  }

  if (access.blockReason?.startsWith('free_')) {
    const content = getExperiencePreviewLimitContent()

    return {
      description: content.description,
      title: content.title,
      upgradeActions: RESTRICTION_UPGRADE_ACTIONS,
    }
  }

  return {
    description: `You have reached the ${sessionLabel} session limit for the current plan. Returning you to the dashboard with upgrade options.`,
    title: `You've reached your ${sessionLabel} session limit`,
  }
}

function toRestrictionSoftDenialState(errorMessage: string): SoftDenialState | null {
  if (isTrialBlockReason(errorMessage)) {
    const content = getTrialBlockContent(errorMessage)

    return {
      ctaLabel: 'Upgrade Now',
      ctaTo: UPGRADE_PATH,
      description: content.description,
      title: content.title,
      upgradeActions: RESTRICTION_UPGRADE_ACTIONS,
    }
  }

  if (isFreeExperiencePreviewBlockReason(errorMessage)) {
    const content = getExperiencePreviewLimitContent()

    return {
      description: content.description,
      title: content.title,
      upgradeActions: RESTRICTION_UPGRADE_ACTIONS,
    }
  }

  return null
}

function getApiErrorCode(error: unknown) {
  return error instanceof ApiRequestError ? error.code : null
}

function toAuthSoftDenialState(): SoftDenialState {
  return {
    description: 'Your session ended because we could not confirm that you are still signed in.',
    eyebrow: 'Session expired',
    title: SESSION_RESUME_MESSAGE,
  }
}

function toUsageWarningState(access: ExperienceAccessSummary): UsageWarningState | null {
  if (access.warningState !== 'approaching_limit') {
    return null
  }

  const sessionLabel =
    access.experience === 'regen'
      ? 'REGEN'
      : access.experience === 'premium'
        ? 'Premium'
        : 'Expansion'

  return {
    description:
      access.blockReason === 'regen_total_limit_reached' || access.limitSeconds === 900_000
        ? `${sessionLabel} usage is above 90% of the current billing-cycle allowance.`
        : `${sessionLabel} usage is above 90% of the current allowance.`,
    title:
      access.blockReason === 'regen_total_limit_reached' || access.limitSeconds === 900_000
        ? 'Monthly watch limit approaching'
        : `${sessionLabel} limit approaching`,
  }
}

function accessSummariesEqual(
  currentValue: ExperienceAccessSummary | undefined,
  nextValue: ExperienceAccessSummary,
) {
  return (
    currentValue?.allowed === nextValue.allowed &&
    currentValue?.blockReason === nextValue.blockReason &&
    currentValue?.isBlocked === nextValue.isBlocked &&
    currentValue?.limitSeconds === nextValue.limitSeconds &&
    currentValue?.remainingSeconds === nextValue.remainingSeconds &&
    currentValue?.state === nextValue.state &&
    currentValue?.usagePercent === nextValue.usagePercent &&
    currentValue?.usedSeconds === nextValue.usedSeconds &&
    currentValue?.warningState === nextValue.warningState
  )
}

function usageWarningStatesEqual(
  currentValue: UsageWarningState | null,
  nextValue: UsageWarningState | null,
) {
  return (
    currentValue?.title === nextValue?.title &&
    currentValue?.description === nextValue?.description
  )
}

export function SessionProvider({ children }: PropsWithChildren) {
  const { getTokenSafe, status: authStatus } = useAuthReadiness()
  const [playbackAuthority, setPlaybackAuthority] = useState<PlaybackAuthorityController | null>(
    null,
  )
  const [sessionScheduler] = useState(() => new PlaybackScheduler())
  const [state, setState] = useState<SessionState>({
    isActive: false,
    sessionSource: 'member',
    sessionType: null,
  })
  const [audioState, setAudioState] = useState<AudioState>(() => readAudioState())
  const [isAudioLoading, setIsAudioLoading] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [experienceAccess, setExperienceAccess] = useState<
    Partial<Record<Experience, ExperienceAccessSummary>>
  >({})
  const [softDenialState, setSoftDenialState] = useState<SoftDenialState | null>(null)
  const [usageWarningState, setUsageWarningState] = useState<UsageWarningState | null>(null)
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null)
  const [singleAvAudioActive, setSingleAvAudioActive] = useState(false)
  const audioResumeRef = useRef<() => Promise<boolean>>(async () => true)
  const softDenialTimerRef = useRef<number | null>(null)
  const trackingSessionIdRef = useRef<string | null>(null)

  useEffect(() => {
    trackingSessionIdRef.current = trackingSessionId
  }, [trackingSessionId])

  useEffect(() => {
    persistAudioState(audioState)
  }, [audioState])

  const updateExperienceAccess = useCallback((nextValue: ExperienceAccessSummary | null) => {
    if (!nextValue) {
      return
    }

    setExperienceAccess((currentValue) => {
      if (accessSummariesEqual(currentValue[nextValue.experience], nextValue)) {
        return currentValue
      }

      return {
        ...currentValue,
        [nextValue.experience]: nextValue,
      }
    })
  }, [])

  const finalizeTrackedSession = useCallback(
    async (sessionId: string | null) => {
      if (!sessionId) {
        return
      }

      const tokenResult = await getTokenSafe()

      if (!tokenResult.token) {
        return
      }

      try {
        const response = await endPlaybackSession(sessionId, tokenResult.token)
        updateExperienceAccess(response.access)
      } catch {
        // Keep end-session cleanup best-effort so the UI can close immediately.
      }
    },
    [getTokenSafe, updateExperienceAccess],
  )

  const endSession = useCallback(() => {
    const currentTrackingSessionId = trackingSessionIdRef.current

    setPlaybackAuthority((previous) => {
      previous?.dispose()
      return null
    })

    clearTimer(softDenialTimerRef)
    setTrackingSessionId(null)
    setSoftDenialState(null)
    setUsageWarningState(null)
    setAudioError(null)
    setSingleAvAudioActive(false)
    setState({
      isActive: false,
      sessionSource: 'member',
      sessionType: null,
    })

    if (currentTrackingSessionId) {
      void finalizeTrackedSession(currentTrackingSessionId)
    }
  }, [finalizeTrackedSession])

  const startSession = useCallback((type: SessionType, options?: { source?: SessionSource }) => {
    clearTimer(softDenialTimerRef)
    setPlaybackAuthority((previous) => {
      previous?.dispose()
      return createPlaybackAuthority()
    })

    setSoftDenialState(null)
    setUsageWarningState(null)
    setAudioError(null)
    setSingleAvAudioActive(false)
    setTrackingSessionId(null)
    setState({
      isActive: true,
      sessionSource: options?.source ?? 'member',
      sessionType: type,
    })
  }, [])

  const scheduleSoftDenialExit = useCallback(
    (nextState: SoftDenialState | null) => {
      if (!nextState) {
        return
      }

      clearTimer(softDenialTimerRef)
      setSoftDenialState(nextState)
      if (nextState.ctaTo || nextState.upgradeActions?.length) {
        return
      }
      softDenialTimerRef.current = sessionScheduler.setTimeout('soft-denial-exit', () => {
        endSession()
      }, SOFT_DENIAL_EXIT_MS)
    },
    [endSession, sessionScheduler],
  )

  useEffect(() => {
    if (!state.isActive || state.sessionSource !== 'member' || !state.sessionType) {
      return
    }

    if (authStatus === 'loading') {
      return
    }

    let cancelled = false
    const experience = getExperienceFromSessionType(state.sessionType)

    async function beginTracking() {
      const tokenResult = await getTokenSafe()

      if (cancelled) {
        return
      }

      if (!tokenResult.token) {
        if (tokenResult.error === 'loading') {
          return
        }

        clearTimer(softDenialTimerRef)
        setTrackingSessionId(null)
        setUsageWarningState(null)
        scheduleSoftDenialExit(toAuthSoftDenialState())
        return
      }

      try {
        const response = await startPlaybackSession(experience, tokenResult.token)

        if (import.meta.env.DEV) {
          console.log('SESSION RESPONSE:', response)
        }

        if (cancelled) {
          return
        }

        updateExperienceAccess(response.access)
        setUsageWarningState((currentValue) => {
          const nextValue = toUsageWarningState(response.access)
          return usageWarningStatesEqual(currentValue, nextValue) ? currentValue : nextValue
        })
        trackUmamiEvent('start_session', {
          experience,
          sessionType: state.sessionType,
        })
        setTrackingSessionId(response.session.id)
      } catch (error) {
        if (!cancelled) {
          const restrictionSoftDenial = toRestrictionSoftDenialState(
            getApiErrorCode(error) ?? (error instanceof Error ? error.message : ''),
          )

          if (restrictionSoftDenial) {
            clearTimer(softDenialTimerRef)
            setSoftDenialState(restrictionSoftDenial)
            setUsageWarningState(null)
            setAudioError(null)
            return
          }

          if (error instanceof ApiRequestError && error.status === 401) {
            clearTimer(softDenialTimerRef)
            setTrackingSessionId(null)
            setUsageWarningState(null)
            scheduleSoftDenialExit(toAuthSoftDenialState())
            return
          }

          setAudioError(
            error instanceof Error ? error.message : 'Unable to start the playback session.',
          )
          setPlaybackAuthority((previous) => {
            previous?.dispose()
            return null
          })
          setState({
            isActive: false,
            sessionSource: 'member',
            sessionType: null,
          })
        }
      }
    }

    void beginTracking()

    return () => {
      cancelled = true
    }
  }, [
    authStatus,
    finalizeTrackedSession,
    getTokenSafe,
    scheduleSoftDenialExit,
    state.isActive,
    state.sessionSource,
    state.sessionType,
    updateExperienceAccess,
  ])

  useEffect(() => {
    if (!trackingSessionId || !state.isActive || state.sessionSource !== 'member') {
      return
    }

    if (authStatus === 'loading') {
      return
    }

    let cancelled = false

    const heartbeat = async () => {
      const tokenResult = await getTokenSafe()

      if (cancelled) {
        return
      }

      if (!tokenResult.token) {
        if (tokenResult.error === 'loading') {
          return
        }

        clearTimer(softDenialTimerRef)
        setTrackingSessionId(null)
        setUsageWarningState(null)
        scheduleSoftDenialExit(toAuthSoftDenialState())
        return
      }

      try {
        const response = await heartbeatPlaybackSession(trackingSessionId, tokenResult.token)

        if (cancelled) {
          return
        }

        updateExperienceAccess(response.access)
        setUsageWarningState((currentValue) => {
          const nextValue = toUsageWarningState(response.access)
          return usageWarningStatesEqual(currentValue, nextValue) ? currentValue : nextValue
        })
        scheduleSoftDenialExit(toSoftDenialState(response.access))
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 401) {
          clearTimer(softDenialTimerRef)
          setTrackingSessionId(null)
          setUsageWarningState(null)
          scheduleSoftDenialExit(toAuthSoftDenialState())
          return
        }

        const restrictionSoftDenial = toRestrictionSoftDenialState(
          getApiErrorCode(error) ?? (error instanceof Error ? error.message : ''),
        )

        if (restrictionSoftDenial) {
          clearTimer(softDenialTimerRef)
          setTrackingSessionId(null)
          setUsageWarningState(null)
          setSoftDenialState(restrictionSoftDenial)
          void finalizeTrackedSession(trackingSessionId)
        }
      }
    }

    sessionScheduler.setInterval('usage-heartbeat', () => {
      void heartbeat()
    }, HEARTBEAT_MS)

    return () => {
      cancelled = true
      sessionScheduler.clear('usage-heartbeat')
    }
  }, [
    authStatus,
    finalizeTrackedSession,
    getTokenSafe,
    scheduleSoftDenialExit,
    sessionScheduler,
    state.isActive,
    state.sessionSource,
    trackingSessionId,
    updateExperienceAccess,
  ])

  useEffect(
    () => () => {
      sessionScheduler.clearAll()
      clearTimer(softDenialTimerRef)
    },
    [sessionScheduler],
  )

  const value = useMemo<SessionContextValue>(
    () => ({
      ...audioState,
      ...state,
      audioError,
      endSession,
      experienceAccess,
      isAudioLoading,
      resumeAudioPlayback: () => audioResumeRef.current(),
      setAudioMuted: (nextValue) => {
        setAudioState((currentState) => ({
          ...currentState,
          audioMuted: nextValue,
        }))
      },
      setAudioTrack: (nextValue) => {
        setAudioState((currentState) => ({
          ...currentState,
          audioTrack: nextValue,
        }))
      },
      setAudioVolume: (nextValue) => {
        setAudioState((currentState) => ({
          ...currentState,
          audioVolume: Math.max(0, Math.min(1, nextValue)),
        }))
      },
      setSingleAvAudioActive,
      softDenialState,
      startSession,
      updateExperienceAccess,
      usageWarningState,
    }),
    [
      audioError,
      audioState,
      endSession,
      experienceAccess,
      isAudioLoading,
      softDenialState,
      startSession,
      state,
      updateExperienceAccess,
      usageWarningState,
    ],
  )

  return (
    <PlaybackAuthorityContext.Provider value={playbackAuthority}>
      <SessionContext.Provider value={value}>
        {children}
        <GlobalAudioRail
          audioMuted={audioState.audioMuted}
          audioTrack={audioState.audioTrack}
          audioVolume={audioState.audioVolume}
          isActive={state.isActive}
          onAudioErrorChange={setAudioError}
          onAudioLoadingChange={setIsAudioLoading}
          onResumeHandlerChange={(handler) => {
            audioResumeRef.current = handler
          }}
          sessionSource={state.sessionSource}
          sessionType={state.sessionType}
          singleAvAudioActive={singleAvAudioActive}
        />
      </SessionContext.Provider>
    </PlaybackAuthorityContext.Provider>
  )
}

function GlobalAudioRail({
  audioMuted,
  audioTrack,
  audioVolume,
  isActive,
  onAudioErrorChange,
  onAudioLoadingChange,
  onResumeHandlerChange,
  sessionSource,
  sessionType,
  singleAvAudioActive,
}: {
  audioMuted: boolean
  audioTrack: SharedAudioTrack
  audioVolume: number
  isActive: boolean
  onAudioErrorChange: (nextValue: string | null) => void
  onAudioLoadingChange: (nextValue: boolean) => void
  onResumeHandlerChange: (handler: () => Promise<boolean>) => void
  sessionSource: SessionSource
  sessionType: SessionType | null
  singleAvAudioActive: boolean
}) {
  const playbackAuthority = usePlaybackAuthority()
  const { getTokenSafe } = useAuthReadiness()
  const [audioScheduler] = useState(() => new PlaybackScheduler())
  const audioControllerRef = useRef<HlsController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioRequestRef = useRef(0)
  const audioHealthTimerRef = useRef<number | null>(null)
  const muxAudioRefreshTimerRef = useRef<number | null>(null)
  const pauseRecoveryTimerRef = useRef<number | null>(null)
  const currentAudioAssetIdRef = useRef<string | null>(null)
  const currentAudioSourceUrlRef = useRef<string | null>(null)
  const audioMutedRef = useRef(audioMuted)
  const audioVolumeRef = useRef(audioVolume)
  const lastAudioRecoveryTimestampRef = useRef(0)
  const lastKnownVolumeRef = useRef(audioVolume)

  const currentExperience = useMemo<Experience | null>(
    () => (sessionType ? getExperienceFromSessionType(sessionType) : null),
    [sessionType],
  )

  const handleAudioPlayFailure = useCallback(
    (result: TryPlayResult) => {
      if (result.ok) {
        return
      }

      const message = getAudioPlaybackFailureMessage(result)
      const audio = audioRef.current

      if (message) {
        onAudioErrorChange(message)
      }

      if (result.reason === 'NotAllowedError') {
        logExpressPlaybackDebug('audio_unlock_required', {
          currentSrc: audio?.currentSrc ?? '',
          reason: result.reason,
          readyState: audio?.readyState ?? 0,
        })
        playbackAuthority?.dispatch({ type: 'audio_autoplay_blocked' })
        return
      }

      playbackAuthority?.dispatch({ type: 'audio_error' })
    },
    [onAudioErrorChange, playbackAuthority],
  )

  const resumeAudioPlayback = useCallback(async () => {
    const audio = audioRef.current

    logExpressPlaybackDebug('audio_unlock_attempt', {
      currentSrc: audio?.currentSrc ?? '',
      reason: 'resume_requested',
      readyState: audio?.readyState ?? 0,
    })

    const result = await tryPlayAudio(audioRef.current)

    if (result.ok) {
      onAudioErrorChange(null)

      if (audioRef.current && !audioMutedRef.current) {
        await fadeTo(audioRef.current, audioVolumeRef.current, 280)
      }

      playbackAuthority?.dispatch({ type: 'lifecycle_play_attempt_finished', ok: true })
      logExpressPlaybackDebug('audio_unlock_success', {
        currentSrc: audioRef.current?.currentSrc ?? '',
        reason: 'resume_succeeded',
        readyState: audioRef.current?.readyState ?? 0,
      })
      return true
    }

    handleAudioPlayFailure(result)
    logExpressPlaybackDebug('audio_unlock_failed', {
      currentSrc: audioRef.current?.currentSrc ?? '',
      reason: result.reason,
      readyState: audioRef.current?.readyState ?? 0,
    })
    return false
  }, [handleAudioPlayFailure, onAudioErrorChange, playbackAuthority])

  useEffect(() => {
    onResumeHandlerChange(resumeAudioPlayback)

    return () => {
      onResumeHandlerChange(async () => true)
    }
  }, [onResumeHandlerChange, resumeAudioPlayback])

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    audio.preload = 'metadata'
    audio.setAttribute('playsinline', 'true')
  }, [])

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    audioMutedRef.current = audioMuted
    audioVolumeRef.current = audioVolume
    lastKnownVolumeRef.current = audioMuted ? lastKnownVolumeRef.current : audioVolume
    audio.muted = audioMuted
    audio.volume = audioMuted ? 0 : audioVolume
  }, [audioMuted, audioVolume])

  const shouldAudioBePlaying = useCallback(() => {
    return Boolean(isActive && currentExperience && audioTrack !== 'none')
  }, [audioTrack, currentExperience, isActive])

  const recoverAudioPlayback = useCallback(
    async (reason: 'pause' | 'stalled' | 'error' | 'health-check') => {
      const audio = audioRef.current

      if (!audio || !shouldAudioBePlaying()) {
        return false
      }

      if (
        typeof document !== 'undefined' &&
        document.hidden &&
        reason !== 'error'
      ) {
        return false
      }

      const now = Date.now()

      if (now - lastAudioRecoveryTimestampRef.current < AUDIO_RECOVERY_COOLDOWN_MS) {
        return false
      }

      lastAudioRecoveryTimestampRef.current = now

      try {
        if (!audioMuted) {
          audio.muted = false
          audio.volume = audio.volume === 0 ? lastKnownVolumeRef.current : audio.volume
        }

        if (reason === 'error' && currentAudioSourceUrlRef.current) {
          const storedTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0

          await setMediaSource({
            controllerRef: audioControllerRef,
            generationRef: audioRequestRef,
            media: audio,
            requestGeneration: audioRequestRef.current,
            sourceUrl: currentAudioSourceUrlRef.current,
            stabilityProfile: AUDIO_STABILITY_PROFILE,
          })

          try {
            audio.currentTime = storedTime
          } catch {
            // Ignore failed corrective seeks while the audio stream is recovering.
          }

          if (!audioMuted) {
            audio.muted = false
            audio.volume = lastKnownVolumeRef.current
          }
        }

        const result = await tryPlayAudio(audio)
        return result.ok
      } catch {
        return false
      }
    },
    [audioMuted, shouldAudioBePlaying],
  )

  useEffect(() => {
    const auth = playbackAuthority

    if (!isActive || !auth || !currentExperience) {
      return
    }

    const noopAudio = {
      attemptMajorRecovery: async () => true,
      attemptSoftResume: async () => true,
    }

    if (singleAvAudioActive || audioTrack === 'none') {
      auth.registerAudioDelegate(noopAudio)

      return () => auth.clearAudioDelegate()
    }

    auth.registerAudioDelegate({
      attemptMajorRecovery: async (reason) =>
        recoverAudioPlayback(reason === 'health-check' ? 'health-check' : 'error'),
      attemptSoftResume: resumeAudioPlayback,
    })

    return () => auth.clearAudioDelegate()
  }, [
    audioTrack,
    currentExperience,
    isActive,
    playbackAuthority,
    recoverAudioPlayback,
    resumeAudioPlayback,
    singleAvAudioActive,
  ])

  useEffect(() => {
    if (!isActive || !currentExperience || audioTrack === 'none' || singleAvAudioActive) {
      if (muxAudioRefreshTimerRef.current !== null) {
        audioScheduler.clear('audio-mux-refresh')
        muxAudioRefreshTimerRef.current = null
      }
      if (pauseRecoveryTimerRef.current !== null) {
        audioScheduler.clear('audio-pause-recovery')
        pauseRecoveryTimerRef.current = null
      }
      onAudioErrorChange(null)
      onAudioLoadingChange(false)
      resetMedia(audioRef.current)
      destroyHlsController(audioControllerRef)
      currentAudioAssetIdRef.current = null
      currentAudioSourceUrlRef.current = null
      return
    }

    let cancelled = false
    const experience = currentExperience
    const requestId = audioRequestRef.current + 1
    audioRequestRef.current = requestId

    const clearMuxAudioRefreshTimer = () => {
      if (muxAudioRefreshTimerRef.current !== null) {
        audioScheduler.clear('audio-mux-refresh')
        muxAudioRefreshTimerRef.current = null
      }
    }

    async function loadAudioTrack() {
      try {
        onAudioErrorChange(null)
        onAudioLoadingChange(true)

        const trackAssetId =
          FREE_TRIAL_AUDIO_TRACKS[audioTrack as Exclude<SharedAudioTrack, 'none'>].assetId

        if (!trackAssetId) {
          onAudioLoadingChange(false)
          return
        }

        const tokenResult = await getTokenSafe()

        if (!tokenResult.token || cancelled || audioRequestRef.current !== requestId) {
          return
        }

        const playback =
          sessionSource === 'admin'
            ? await getAdminMuxPlaybackToken(trackAssetId, tokenResult.token)
            : await getMemberPlaybackToken(trackAssetId, experience, tokenResult.token)

        if (cancelled || audioRequestRef.current !== requestId) {
          return
        }

        const payload = playback.playback

        currentAudioAssetIdRef.current = trackAssetId
        currentAudioSourceUrlRef.current = payload.signed_url

        clearMuxAudioRefreshTimer()

        const applied = await setMediaSource({
          controllerRef: audioControllerRef,
          generationRef: audioRequestRef,
          media: audioRef.current,
          requestGeneration: requestId,
          sourceUrl: payload.signed_url,
          stabilityProfile: AUDIO_STABILITY_PROFILE,
        })

        if (!applied || cancelled || audioRequestRef.current !== requestId) {
          return
        }

        function scheduleMuxAudioRefreshFromPayload(nextPayload: MuxPlaybackPayload) {
          clearMuxAudioRefreshTimer()
          const msUntilExpiry = computeMuxPlaybackExpiryMs(nextPayload) - Date.now()

          if (msUntilExpiry > MUX_AUDIO_REFRESH_MIN_DELAY_MS) {
            if (import.meta.env.DEV) {
              console.info('[RAYD8] Skipping audio Mux refresh; token has ample lifetime.')
            }
            return
          }

          const delay = Math.max(4000, msUntilExpiry - MUX_AUDIO_REFRESH_LEAD_MS)

          if (import.meta.env.DEV) {
            console.info(`[RAYD8] Scheduling emergency audio Mux refresh in ${Math.round(delay / 1000)}s.`)
          }

          muxAudioRefreshTimerRef.current = audioScheduler.setTimeout('audio-mux-refresh', () => {
            muxAudioRefreshTimerRef.current = null

            if (cancelled || audioRequestRef.current !== requestId) {
              return
            }

            void (async () => {
              try {
                if (import.meta.env.DEV) {
                  console.info('[RAYD8] Running emergency Mux refresh for active audio.')
                }
                const refreshTokenResult = await getTokenSafe()

                if (
                  !refreshTokenResult.token ||
                  cancelled ||
                  audioRequestRef.current !== requestId
                ) {
                  return
                }

                const assetId = currentAudioAssetIdRef.current

                if (!assetId) {
                  return
                }

                const refreshResponse =
                  sessionSource === 'admin'
                    ? await getAdminMuxPlaybackToken(assetId, refreshTokenResult.token)
                    : await getMemberPlaybackToken(assetId, experience, refreshTokenResult.token)

                const refreshedPayload = refreshResponse.playback

                if (cancelled || audioRequestRef.current !== requestId) {
                  return
                }

                const audioElement = audioRef.current

                if (!audioElement) {
                  return
                }

                const refreshed = await setMediaSource({
                  controllerRef: audioControllerRef,
                  generationRef: audioRequestRef,
                  media: audioElement,
                  options: { pauseBeforeLoad: false },
                  requestGeneration: requestId,
                  sourceUrl: refreshedPayload.signed_url,
                  stabilityProfile: AUDIO_STABILITY_PROFILE,
                })

                if (!refreshed || cancelled || audioRequestRef.current !== requestId) {
                  return
                }

                currentAudioSourceUrlRef.current = refreshedPayload.signed_url
                scheduleMuxAudioRefreshFromPayload(refreshedPayload)
              } catch {
                // Best-effort; session audio may recover on next user interaction.
              }
            })()
          }, delay)
        }

        scheduleMuxAudioRefreshFromPayload(payload)

        if (audioRef.current) {
          audioRef.current.currentTime = 0
          audioRef.current.muted = audioMutedRef.current
          audioRef.current.volume = 0
        }

        const started = await tryPlayAudio(audioRef.current)

        if (started.ok && audioRef.current && !audioMutedRef.current) {
          await fadeTo(audioRef.current, audioVolumeRef.current, 280)
        }

        if (!started.ok && !cancelled) {
          handleAudioPlayFailure(started)
        }
      } catch (error) {
        if (!cancelled) {
          onAudioErrorChange(
            error instanceof Error ? error.message : AUDIO_LAYER_UNAVAILABLE_MESSAGE,
          )
          playbackAuthority?.dispatch({ type: 'audio_error' })
        }
      } finally {
        if (!cancelled && audioRequestRef.current === requestId) {
          onAudioLoadingChange(false)
        }
      }
    }

    void loadAudioTrack()

    return () => {
      cancelled = true
      clearMuxAudioRefreshTimer()
    }
  }, [
    audioScheduler,
    audioTrack,
    currentExperience,
    getTokenSafe,
    handleAudioPlayFailure,
    isActive,
    onAudioErrorChange,
    onAudioLoadingChange,
    playbackAuthority,
    sessionSource,
    singleAvAudioActive,
  ])

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    const handlePause = () => {
      audioScheduler.clear('audio-pause-recovery')
      pauseRecoveryTimerRef.current = null
    }

    const handleStall = () => {
      // Let the low-frequency health task confirm persistent audio issues.
    }

    const handleError = () => {
      if (shouldAudioBePlaying()) {
        playbackAuthority?.dispatch({ type: 'audio_error' })
      }
    }

    const handlePlaying = () => {
      if (pauseRecoveryTimerRef.current !== null) {
        audioScheduler.clear('audio-pause-recovery')
        pauseRecoveryTimerRef.current = null
      }
    }

    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('stalled', handleStall)
    audio.addEventListener('waiting', handleStall)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('stalled', handleStall)
      audio.removeEventListener('waiting', handleStall)
      audio.removeEventListener('error', handleError)
    }
  }, [audioScheduler, playbackAuthority, shouldAudioBePlaying])

  useEffect(() => {
    if (!shouldAudioBePlaying()) {
      if (audioHealthTimerRef.current !== null) {
        window.clearTimeout(audioHealthTimerRef.current)
        audioHealthTimerRef.current = null
      }
      return
    }

    const checkAudioHealth = () => {
      const audio = audioRef.current

      if (audio && shouldAudioBePlaying()) {
        if (typeof document !== 'undefined' && document.hidden) {
          audioHealthTimerRef.current = audioScheduler.setTimeout(
            'audio-health',
            checkAudioHealth,
            AUDIO_HEALTH_CHECK_MS,
          )
          return
        }

        if (!audio.paused && !audioMuted && audio.volume === 0) {
          audio.volume = lastKnownVolumeRef.current
        }

        if (audio.paused) {
          playbackAuthority?.dispatch({ type: 'audio_paused_while_expected', reason: 'health-check' })
        }

        audioHealthTimerRef.current = audioScheduler.setTimeout(
          'audio-health',
          checkAudioHealth,
          AUDIO_HEALTH_CHECK_MS,
        )
      } else {
        audioHealthTimerRef.current = null
      }
    }

    audioHealthTimerRef.current = audioScheduler.setTimeout(
      'audio-health',
      checkAudioHealth,
      AUDIO_HEALTH_CHECK_MS,
    )

    return () => {
      if (audioHealthTimerRef.current !== null) {
        audioScheduler.clear('audio-health')
        audioHealthTimerRef.current = null
      }
    }
  }, [audioMuted, audioScheduler, playbackAuthority, shouldAudioBePlaying])

  useEffect(
    () => () => {
      if (audioHealthTimerRef.current !== null) {
        audioScheduler.clear('audio-health')
        audioHealthTimerRef.current = null
      }
      if (muxAudioRefreshTimerRef.current !== null) {
        audioScheduler.clear('audio-mux-refresh')
        muxAudioRefreshTimerRef.current = null
      }
      if (pauseRecoveryTimerRef.current !== null) {
        audioScheduler.clear('audio-pause-recovery')
        pauseRecoveryTimerRef.current = null
      }
      audioScheduler.clearAll()
      resetMedia(audioRef.current)
      destroyHlsController(audioControllerRef)
      currentAudioAssetIdRef.current = null
      currentAudioSourceUrlRef.current = null
    },
    [audioScheduler],
  )

  return <audio aria-hidden className="hidden" ref={audioRef} />
}

export function useSession() {
  const context = useContext(SessionContext)

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider.')
  }

  return context
}
