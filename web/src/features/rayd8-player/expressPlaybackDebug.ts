type ExpressPlaybackDebugMeta = Record<string, unknown>

function debugEnabled() {
  if (!import.meta.env.DEV) {
    return false
  }

  if (typeof window === 'undefined') {
    return true
  }

  return window.localStorage.getItem('rayd8-express-playback-debug') !== 'false'
}

export function logExpressPlaybackDebug(event: string, meta?: ExpressPlaybackDebugMeta) {
  if (!debugEnabled()) {
    return
  }

  if (meta) {
    console.info(`[RAYD8 Express Playback] ${event}`, meta)
    return
  }

  console.info(`[RAYD8 Express Playback] ${event}`)
}
