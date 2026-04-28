export function isMobileViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth < 768
}

export function isTabletViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth >= 768 && window.innerWidth < 1024
}

export function isSmallScreen() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerHeight < 700
}

export function isMobileOrTabletViewport() {
  return isMobileViewport() || isTabletViewport()
}
