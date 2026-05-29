import { useCallback, useEffect, useState, type RefObject } from 'react'
import { addTrackedDomEventListener } from './playerDiagnostics'

type WebKitPresentationMode = 'inline' | 'picture-in-picture' | 'fullscreen'

interface WebKitFullscreenVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitPresentationMode?: WebKitPresentationMode
}

interface UseRayd8FullscreenInput {
  enabled: boolean
  playerRootRef: RefObject<HTMLDivElement | null>
  touchLikeViewport: boolean
  videoRef: RefObject<HTMLVideoElement | null>
}

function getAppleDeviceKind() {
  if (typeof navigator === 'undefined') {
    return 'other'
  }

  const userAgent = navigator.userAgent

  if (/iPhone|iPod/i.test(userAgent)) {
    return 'iphone'
  }

  if (/iPad/i.test(userAgent)) {
    return 'ipad'
  }

  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return 'ipad'
  }

  return 'other'
}

function getWebKitVideo(video: HTMLVideoElement | null): WebKitFullscreenVideo | null {
  return video as WebKitFullscreenVideo | null
}

function isNativeVideoFullscreen(video: HTMLVideoElement | null) {
  return getWebKitVideo(video)?.webkitPresentationMode === 'fullscreen'
}

function setNativePresentationMode(video: HTMLVideoElement | null, mode: WebKitPresentationMode) {
  const webkitVideo = getWebKitVideo(video)

  if (!webkitVideo || typeof webkitVideo.webkitPresentationMode === 'undefined') {
    return false
  }

  try {
    webkitVideo.webkitPresentationMode = mode
    return webkitVideo.webkitPresentationMode === mode
  } catch {
    return false
  }
}

function enterNativeVideoFullscreen(video: HTMLVideoElement | null) {
  const webkitVideo = getWebKitVideo(video)

  if (!webkitVideo?.webkitEnterFullscreen) {
    return false
  }

  try {
    webkitVideo.webkitEnterFullscreen()
    return true
  } catch {
    return false
  }
}

async function enterStandardFullscreen(playerRoot: HTMLDivElement | null) {
  if (!playerRoot?.requestFullscreen) {
    return false
  }

  try {
    if (document.fullscreenElement && document.fullscreenElement !== playerRoot) {
      await document.exitFullscreen()
    }

    await playerRoot.requestFullscreen()
    return document.fullscreenElement === playerRoot
  } catch {
    return false
  }
}

export function useRayd8Fullscreen({
  enabled,
  playerRootRef,
  touchLikeViewport,
  videoRef,
}: UseRayd8FullscreenInput) {
  const [isAppShellFullscreen, setIsAppShellFullscreen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [nativeVideoFullscreen, setNativeVideoFullscreen] = useState(false)

  const syncFullscreenState = useCallback(() => {
    const playerRoot = playerRootRef.current
    const video = videoRef.current
    const documentFullscreen = Boolean(playerRoot && document.fullscreenElement === playerRoot)
    const nativeFullscreen = nativeVideoFullscreen || isNativeVideoFullscreen(video)

    setIsFullscreen(documentFullscreen || nativeFullscreen || isAppShellFullscreen)
  }, [isAppShellFullscreen, nativeVideoFullscreen, playerRootRef, videoRef])

  const exitFullscreen = useCallback(async () => {
    const video = getWebKitVideo(videoRef.current)

    if (video?.webkitExitFullscreen && isNativeVideoFullscreen(video)) {
      try {
        video.webkitExitFullscreen()
      } catch {
        setNativePresentationMode(video, 'inline')
      }
    } else if (isNativeVideoFullscreen(video)) {
      setNativePresentationMode(video, 'inline')
    }

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {
        // Browser fullscreen may already be exiting.
      }
    }

    setIsAppShellFullscreen(false)
    setNativeVideoFullscreen(false)
    setIsFullscreen(false)
  }, [videoRef])

  const enterFullscreen = useCallback(async () => {
    const playerRoot = playerRootRef.current
    const video = videoRef.current

    if (!playerRoot) {
      return
    }

    if (!enabled) {
      if (touchLikeViewport) {
        setIsAppShellFullscreen(true)
        setIsFullscreen(true)
        return
      }

      if (!(await enterStandardFullscreen(playerRoot))) {
        setIsAppShellFullscreen(true)
        setIsFullscreen(true)
      }
      return
    }

    const appleDevice = getAppleDeviceKind()

    if (appleDevice === 'iphone' && enterNativeVideoFullscreen(video)) {
      setNativeVideoFullscreen(true)
      setIsFullscreen(true)
      return
    }

    if (appleDevice === 'ipad' && setNativePresentationMode(video, 'fullscreen')) {
      setNativeVideoFullscreen(true)
      setIsFullscreen(true)
      return
    }

    if (appleDevice !== 'ipad' && enterNativeVideoFullscreen(video)) {
      setNativeVideoFullscreen(true)
      setIsFullscreen(true)
      return
    }

    if (appleDevice !== 'iphone' && setNativePresentationMode(video, 'fullscreen')) {
      setNativeVideoFullscreen(true)
      setIsFullscreen(true)
      return
    }

    if (await enterStandardFullscreen(playerRoot)) {
      setIsFullscreen(true)
      return
    }

    setIsAppShellFullscreen(true)
    setIsFullscreen(true)
  }, [enabled, playerRootRef, touchLikeViewport, videoRef])

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen()
      return
    }

    await enterFullscreen()
  }, [enterFullscreen, exitFullscreen, isFullscreen])

  useEffect(() => {
    const video = videoRef.current
    const handleNativeBeginFullscreen = () => {
      setNativeVideoFullscreen(true)
      setIsFullscreen(true)
    }
    const handleNativeEndFullscreen = () => {
      setNativeVideoFullscreen(false)
      setIsFullscreen(Boolean(document.fullscreenElement === playerRootRef.current || isAppShellFullscreen))
    }
    const removeDocumentListener = addTrackedDomEventListener(
      document,
      'fullscreenchange',
      syncFullscreenState as EventListener,
      'document:fullscreenchange',
    )
    const removeBeginFullscreenListener = video
      ? addTrackedDomEventListener(
          video,
          'webkitbeginfullscreen',
          handleNativeBeginFullscreen as EventListener,
          'video:webkitbeginfullscreen',
        )
      : null
    const removeEndFullscreenListener = video
      ? addTrackedDomEventListener(
          video,
          'webkitendfullscreen',
          handleNativeEndFullscreen as EventListener,
          'video:webkitendfullscreen',
        )
      : null
    const removePresentationListener = video
      ? addTrackedDomEventListener(
          video,
          'webkitpresentationmodechanged',
          syncFullscreenState as EventListener,
          'video:webkitpresentationmodechanged',
        )
      : null

    syncFullscreenState()

    return () => {
      removeDocumentListener()
      removeBeginFullscreenListener?.()
      removeEndFullscreenListener?.()
      removePresentationListener?.()
    }
  }, [isAppShellFullscreen, playerRootRef, syncFullscreenState, videoRef])

  return {
    exitFullscreen,
    isAppShellFullscreen,
    isFullscreen,
    toggleFullscreen,
  }
}
