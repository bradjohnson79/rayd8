import { useEffect, useRef } from 'react'
import { isAudioUnlockPrompt } from './audioUnlock'
import { addTrackedDomEventListener } from './playerDiagnostics'

interface UseAudioUnlockGestureInput {
  audioError: string | null
  enabled: boolean
  resumeAudioPlayback: () => Promise<boolean>
}

export function useAudioUnlockGesture({
  audioError,
  enabled,
  resumeAudioPlayback,
}: UseAudioUnlockGestureInput) {
  const unlockInFlightRef = useRef(false)

  useEffect(() => {
    if (!enabled || !isAudioUnlockPrompt(audioError)) {
      return
    }

    const handleUnlockGesture = () => {
      if (unlockInFlightRef.current) {
        return
      }

      unlockInFlightRef.current = true

      void (async () => {
        try {
          await resumeAudioPlayback()
        } finally {
          unlockInFlightRef.current = false
        }
      })()
    }

    const removeListeners = [
      addTrackedDomEventListener(
        window,
        'pointerdown',
        handleUnlockGesture as EventListener,
        'window:pointerdown:audio-unlock',
      ),
      addTrackedDomEventListener(
        window,
        'touchstart',
        handleUnlockGesture as EventListener,
        'window:touchstart:audio-unlock',
      ),
      addTrackedDomEventListener(
        window,
        'keydown',
        handleUnlockGesture as EventListener,
        'window:keydown:audio-unlock',
      ),
    ]

    return () => {
      removeListeners.forEach((removeListener) => removeListener())
    }
  }, [audioError, enabled, resumeAudioPlayback])
}
