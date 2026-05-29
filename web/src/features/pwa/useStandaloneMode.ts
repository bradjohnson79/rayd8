import { useSyncExternalStore } from 'react'

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

export function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') {
    return false
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  )
}

function subscribeToStandaloneMode(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const standaloneQuery = window.matchMedia('(display-mode: standalone)')
  const overlayQuery = window.matchMedia('(display-mode: window-controls-overlay)')
  standaloneQuery.addEventListener('change', listener)
  overlayQuery.addEventListener('change', listener)
  window.addEventListener('focus', listener)
  window.addEventListener('pageshow', listener)

  return () => {
    standaloneQuery.removeEventListener('change', listener)
    overlayQuery.removeEventListener('change', listener)
    window.removeEventListener('focus', listener)
    window.removeEventListener('pageshow', listener)
  }
}

export function useStandaloneMode() {
  return useSyncExternalStore(subscribeToStandaloneMode, isStandaloneDisplayMode, () => false)
}
