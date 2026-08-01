import { useCallback, useEffect, type MutableRefObject } from 'react'
import type { PlaybackAuthorityController } from '../playback-authority/playbackAuthority'
import { tryPlayVideo } from './mediaController'
import { addTrackedDomEventListener } from './playerDiagnostics'

interface UseMobilePlaybackLifecycleInput {
  enabled: boolean
  getVideoElement: () => HTMLVideoElement | null
  getAudioElement?: () => HTMLAudioElement | null
  orientationSettlingRef: MutableRefObject<boolean>
  playbackAuthority: PlaybackAuthorityController | null
  shouldVideoBePlaying: (video: HTMLVideoElement | null) => boolean
}

const ORIENTATION_SETTLE_MS = 200

function videoLooksStalled(video: HTMLVideoElement) {
  return video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.networkState === HTMLMediaElement.NETWORK_LOADING
}

function resolveGlobalAudioElement(): HTMLAudioElement | null {
  if (typeof document === 'undefined') {
    return null
  }

  return (
    (document.querySelector('audio[data-rayd8-global-audio="true"]') as HTMLAudioElement | null) ??
    (document.querySelector('audio') as HTMLAudioElement | null)
  )
}

export function useMobilePlaybackLifecycle({
  enabled,
  getVideoElement,
  getAudioElement,
  orientationSettlingRef,
  playbackAuthority,
  shouldVideoBePlaying,
}: UseMobilePlaybackLifecycleInput) {
  const softResumeVideo = useCallback(async () => {
    const video = getVideoElement()

    if (!video || !shouldVideoBePlaying(video) || document.hidden) {
      return
    }

    if (!video.paused && !videoLooksStalled(video)) {
      return
    }

    const resumed = await tryPlayVideo(video)

    if (!resumed.ok && videoLooksStalled(video)) {
      playbackAuthority?.dispatch({ type: 'video_persistent_freeze', reason: 'stalled' })
    }
  }, [getVideoElement, playbackAuthority, shouldVideoBePlaying])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const pauseMediaForHiddenTab = () => {
      const video = getVideoElement()
      if (video && !video.paused) {
        try {
          video.pause()
        } catch {
          /* ignore pause races during teardown */
        }
      }

      const audio = getAudioElement?.() ?? resolveGlobalAudioElement()
      if (audio && !audio.paused) {
        try {
          audio.pause()
        } catch {
          /* ignore pause races during teardown */
        }
      }

      playbackAuthority?.dispatch({ type: 'tab_hidden' })
    }

    const handleVisible = () => {
      playbackAuthority?.dispatch({ type: 'tab_visible' })
      void softResumeVideo()
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseMediaForHiddenTab()
        return
      }

      handleVisible()
    }

    const removeVisibilityListener = addTrackedDomEventListener(
      document,
      'visibilitychange',
      handleVisibilityChange as EventListener,
      'document:visibilitychange:mobile-playback',
    )
    const removePageHideListener = addTrackedDomEventListener(
      window,
      'pagehide',
      pauseMediaForHiddenTab as EventListener,
      'window:pagehide:mobile-playback',
    )
    const removePageShowListener = addTrackedDomEventListener(
      window,
      'pageshow',
      handleVisible as EventListener,
      'window:pageshow:mobile-playback',
    )
    const removeFocusListener = addTrackedDomEventListener(
      window,
      'focus',
      handleVisible as EventListener,
      'window:focus:mobile-playback',
    )

    return () => {
      removeVisibilityListener()
      removePageHideListener()
      removePageShowListener()
      removeFocusListener()
    }
  }, [enabled, getAudioElement, getVideoElement, playbackAuthority, softResumeVideo])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let settleTimerId: number | null = null

    const scheduleOrientationRecovery = () => {
      orientationSettlingRef.current = true

      if (settleTimerId !== null) {
        window.clearTimeout(settleTimerId)
      }

      settleTimerId = window.setTimeout(() => {
        settleTimerId = null
        orientationSettlingRef.current = false
        void softResumeVideo()
      }, ORIENTATION_SETTLE_MS)
    }

    const removeResizeListener = addTrackedDomEventListener(
      window,
      'resize',
      scheduleOrientationRecovery as EventListener,
      'window:resize:mobile-playback-recovery',
    )
    const removeOrientationListener = addTrackedDomEventListener(
      window,
      'orientationchange',
      scheduleOrientationRecovery as EventListener,
      'window:orientationchange:mobile-playback-recovery',
    )

    return () => {
      if (settleTimerId !== null) {
        window.clearTimeout(settleTimerId)
      }

      orientationSettlingRef.current = false
      removeResizeListener()
      removeOrientationListener()
    }
  }, [enabled, orientationSettlingRef, softResumeVideo])
}
