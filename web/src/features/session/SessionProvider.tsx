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
import { loadHls, type HlsController } from '../../lib/loadHls'
import { trackUmamiEvent } from '../../services/umami'
import { SESSION_RESUME_MESSAGE, useAuthReadiness } from '../auth/useAuthReadiness'

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
  softDenialState: SoftDenialState | null
  startSession: (type: SessionType, options?: { source?: SessionSource }) => void
  updateExperienceAccess: (nextValue: ExperienceAccessSummary | null) => void
  usageWarningState: UsageWarningState | null
}

const HEARTBEAT_MS = 30_000
const SOFT_DENIAL_EXIT_MS = 3_500
const UPGRADE_PATH = '/subscription?plan=regen'
const AUDIO_RECOVERY_COOLDOWN_MS = 5_000
const AUDIO_HEALTH_CHECK_MS = 20_000
const AUDIO_PAUSE_RECOVERY_DEBOUNCE_MS = 450
/** Align with primary video: refresh Mux JWT before streaming endpoints reject the old token. */
const MUX_AUDIO_REFRESH_LEAD_MS = 90_000

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
      audioTrack:
        parsed.audioTrack === 'expansion' || parsed.audioTrack === 'premium'
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

async function setMediaSource(
  controllerRef: MutableRefObject<HlsController | null>,
  media: HTMLMediaElement | null,
  sourceUrl: string,
  generationRef: MutableRefObject<number>,
  requestGeneration: number,
  options?: { pauseBeforeLoad?: boolean },
): Promise<boolean> {
  if (!media) {
    return false
  }

  if (generationRef.current !== requestGeneration) {
    return false
  }

  const pauseBeforeLoad = options?.pauseBeforeLoad ?? true

  if (pauseBeforeLoad) {
    media.pause()
  }

  if (media.canPlayType('application/vnd.apple.mpegurl')) {
    if (generationRef.current !== requestGeneration) {
      return false
    }

    media.src = sourceUrl
    media.load()
    return true
  }

  const Hls = await loadHls()

  if (generationRef.current !== requestGeneration) {
    return false
  }

  if (!Hls.isSupported()) {
    throw new Error('This browser cannot play the current RAYD8® session stream.')
  }

  if (!controllerRef.current) {
    controllerRef.current = new Hls({
      backBufferLength: 90,
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 40,
      maxMaxBufferLength: 120,
    })
    controllerRef.current.attachMedia(media)
  }

  if (generationRef.current !== requestGeneration) {
    return false
  }

  controllerRef.current.loadSource(sourceUrl)
  return true
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

function destroyHlsController(controllerRef: MutableRefObject<HlsController | null>) {
  if (controllerRef.current) {
    try {
      controllerRef.current.destroy()
    } catch {
      // Best-effort: HLS.js may already be torn down on this element.
    }
    controllerRef.current = null
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
    return {
      description: `You have used the remaining ${sessionLabel} preview time for Free Trial. Returning you to the dashboard with upgrade options.`,
      title: `You've used your ${sessionLabel} preview time`,
    }
  }

  return {
    description: `You have reached the ${sessionLabel} session limit for the current plan. Returning you to the dashboard with upgrade options.`,
    title: `You've reached your ${sessionLabel} session limit`,
  }
}

function toTrialSoftDenialState(errorMessage: string): SoftDenialState | null {
  if (errorMessage === 'HOURS_EXCEEDED' || errorMessage === 'USAGE_LIMIT_REACHED') {
    return {
      ctaLabel: 'Upgrade Now',
      ctaTo: UPGRADE_PATH,
      description: 'Your free trial has ended. Upgrade to continue using RAYD8.',
      title: 'Your free trial has ended',
    }
  }

  if (errorMessage === 'TRIAL_EXPIRED') {
    return {
      ctaLabel: 'Upgrade Now',
      ctaTo: UPGRADE_PATH,
      description: 'Your free trial has ended. Upgrade to continue using RAYD8.',
      title: 'Your free trial has ended',
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

    clearTimer(softDenialTimerRef)
    setTrackingSessionId(null)
    setSoftDenialState(null)
    setUsageWarningState(null)
    setAudioError(null)
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
    setSoftDenialState(null)
    setUsageWarningState(null)
    setAudioError(null)
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
      softDenialTimerRef.current = window.setTimeout(() => {
        endSession()
      }, SOFT_DENIAL_EXIT_MS)
    },
    [endSession],
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
          const trialSoftDenial = toTrialSoftDenialState(
            getApiErrorCode(error) ?? (error instanceof Error ? error.message : ''),
          )

          if (trialSoftDenial) {
            clearTimer(softDenialTimerRef)
            setSoftDenialState(trialSoftDenial)
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

        const trialSoftDenial = toTrialSoftDenialState(
          getApiErrorCode(error) ?? (error instanceof Error ? error.message : ''),
        )

        if (trialSoftDenial) {
          clearTimer(softDenialTimerRef)
          setTrackingSessionId(null)
          setUsageWarningState(null)
          setSoftDenialState(trialSoftDenial)
          void finalizeTrackedSession(trackingSessionId)
        }
      }
    }

    const intervalId = window.setInterval(() => {
      void heartbeat()
    }, HEARTBEAT_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [
    authStatus,
    getTokenSafe,
    scheduleSoftDenialExit,
    state.isActive,
    state.sessionSource,
    trackingSessionId,
    updateExperienceAccess,
  ])

  useEffect(
    () => () => {
      clearTimer(softDenialTimerRef)
    },
    [],
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
      />
    </SessionContext.Provider>
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
}) {
  const { getTokenSafe } = useAuthReadiness()
  const audioControllerRef = useRef<HlsController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioRequestRef = useRef(0)
  const audioHealthTimerRef = useRef<number | null>(null)
  const muxAudioRefreshTimerRef = useRef<number | null>(null)
  const pauseRecoveryTimerRef = useRef<number | null>(null)
  const currentAudioAssetIdRef = useRef<string | null>(null)
  const currentAudioSourceUrlRef = useRef<string | null>(null)
  const lastAudioRecoveryTimestampRef = useRef(0)
  const lastKnownVolumeRef = useRef(audioVolume)

  const currentExperience = useMemo<Experience | null>(
    () => (sessionType ? getExperienceFromSessionType(sessionType) : null),
    [sessionType],
  )

  useEffect(() => {
    onResumeHandlerChange(async () => tryPlay(audioRef.current))

    return () => {
      onResumeHandlerChange(async () => true)
    }
  }, [onResumeHandlerChange])

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

          await setMediaSource(
            audioControllerRef,
            audio,
            currentAudioSourceUrlRef.current,
            audioRequestRef,
            audioRequestRef.current,
          )

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

        return await tryPlay(audio)
      } catch {
        return false
      }
    },
    [audioMuted, shouldAudioBePlaying],
  )

  useEffect(() => {
    if (!isActive || !currentExperience || audioTrack === 'none') {
      if (muxAudioRefreshTimerRef.current !== null) {
        window.clearTimeout(muxAudioRefreshTimerRef.current)
        muxAudioRefreshTimerRef.current = null
      }
      if (pauseRecoveryTimerRef.current !== null) {
        window.clearTimeout(pauseRecoveryTimerRef.current)
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
        window.clearTimeout(muxAudioRefreshTimerRef.current)
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

        const applied = await setMediaSource(
          audioControllerRef,
          audioRef.current,
          payload.signed_url,
          audioRequestRef,
          requestId,
        )

        if (!applied || cancelled || audioRequestRef.current !== requestId) {
          return
        }

        function scheduleMuxAudioRefreshFromPayload(nextPayload: MuxPlaybackPayload) {
          clearMuxAudioRefreshTimer()
          const delay = Math.max(
            4000,
            computeMuxPlaybackExpiryMs(nextPayload) - Date.now() - MUX_AUDIO_REFRESH_LEAD_MS,
          )

          muxAudioRefreshTimerRef.current = window.setTimeout(() => {
            muxAudioRefreshTimerRef.current = null

            if (cancelled || audioRequestRef.current !== requestId) {
              return
            }

            void (async () => {
              try {
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

                const refreshed = await setMediaSource(
                  audioControllerRef,
                  audioElement,
                  refreshedPayload.signed_url,
                  audioRequestRef,
                  requestId,
                  { pauseBeforeLoad: false },
                )

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
          audioRef.current.muted = audioMuted
          audioRef.current.volume = 0
        }

        const started = await tryPlay(audioRef.current)

        if (started && audioRef.current && !audioMuted) {
          await fadeTo(audioRef.current, audioVolume, 280)
        }

        if (!started && !cancelled) {
          onAudioErrorChange('Tap or press any key to continue the audio layer.')
        }
      } catch (error) {
        if (!cancelled) {
          onAudioErrorChange(
            error instanceof Error ? error.message : 'Unable to load the current audio layer.',
          )
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
    audioMuted,
    audioTrack,
    audioVolume,
    currentExperience,
    getTokenSafe,
    isActive,
    onAudioErrorChange,
    onAudioLoadingChange,
    sessionSource,
  ])

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    const handlePause = () => {
      if (!shouldAudioBePlaying()) {
        return
      }

      if (typeof document !== 'undefined' && document.hidden) {
        return
      }

      if (pauseRecoveryTimerRef.current !== null) {
        window.clearTimeout(pauseRecoveryTimerRef.current)
      }

      pauseRecoveryTimerRef.current = window.setTimeout(() => {
        pauseRecoveryTimerRef.current = null
        void recoverAudioPlayback('pause')
      }, AUDIO_PAUSE_RECOVERY_DEBOUNCE_MS)
    }

    const handleStall = () => {
      if (shouldAudioBePlaying()) {
        void recoverAudioPlayback('stalled')
      }
    }

    const handleError = () => {
      if (shouldAudioBePlaying()) {
        void recoverAudioPlayback('error')
      }
    }

    const handlePlaying = () => {
      if (pauseRecoveryTimerRef.current !== null) {
        window.clearTimeout(pauseRecoveryTimerRef.current)
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
  }, [recoverAudioPlayback, shouldAudioBePlaying])

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
          audioHealthTimerRef.current = window.setTimeout(checkAudioHealth, AUDIO_HEALTH_CHECK_MS)
          return
        }

        if (!audio.paused && !audioMuted && audio.volume === 0) {
          audio.volume = lastKnownVolumeRef.current
        }

        if (audio.paused) {
          void recoverAudioPlayback('health-check')
        }

        audioHealthTimerRef.current = window.setTimeout(checkAudioHealth, AUDIO_HEALTH_CHECK_MS)
      } else {
        audioHealthTimerRef.current = null
      }
    }

    audioHealthTimerRef.current = window.setTimeout(checkAudioHealth, AUDIO_HEALTH_CHECK_MS)

    return () => {
      if (audioHealthTimerRef.current !== null) {
        window.clearTimeout(audioHealthTimerRef.current)
        audioHealthTimerRef.current = null
      }
    }
  }, [audioMuted, recoverAudioPlayback, shouldAudioBePlaying])

  useEffect(
    () => () => {
      if (audioHealthTimerRef.current !== null) {
        window.clearTimeout(audioHealthTimerRef.current)
        audioHealthTimerRef.current = null
      }
      if (muxAudioRefreshTimerRef.current !== null) {
        window.clearTimeout(muxAudioRefreshTimerRef.current)
        muxAudioRefreshTimerRef.current = null
      }
      if (pauseRecoveryTimerRef.current !== null) {
        window.clearTimeout(pauseRecoveryTimerRef.current)
        pauseRecoveryTimerRef.current = null
      }
      resetMedia(audioRef.current)
      destroyHlsController(audioControllerRef)
      currentAudioAssetIdRef.current = null
      currentAudioSourceUrlRef.current = null
    },
    [],
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
