import { useCallback, useEffect, useRef, useState } from 'react'
import { logExpressPlaybackDebug } from './expressPlaybackDebug'
import {
  HARD_FALLBACK_DELAY_MS,
  HEALTH_POLL_MS,
  SOFT_RECOVERY_DELAY_MS,
  createPlaybackHealthContext,
  evaluatePipelineHealthy,
  isHardFallbackVisible,
  isVideoPlaybackHealthy,
  reducePlaybackHealth,
  shouldPauseHardTimer,
  type MediaHealthSnapshot,
  type PlaybackHealthMachineContext,
  type PlaybackPipelineMode,
} from './playbackHealthStateMachine'

export { isVideoPlaybackHealthy }

interface UsePlaybackHealthGuardInput {
  enabled: boolean
  getVideoElement: () => HTMLVideoElement | null
  getAudioElement?: () => HTMLAudioElement | null
  onSoftRecovery: (reason: string) => Promise<boolean>
  resetKey: string
  pipelineMode?: PlaybackPipelineMode
  audioRequired?: boolean
  mediaOwned?: boolean
  sourceApplied?: boolean
  metadataReady?: boolean
  autoplayPending?: boolean
  intentionallyPaused?: boolean
  ending?: boolean
  replacingSource?: boolean
  tokenRefreshing?: boolean
}

function readOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

function readHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

export function usePlaybackHealthGuard({
  enabled,
  getVideoElement,
  getAudioElement,
  onSoftRecovery,
  resetKey,
  pipelineMode = 'video',
  audioRequired = false,
  mediaOwned = false,
  sourceApplied = false,
  metadataReady = false,
  autoplayPending = false,
  intentionallyPaused = false,
  ending = false,
  replacingSource = false,
  tokenRefreshing = false,
}: UsePlaybackHealthGuardInput) {
  const [ctx, setCtx] = useState<PlaybackHealthMachineContext>(() => createPlaybackHealthContext())
  const recoveryInFlightRef = useRef(false)
  const hardDeadlineRef = useRef<number | null>(null)
  const softDeadlineRef = useRef<number | null>(null)
  const hardTimerIdRef = useRef<number | null>(null)
  const softTimerIdRef = useRef<number | null>(null)
  const pollIdRef = useRef<number | null>(null)

  const buildSnapshot = useCallback((): MediaHealthSnapshot => {
    return {
      video: getVideoElement(),
      audio: getAudioElement?.() ?? null,
      mode: pipelineMode,
      audioRequired,
      sourceApplied,
      autoplayPending,
      intentionallyPaused,
      documentHidden: readHidden(),
      offline: !readOnline(),
      ending,
      replacingSource,
      tokenRefreshing,
      metadataReady,
      mediaOwned: mediaOwned && enabled,
    }
  }, [
    audioRequired,
    autoplayPending,
    enabled,
    ending,
    getAudioElement,
    getVideoElement,
    intentionallyPaused,
    mediaOwned,
    metadataReady,
    pipelineMode,
    replacingSource,
    sourceApplied,
    tokenRefreshing,
  ])

  const clearTimers = useCallback(() => {
    if (hardTimerIdRef.current !== null) {
      window.clearTimeout(hardTimerIdRef.current)
      hardTimerIdRef.current = null
    }
    if (softTimerIdRef.current !== null) {
      window.clearTimeout(softTimerIdRef.current)
      softTimerIdRef.current = null
    }
    if (pollIdRef.current !== null) {
      window.clearInterval(pollIdRef.current)
      pollIdRef.current = null
    }
    hardDeadlineRef.current = null
    softDeadlineRef.current = null
  }, [])

  const checkHealthy = useCallback(() => evaluatePipelineHealthy(buildSnapshot()), [buildSnapshot])

  const runSoftRecovery = useCallback(
    async (reason: string) => {
      if (recoveryInFlightRef.current || checkHealthy()) {
        return
      }

      recoveryInFlightRef.current = true
      setCtx((current) => reducePlaybackHealth(current, { type: 'SOFT_RECOVER' }))
      logExpressPlaybackDebug('health_soft_recovery', {
        reason,
        videoReadyState: getVideoElement()?.readyState ?? null,
        videoWidth: getVideoElement()?.videoWidth ?? null,
        currentTime: getVideoElement()?.currentTime ?? null,
      })

      try {
        await onSoftRecovery(reason)
      } finally {
        recoveryInFlightRef.current = false
        if (checkHealthy()) {
          setCtx((current) => reducePlaybackHealth(current, { type: 'MARK_HEALTHY' }))
        }
      }
    },
    [checkHealthy, getVideoElement, onSoftRecovery],
  )

  const reportStartupFailure = useCallback(
    (reason: string) => {
      logExpressPlaybackDebug('health_startup_failure', { reason })
      if (reason === 'NotAllowedError' || reason === 'play_failed_autoplay' || reason === 'AUTOPLAY_BLOCKED') {
        setCtx((current) => reducePlaybackHealth(current, { type: 'AUTOPLAY_BLOCKED' }))
        return
      }
      void runSoftRecovery(reason)
    },
    [runSoftRecovery],
  )

  const reset = useCallback(() => {
    recoveryInFlightRef.current = false
    clearTimers()
    setCtx(createPlaybackHealthContext())
  }, [clearTimers])

  const markMediaOwned = useCallback(() => {
    setCtx((current) => reducePlaybackHealth(current, { type: 'MEDIA_OWNED' }))
  }, [])

  const markPipelineState = useCallback((state: PlaybackHealthMachineContext['state']) => {
    setCtx((current) => reducePlaybackHealth(current, { type: 'PIPELINE_PROGRESS', state }))
  }, [])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }

    const applySnapshot = () => {
      const snapshot = buildSnapshot()
      setCtx((current) => {
        const next = reducePlaybackHealth(current, { type: 'TICK_EVALUATE', snapshot })
        return next
      })
      return snapshot
    }

    const armTimersIfNeeded = () => {
      const snapshot = buildSnapshot()
      if (!snapshot.mediaOwned || !snapshot.sourceApplied || shouldPauseHardTimer(snapshot)) {
        if (hardTimerIdRef.current !== null) {
          window.clearTimeout(hardTimerIdRef.current)
          hardTimerIdRef.current = null
          hardDeadlineRef.current = null
        }
        if (softTimerIdRef.current !== null) {
          window.clearTimeout(softTimerIdRef.current)
          softTimerIdRef.current = null
          softDeadlineRef.current = null
        }
        return
      }

      if (checkHealthy()) {
        setCtx((current) => reducePlaybackHealth(current, { type: 'MARK_HEALTHY' }))
        clearTimers()
        pollIdRef.current = window.setInterval(() => {
          if (checkHealthy()) {
            setCtx((current) => reducePlaybackHealth(current, { type: 'MARK_HEALTHY' }))
          } else {
            applySnapshot()
          }
        }, HEALTH_POLL_MS)
        return
      }

      if (softDeadlineRef.current === null) {
        softDeadlineRef.current = Date.now() + SOFT_RECOVERY_DELAY_MS
        softTimerIdRef.current = window.setTimeout(() => {
          softTimerIdRef.current = null
          if (!checkHealthy() && !shouldPauseHardTimer(buildSnapshot())) {
            void runSoftRecovery('startup_health_timeout')
          }
        }, SOFT_RECOVERY_DELAY_MS)
      }

      if (hardDeadlineRef.current === null) {
        hardDeadlineRef.current = Date.now() + HARD_FALLBACK_DELAY_MS
        hardTimerIdRef.current = window.setTimeout(() => {
          hardTimerIdRef.current = null
          const snapshot = buildSnapshot()
          if (!checkHealthy() && !shouldPauseHardTimer(snapshot)) {
            setCtx((current) =>
              reducePlaybackHealth(current, { type: 'HARD_FAIL', reason: 'startup_health_timeout' }),
            )
            logExpressPlaybackDebug('health_hard_fallback', {
              videoReadyState: getVideoElement()?.readyState ?? null,
              videoWidth: getVideoElement()?.videoWidth ?? null,
              currentTime: getVideoElement()?.currentTime ?? null,
              pipelineMode,
            })
          }
        }, HARD_FALLBACK_DELAY_MS)
      }
    }

    const resetTimerId = window.setTimeout(() => {
      setCtx((current) => {
        if (current.state === 'FAILED' || current.state === 'ENDED') return current
        return mediaOwned
          ? reducePlaybackHealth(createPlaybackHealthContext(), { type: 'MEDIA_OWNED' })
          : createPlaybackHealthContext()
      })
      armTimersIfNeeded()
    }, 0)

    pollIdRef.current = window.setInterval(() => {
      applySnapshot()
      armTimersIfNeeded()
    }, HEALTH_POLL_MS)

    const onVisibility = () => {
      if (readHidden()) {
        setCtx((current) => reducePlaybackHealth(current, { type: 'HIDDEN' }))
        armTimersIfNeeded()
        return
      }
      setCtx((current) => reducePlaybackHealth(current, { type: 'VISIBLE' }))
      // Re-arm deadlines fresh after unhide — do not preserve stale expired deadline.
      hardDeadlineRef.current = null
      softDeadlineRef.current = null
      if (hardTimerIdRef.current !== null) {
        window.clearTimeout(hardTimerIdRef.current)
        hardTimerIdRef.current = null
      }
      if (softTimerIdRef.current !== null) {
        window.clearTimeout(softTimerIdRef.current)
        softTimerIdRef.current = null
      }
      armTimersIfNeeded()
    }

    const onOnline = () => {
      setCtx((current) => reducePlaybackHealth(current, { type: 'ONLINE' }))
      hardDeadlineRef.current = null
      softDeadlineRef.current = null
      armTimersIfNeeded()
    }
    const onOffline = () => {
      setCtx((current) => reducePlaybackHealth(current, { type: 'OFFLINE' }))
      armTimersIfNeeded()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    armTimersIfNeeded()

    return () => {
      window.clearTimeout(resetTimerId)
      clearTimers()
      recoveryInFlightRef.current = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [
    buildSnapshot,
    checkHealthy,
    clearTimers,
    enabled,
    getVideoElement,
    mediaOwned,
    pipelineMode,
    resetKey,
    runSoftRecovery,
    sourceApplied,
    metadataReady,
    autoplayPending,
    intentionallyPaused,
    ending,
    replacingSource,
    tokenRefreshing,
    audioRequired,
  ])

  return {
    fallbackVisible: enabled && isHardFallbackVisible(ctx),
    reportStartupFailure,
    reset,
    runSoftRecovery,
    status: ctx.state,
    machine: ctx,
    markMediaOwned,
    markPipelineState,
    checkHealthy,
  }
}
