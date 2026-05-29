import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import { addTrackedDomEventListener, addTrackedEventListener } from './playerDiagnostics'

interface WakeLockSentinel extends EventTarget {
  released: boolean
  release: () => Promise<void>
}

interface WakeLockRequestor {
  request: (type: 'screen') => Promise<WakeLockSentinel>
}

interface UseWakeLockInput {
  enabled: boolean
  playbackState: string
  systemPausedRef: MutableRefObject<boolean>
  title: string
  videoRef: RefObject<HTMLVideoElement | null>
}

const PAUSED_RELEASE_DELAY_MS = 10_000

function getWakeLockNavigator() {
  if (typeof navigator === 'undefined') {
    return null
  }

  return navigator as Navigator & { wakeLock?: WakeLockRequestor }
}

function canUseMediaSession() {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator
}

function syncMediaSessionState(state: MediaSessionPlaybackState, title: string) {
  if (!canUseMediaSession()) {
    return
  }

  if (!navigator.mediaSession.metadata && typeof MediaMetadata !== 'undefined') {
    navigator.mediaSession.metadata = new MediaMetadata({
      artist: 'RAYD8',
      title,
    })
  }

  navigator.mediaSession.playbackState = state
}

export function useWakeLock({
  enabled,
  playbackState,
  systemPausedRef,
  title,
  videoRef,
}: UseWakeLockInput) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const pauseReleaseTimerRef = useRef<number | null>(null)

  const clearPauseReleaseTimer = useCallback(() => {
    if (pauseReleaseTimerRef.current !== null) {
      window.clearTimeout(pauseReleaseTimerRef.current)
      pauseReleaseTimerRef.current = null
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    clearPauseReleaseTimer()

    syncMediaSessionState('paused', title)

    const wakeLock = wakeLockRef.current
    wakeLockRef.current = null

    if (!wakeLock || wakeLock.released) {
      return
    }

    try {
      await wakeLock.release()
    } catch {
      // Wake Lock release is best-effort; the browser may have already released it.
    }
  }, [clearPauseReleaseTimer, title])

  const requestWakeLock = useCallback(async () => {
    const playbackActive = playbackState === 'playing' && !systemPausedRef.current

    if (!enabled || !playbackActive || document.hidden) {
      await releaseWakeLock()
      return
    }

    clearPauseReleaseTimer()

    syncMediaSessionState('playing', title)

    if (wakeLockRef.current && !wakeLockRef.current.released) {
      return
    }

    const wakeLock = getWakeLockNavigator()?.wakeLock

    if (!wakeLock) {
      return
    }

    try {
      wakeLockRef.current = await wakeLock.request('screen')
      wakeLockRef.current.addEventListener(
        'release',
        () => {
          wakeLockRef.current = null
        },
        { once: true },
      )
    } catch {
      wakeLockRef.current = null
    }
  }, [clearPauseReleaseTimer, enabled, playbackState, releaseWakeLock, systemPausedRef, title])

  const schedulePausedRelease = useCallback(() => {
    clearPauseReleaseTimer()
    pauseReleaseTimerRef.current = window.setTimeout(() => {
      pauseReleaseTimerRef.current = null
      void releaseWakeLock()
    }, PAUSED_RELEASE_DELAY_MS)
  }, [clearPauseReleaseTimer, releaseWakeLock])

  useEffect(() => {
    const playbackActive = playbackState === 'playing' && !systemPausedRef.current

    if (playbackActive) {
      void requestWakeLock()
      return
    }

    schedulePausedRelease()
  }, [playbackState, requestWakeLock, schedulePausedRelease, systemPausedRef])

  useEffect(() => {
    const video = videoRef.current

    if (!video) {
      return
    }

    const handlePlaying = () => {
      void requestWakeLock()
    }
    const handlePause = () => {
      schedulePausedRelease()
    }
    const handleEnded = () => {
      void releaseWakeLock()
    }

    const removePlayListener = addTrackedEventListener(
      video,
      'playing',
      handlePlaying,
      'video:primary:playing:wake-lock',
    )
    const removePauseListener = addTrackedEventListener(
      video,
      'pause',
      handlePause,
      'video:primary:pause:wake-lock',
    )
    const removeEndedListener = addTrackedEventListener(
      video,
      'ended',
      handleEnded,
      'video:primary:ended:wake-lock',
    )

    return () => {
      removePlayListener()
      removePauseListener()
      removeEndedListener()
    }
  }, [releaseWakeLock, requestWakeLock, schedulePausedRelease, videoRef])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        void releaseWakeLock()
        return
      }

      void requestWakeLock()
    }

    const removeVisibilityListener = addTrackedDomEventListener(
      document,
      'visibilitychange',
      handleVisibilityChange as EventListener,
      'document:visibilitychange:wake-lock',
    )
    const removePageHideListener = addTrackedDomEventListener(
      window,
      'pagehide',
      releaseWakeLock as EventListener,
      'window:pagehide:wake-lock',
    )

    return () => {
      removeVisibilityListener()
      removePageHideListener()
      void releaseWakeLock()
    }
  }, [releaseWakeLock, requestWakeLock])
}
