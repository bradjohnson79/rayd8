/**
 * Privacy-safe, non-identifying browser fingerprint for session-startup telemetry.
 *
 * Collects only coarse, non-PII signals: browser family, short major version,
 * rendering engine family, coarse OS, platform class, best-effort private-mode
 * flag, coarse VPN/proxy hints, and detectable privacy-feature hints.
 *
 * NEVER includes: email, IP addresses, full UA dumps, language/region,
 * timezone, screen resolution, canvas/WebGL hashes, or any value that could
 * re-identify a user. Version strings are truncated to the major version.
 *
 * Detection is best-effort and degrades gracefully: unknown fields resolve to
 * `null` (or `'unknown'`) rather than guessing.
 */

export type BrowserFamily =
  | 'brave'
  | 'opera'
  | 'firefox'
  | 'safari'
  | 'chrome'
  | 'edge'
  | 'unknown'

export type RenderingEngine = 'blink' | 'gecko' | 'webkit' | 'unknown'

export type PlatformClass = 'mobile' | 'desktop' | 'unknown'

export type BrowserFingerprint = {
  browserFamily: BrowserFamily
  /** Major version only (e.g. "139"), or null when not extractable. */
  browserVersion: string | null
  renderingEngine: RenderingEngine
  /** Coarse OS family, never build/patch level. */
  os: 'windows' | 'macos' | 'ios' | 'android' | 'linux' | 'chromeos' | 'unknown'
  platformClass: PlatformClass
  /** Best-effort private/incognito mode detection; null when unknown. */
  privateMode: boolean | null
  /** Coarse VPN/proxy hint (e.g. "opera_vpn_capability"); null when unknown. */
  vpnOrProxyHint: string | null
  /** Detectable privacy-feature hints, no PII. */
  privacyFeatures: string[]
}

type NavigatorLike = {
  userAgent: string
  userAgentData?: {
    mobile?: boolean
    platform?: string
    brands?: Array<{ brand: string; version: string }>
  }
  brave?: unknown
  standalone?: boolean
  storage?: { estimate?: () => Promise<unknown> }
}

/**
 * Extract a short major version from a UA fragment like "Chrome/139.0.0.0".
 * Returns null when no numeric version is found.
 */
function extractMajorVersion(userAgent: string, family: BrowserFamily): string | null {
  const patterns: Record<BrowserFamily, RegExp | null> = {
    brave: /(?:Chrome|Chromium)\/(\d+)/,
    opera: /(?:OPR|Opera)\/(\d+)/,
    firefox: /Firefox\/(\d+)/,
    safari: /Version\/(\d+)/,
    chrome: /(?:Chrome|Chromium|CriOS|Edg)\/(\d+)/,
    edge: /Edg\/(\d+)/,
    unknown: null,
  }
  const pattern = patterns[family]
  if (!pattern) return null
  const match = userAgent.match(pattern)
  return match && match[1] ? match[1] : null
}

function detectFamily(ua: string, isBrave: boolean): BrowserFamily {
  if (isBrave) return 'brave'
  if (/OPR\/|Opera\/|OPiOS/i.test(ua)) return 'opera'
  if (/Edg\//i.test(ua)) return 'edge'
  if (/Firefox\//i.test(ua)) return 'firefox'
  if (/FxiOS/i.test(ua)) return 'firefox'
  if (/Chrome|Chromium|CriOS/i.test(ua)) return 'chrome'
  if (/Safari\//i.test(ua) && !/Chrome|CriOS|Edg|OPR|Opera/i.test(ua)) return 'safari'
  return 'unknown'
}

function detectEngine(family: BrowserFamily): RenderingEngine {
  switch (family) {
    case 'firefox':
      return 'gecko'
    case 'safari':
      return 'webkit'
    case 'brave':
    case 'opera':
    case 'chrome':
    case 'edge':
      return 'blink'
    default:
      return 'unknown'
  }
}

function detectOs(ua: string): BrowserFingerprint['os'] {
  if (/Windows NT/i.test(ua)) return 'windows'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/CrOS/i.test(ua)) return 'chromeos'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos'
  if (/Linux/i.test(ua)) return 'linux'
  return 'unknown'
}

function detectPlatformClass(ua: string, nav?: NavigatorLike): PlatformClass {
  if (nav?.userAgentData?.mobile === true) return 'mobile'
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile'
  if (/Windows NT|Macintosh|Linux|CrOS/i.test(ua)) return 'desktop'
  return 'unknown'
}

/**
 * Best-effort private/incognito detection. Returns null when unknown.
 * Uses only non-PII, side-effect-free probes; never reads storage contents.
 */
function detectPrivateMode(nav: NavigatorLike): boolean | null {
  try {
    // ServiceWorker is unavailable in some private contexts on older engines;
    // absence alone is not conclusive, so we only hint true when paired with
    // a storage probe failure below.
    if (typeof nav.storage?.estimate !== 'function') {
      // No storage API to probe; cannot conclude.
      return null
    }
  } catch {
    return null
  }

  // Safari: a thrown/zero-quota storage estimate is a known private-mode signal.
  // We do NOT await here (keep the function sync + non-blocking); a synchronous
  // probe via FileSystemAccess is deprecated and removed, so we conservatively
  // return null rather than guess from a pending promise.
  return null
}

function detectPrivacyFeatures(
  family: BrowserFamily,
  isBrave: boolean,
): string[] {
  const features: string[] = []
  if (isBrave || family === 'brave') features.push('brave_shields_hint')
  if (family === 'opera') features.push('opera_vpn_hint')
  return features
}

function detectVpnOrProxyHint(family: BrowserFamily): string | null {
  // We cannot reliably detect active VPN/proxy without PII (IP, timezone, etc.).
  // Coarse capability hint only: Opera ships a built-in VPN.
  if (family === 'opera') return 'opera_vpn_capability'
  return null
}

/**
 * Collect a privacy-safe, non-identifying browser fingerprint.
 *
 * Accepts an optional navigator override for testability; in browsers it reads
 * the global `navigator`. SSR-safe: returns an "unknown" fingerprint when
 * `navigator` is unavailable.
 */
export function collectBrowserFingerprint(nav?: NavigatorLike): BrowserFingerprint {
  const navigatorRef: NavigatorLike | undefined =
    nav ?? (typeof navigator !== 'undefined' ? (navigator as NavigatorLike) : undefined)

  if (!navigatorRef) {
    return {
      browserFamily: 'unknown',
      browserVersion: null,
      renderingEngine: 'unknown',
      os: 'unknown',
      platformClass: 'unknown',
      privateMode: null,
      vpnOrProxyHint: null,
      privacyFeatures: [],
    }
  }

  const ua = navigatorRef.userAgent ?? ''
  const isBrave = Boolean(navigatorRef.brave) || /brave/i.test(ua)
  const family = detectFamily(ua, isBrave)
  const version = extractMajorVersion(ua, family)

  return {
    browserFamily: family,
    browserVersion: version,
    renderingEngine: detectEngine(family),
    os: detectOs(ua),
    platformClass: detectPlatformClass(ua, navigatorRef),
    privateMode: detectPrivateMode(navigatorRef),
    vpnOrProxyHint: detectVpnOrProxyHint(family),
    privacyFeatures: detectPrivacyFeatures(family, isBrave),
  }
}
