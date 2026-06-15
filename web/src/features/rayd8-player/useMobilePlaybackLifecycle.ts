import { useCallback, useEffect, type MutableRefObject } from 'react'
import type { PlaybackAuthorityController } from '../playback-authority/playbackAuthority'
import { tryPlayVideo } from './mediaController'
import { addTrackedDomEventListener } from './playerDiagnostics'

interface UseMobilePlaybackLifecycleInput {
  enabled: boolean
  getVideoElement: () => HTMLVideoElement | null
  orientationSettlingRef: MutableRefObject<boolean>
  playbackAuthority: PlaybackAuthorityController | null
  shouldVideoBePlaying: (video: HTMLVideoElement | null) => boolean
}

const ORIENTATION_SETTLE_MS = 200

function videoLooksStalled(video: HTMLVideoElement) {
  return video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.networkState === HTMLMediaElement.NETWORK_LOADING
}

export function useMobilePlaybackLifecycle({
  enabled,
  getVideoElement,
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
    const handleHidden = () => {
      playbackAuthority?.dispatch({ type: 'tab_hidden' })
    }
    const handleVisible = () => {
      playbackAuthority?.dispatch({ type: 'tab_visible' })

      if (enabled) {
        void softResumeVideo()
      }
    }
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleHidden()
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
      handleHidden as EventListener,
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
  }, [enabled, playbackAuthority, softResumeVideo])

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
