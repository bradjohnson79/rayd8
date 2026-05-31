import { isStandaloneDisplayMode } from '../pwa/useStandaloneMode'

type ExpressPlaybackDebugMeta = Record<string, unknown>

function debugEnabled() {
  if (typeof window === 'undefined') {
    return import.meta.env.DEV
  }

  const storageValue = window.localStorage.getItem('rayd8-express-playback-debug')

  return import.meta.env.DEV ? storageValue !== 'false' : storageValue === 'true'
}

function getDisplayMode() {
  if (typeof window === 'undefined') {
    return 'server'
  }

  if (window.matchMedia('(display-mode: standalone)').matches) {
    return 'standalone'
  }

  if (window.matchMedia('(display-mode: window-controls-overlay)').matches) {
    return 'window-controls-overlay'
  }

  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return 'fullscreen'
  }

  if (window.matchMedia('(display-mode: minimal-ui)').matches) {
    return 'minimal-ui'
  }

  return 'browser'
}

function getBrowserName(userAgent: string) {
  if (userAgent.includes('Edg/')) {
    return 'edge'
  }

  if (userAgent.includes('Firefox/')) {
    return 'firefox'
  }

  if (userAgent.includes('SamsungBrowser/')) {
    return 'samsung-chrome'
  }

  if (userAgent.includes('Chrome/') || userAgent.includes('CriOS/')) {
    return 'chrome'
  }

  if (userAgent.includes('Safari/')) {
    return 'safari'
  }

  return 'unknown'
}

function getDeviceName(userAgent: string) {
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return 'ios'
  }

  if (userAgent.includes('Android')) {
    return 'android'
  }

  if (/Macintosh|Windows|Linux/.test(userAgent)) {
    return 'desktop'
  }

  return 'unknown'
}

export function getExpressPlaybackContext(): ExpressPlaybackDebugMeta {
  if (typeof window === 'undefined') {
    return {
      browser: 'server',
      device: 'server',
      displayMode: 'server',
      isStandalone: false,
      visibilityState: 'server',
    }
  }

  const userAgent = navigator.userAgent.slice(0, 160)

  return {
    browser: getBrowserName(userAgent),
    device: getDeviceName(userAgent),
    displayMode: getDisplayMode(),
    isStandalone: isStandaloneDisplayMode(),
    userAgent,
    visibilityState: document.visibilityState,
  }
}

export function logExpressPlaybackDebug(event: string, meta?: ExpressPlaybackDebugMeta) {
  if (!debugEnabled()) {
    return
  }

  const payload = {
    ...getExpressPlaybackContext(),
    ...meta,
  }

  if (meta) {
    console.info(`[RAYD8 Express Playback] ${event}`, payload)
    return
  }

  console.info(`[RAYD8 Express Playback] ${event}`, payload)
}
