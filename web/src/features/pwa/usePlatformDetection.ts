import { useMemo } from 'react'

export type ExpressPlatformKind = 'ios' | 'android' | 'mac-safari' | 'desktop' | 'unknown'

function isIpadOs(userAgent: string) {
  return /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1
}

export function usePlatformDetection() {
  return useMemo(() => {
    if (typeof navigator === 'undefined') {
      return {
        browserLabel: 'your browser',
        deviceLabel: 'your device',
        isAndroid: false,
        isChromium: false,
        isDesktop: false,
        isFirefox: false,
        isIos: false,
        isMacSafari: false,
        isSafari: false,
        platformKind: 'unknown' as ExpressPlatformKind,
      }
    }

    const userAgent = navigator.userAgent
    const isAndroid = /Android/i.test(userAgent)
    const isIos = /iPhone|iPad|iPod/i.test(userAgent) || isIpadOs(userAgent)
    const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|Chromium|Edg|OPR|Brave/i.test(userAgent)
    const isChromium = /Chrome|CriOS|Chromium|Edg|OPR|Brave/i.test(userAgent)
    const isFirefox = /firefox/i.test(userAgent)
    const isMac = /Macintosh|Mac OS X/i.test(userAgent) && !isIos
    const isMobile = isAndroid || isIos || /Mobile/i.test(userAgent)
    const isMacSafari = isMac && isSafari
    const isDesktop = !isMobile
    const platformKind: ExpressPlatformKind = isIos
      ? 'ios'
      : isAndroid
        ? 'android'
        : isMacSafari
          ? 'mac-safari'
          : isDesktop
            ? 'desktop'
            : 'unknown'

    return {
      browserLabel: isSafari ? 'Safari' : isChromium ? 'Chrome, Edge, or Brave' : 'your browser',
      deviceLabel: isIos ? 'iPhone or iPad' : isAndroid ? 'Android' : isMacSafari ? 'Mac Safari' : 'desktop',
      isAndroid,
      isChromium,
      isDesktop,
      isFirefox,
      isIos,
      isMacSafari,
      isSafari,
      platformKind,
    }
  }, [])
}
