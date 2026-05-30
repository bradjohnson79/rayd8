import {
  getExpressPlaybackContext,
  logExpressPlaybackDebug,
} from './expressPlaybackDebug'

const VISIBLE_STATE_TIMEOUT_MS = 500
const SURFACE_READY_FRAMES = 2

function waitForAnimationFrame() {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

async function waitForAnimationFrames(frameCount: number) {
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    await waitForAnimationFrame()
  }
}

function waitForVisibleDocument() {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    return Promise.resolve(true)
  }

  return new Promise<boolean>((resolve) => {
    let settled = false

    const finish = (visible: boolean) => {
      if (settled) {
        return
      }

      settled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearTimeout(timeoutId)
      resolve(visible)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        finish(true)
      }
    }

    const timeoutId = window.setTimeout(() => finish(false), VISIBLE_STATE_TIMEOUT_MS)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })
}

function getSurfaceSnapshot(video: HTMLMediaElement | null) {
  if (!video) {
    return {
      connected: false,
      height: 0,
      readyState: 0,
      videoWidth: 0,
      width: 0,
    }
  }

  const bounds = video.getBoundingClientRect()

  return {
    connected: video.isConnected,
    height: bounds.height,
    readyState: video.readyState,
    videoWidth: video instanceof HTMLVideoElement ? video.videoWidth : 0,
    width: bounds.width,
  }
}

function surfaceHasLayout(video: HTMLMediaElement | null) {
  if (!video?.isConnected) {
    return false
  }

  const bounds = video.getBoundingClientRect()
  return bounds.width > 0 && bounds.height > 0
}

export async function waitForVisiblePlaybackSurface(video: HTMLMediaElement | null) {
  const visible = await waitForVisibleDocument()

  if (!visible) {
    logExpressPlaybackDebug('playback_surface_not_ready', {
      reason: 'document_not_visible',
      ...getSurfaceSnapshot(video),
      ...getExpressPlaybackContext(),
    })
    return false
  }

  await waitForAnimationFrames(SURFACE_READY_FRAMES)

  if (!surfaceHasLayout(video)) {
    logExpressPlaybackDebug('playback_surface_not_ready', {
      reason: 'surface_has_no_layout',
      ...getSurfaceSnapshot(video),
      ...getExpressPlaybackContext(),
    })
    return false
  }

  logExpressPlaybackDebug('playback_surface_ready', {
    ...getSurfaceSnapshot(video),
    ...getExpressPlaybackContext(),
  })
  return true
}
