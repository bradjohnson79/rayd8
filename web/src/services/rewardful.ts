const REWARDFUL_ATTRIBUTION_KEY = 'rewardful_via'
const REWARDFUL_COOKIE_NAME = 'rewardful_via'
const REWARDFUL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90
const PRODUCTION_HOSTS = new Set(['rayd8.app', 'www.rayd8.app'])

type RewardfulCommand = 'convert'

declare global {
  interface Window {
    _rwq?: string
    rewardful?: {
      (command: RewardfulCommand, payload: { email: string }): void
      q?: unknown[]
    }
  }
}

function normalizeVia(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function getCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return ''
  }

  const encodedName = `${encodeURIComponent(name)}=`
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName))

  return match ? decodeURIComponent(match.slice(encodedName.length)) : ''
}

function setCookieValue(name: string, value: string) {
  if (typeof document === 'undefined') {
    return
  }

  const secureAttribute = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Max-Age=${REWARDFUL_COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
    secureAttribute,
  ].join('; ')
}

function clearCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return
  }

  const secureAttribute = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = [
    `${encodeURIComponent(name)}=`,
    'Max-Age=0',
    'Path=/',
    'SameSite=Lax',
    secureAttribute,
  ].join('; ')
}

function getRewardfulConversionKey(sessionId: string, email: string) {
  return `rewardful_conversion_${sessionId}_${email.toLowerCase()}`
}

export function getStoredRewardfulVia() {
  if (typeof window === 'undefined') {
    return ''
  }

  return (
    normalizeVia(window.localStorage.getItem(REWARDFUL_ATTRIBUTION_KEY)) ||
    normalizeVia(getCookieValue(REWARDFUL_COOKIE_NAME))
  )
}

export function storeRewardfulVia(value: string) {
  if (typeof window === 'undefined') {
    return
  }

  const via = normalizeVia(value)

  if (!via) {
    return
  }

  window.localStorage.setItem(REWARDFUL_ATTRIBUTION_KEY, via)
  setCookieValue(REWARDFUL_COOKIE_NAME, via)
}

export function syncStoredRewardfulVia() {
  const via = getStoredRewardfulVia()

  if (via) {
    storeRewardfulVia(via)
  }

  return via
}

export function clearStoredRewardfulVia() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(REWARDFUL_ATTRIBUTION_KEY)
  clearCookieValue(REWARDFUL_COOKIE_NAME)
}

export function captureRewardfulViaFromSearch(search: string) {
  const via = normalizeVia(new URLSearchParams(search).get('via'))

  if (!via) {
    syncStoredRewardfulVia()
    return ''
  }

  storeRewardfulVia(via)
  return via
}

export function isRewardfulConversionEnvironment() {
  return typeof window !== 'undefined' && PRODUCTION_HOSTS.has(window.location.hostname)
}

export function hasTrackedRewardfulConversion(sessionId: string, email: string) {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(getRewardfulConversionKey(sessionId, email)) === 'tracked'
}

export function trackRewardfulConversion(input: { email: string; sessionId: string }) {
  if (typeof window === 'undefined' || !isRewardfulConversionEnvironment()) {
    return { tracked: false, reason: 'non_production' as const }
  }

  const email = input.email.trim()
  const sessionId = input.sessionId.trim()

  if (!email || !sessionId) {
    return { tracked: false, reason: 'invalid_payload' as const }
  }

  const conversionKey = getRewardfulConversionKey(sessionId, email)

  if (window.localStorage.getItem(conversionKey) === 'tracked') {
    return { tracked: false, reason: 'duplicate' as const }
  }

  if (typeof window.rewardful !== 'function') {
    return { tracked: false, reason: 'unavailable' as const }
  }

  window.rewardful('convert', { email })
  window.localStorage.setItem(conversionKey, 'tracked')
  clearStoredRewardfulVia()

  return { tracked: true, reason: 'tracked' as const }
}

