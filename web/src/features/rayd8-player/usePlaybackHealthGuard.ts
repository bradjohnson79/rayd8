import { useCallback, useEffect, useRef, useState } from 'react'
import { logExpressPlaybackDebug } from './expressPlaybackDebug'

type PlaybackHealthStatus = 'initializing' | 'softRecovering' | 'failed' | 'healthy'

interface UsePlaybackHealthGuardInput {
  enabled: boolean
  getVideoElement: () => HTMLVideoElement | null
  onSoftRecovery: (reason: string) => Promise<boolean>
  resetKey: string
}

const SOFT_RECOVERY_DELAY_MS = 5_000
const HARD_FALLBACK_DELAY_MS = 9_000
const HEALTH_POLL_MS = 500

export function isVideoPlaybackHealthy(video: HTMLVideoElement | null) {
  return Boolean(
    video &&
      !video.paused &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.currentTime > 0.5,
  )
}

export function usePlaybackHealthGuard({
  enabled,
  getVideoElement,
  onSoftRecovery,
  resetKey,
}: UsePlaybackHealthGuardInput) {
  const [status, setStatus] = useState<PlaybackHealthStatus>('initializing')
  const recoveryInFlightRef = useRef(false)

  const checkHealthy = useCallback(() => {
    return isVideoPlaybackHealthy(getVideoElement())
  }, [getVideoElement])

  const runSoftRecovery = useCallback(
    async (reason: string) => {
      if (recoveryInFlightRef.current || checkHealthy()) {
        return
      }

      recoveryInFlightRef.current = true
      setStatus('softRecovering')
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
          setStatus('healthy')
        }
      }
    },
    [checkHealthy, getVideoElement, onSoftRecovery],
  )

  const reportStartupFailure = useCallback(
    (reason: string) => {
      logExpressPlaybackDebug('health_startup_failure', { reason })
      void runSoftRecovery(reason)
    },
    [runSoftRecovery],
  )

  const reset = useCallback(() => {
    recoveryInFlightRef.current = false
    setStatus('initializing')
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const resetTimerId = window.setTimeout(reset, 0)
    const pollId = window.setInterval(() => {
      if (checkHealthy()) {
        setStatus('healthy')
      }
    }, HEALTH_POLL_MS)

    const softTimerId = window.setTimeout(() => {
      if (!checkHealthy()) {
        void runSoftRecovery('startup_health_timeout')
      }
    }, SOFT_RECOVERY_DELAY_MS)

    const hardTimerId = window.setTimeout(() => {
      if (!checkHealthy()) {
        setStatus('failed')
        logExpressPlaybackDebug('health_hard_fallback', {
          videoReadyState: getVideoElement()?.readyState ?? null,
          videoWidth: getVideoElement()?.videoWidth ?? null,
          currentTime: getVideoElement()?.currentTime ?? null,
        })
      }
    }, HARD_FALLBACK_DELAY_MS)

    return () => {
      window.clearTimeout(resetTimerId)
      window.clearInterval(pollId)
      window.clearTimeout(softTimerId)
      window.clearTimeout(hardTimerId)
      recoveryInFlightRef.current = false
    }
  }, [checkHealthy, enabled, getVideoElement, reset, resetKey, runSoftRecovery])

  return {
    fallbackVisible: enabled && status === 'failed',
    reportStartupFailure,
    reset,
    runSoftRecovery,
    status,
  }
}
