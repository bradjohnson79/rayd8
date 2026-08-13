import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { collectBrowserFingerprint } from './browserFingerprint.ts'
import {
  sanitizeSessionStartupSnapshot,
  type SessionStartupSnapshot,
} from './sessionStartupTelemetry.ts'

const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
const FIREFOX_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0'
const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15'
const OPERA_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 OPR/120.0.0.0'
const EDGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0'
const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'

describe('collectBrowserFingerprint', () => {
  it('detects Chrome on macOS desktop with blink + short major version', () => {
    const fp = collectBrowserFingerprint({ userAgent: CHROME_UA })
    assert.equal(fp.browserFamily, 'chrome')
    assert.equal(fp.browserVersion, '139')
    assert.equal(fp.renderingEngine, 'blink')
    assert.equal(fp.os, 'macos')
    assert.equal(fp.platformClass, 'desktop')
    assert.equal(fp.privateMode, null)
    assert.equal(fp.vpnOrProxyHint, null)
    assert.deepEqual(fp.privacyFeatures, [])
  })

  it('detects Brave via navigator.brave and emits brave_shields_hint', () => {
    const fp = collectBrowserFingerprint({ userAgent: CHROME_UA, brave: {} })
    assert.equal(fp.browserFamily, 'brave')
    assert.equal(fp.renderingEngine, 'blink')
    assert.ok(fp.privacyFeatures.includes('brave_shields_hint'))
  })

  it('detects Firefox + gecko + windows', () => {
    const fp = collectBrowserFingerprint({ userAgent: FIREFOX_UA })
    assert.equal(fp.browserFamily, 'firefox')
    assert.equal(fp.browserVersion, '142')
    assert.equal(fp.renderingEngine, 'gecko')
    assert.equal(fp.os, 'windows')
    assert.equal(fp.platformClass, 'desktop')
  })

  it('detects Safari + webkit + macos (no chrome tokens)', () => {
    const fp = collectBrowserFingerprint({ userAgent: SAFARI_UA })
    assert.equal(fp.browserFamily, 'safari')
    assert.equal(fp.browserVersion, '18')
    assert.equal(fp.renderingEngine, 'webkit')
    assert.equal(fp.os, 'macos')
  })

  it('detects Edge + blink and reports edge family', () => {
    const fp = collectBrowserFingerprint({ userAgent: EDGE_UA })
    assert.equal(fp.browserFamily, 'edge')
    assert.equal(fp.browserVersion, '139')
    assert.equal(fp.renderingEngine, 'blink')
  })

  it('detects Opera and emits opera_vpn_hint + opera_vpn_capability', () => {
    const fp = collectBrowserFingerprint({ userAgent: OPERA_UA })
    assert.equal(fp.browserFamily, 'opera')
    assert.equal(fp.browserVersion, '120')
    assert.equal(fp.renderingEngine, 'blink')
    assert.ok(fp.privacyFeatures.includes('opera_vpn_hint'))
    assert.equal(fp.vpnOrProxyHint, 'opera_vpn_capability')
  })

  it('classifies iOS Safari as mobile + ios', () => {
    const fp = collectBrowserFingerprint({ userAgent: IOS_SAFARI_UA })
    assert.equal(fp.browserFamily, 'safari')
    assert.equal(fp.os, 'ios')
    assert.equal(fp.platformClass, 'mobile')
  })

  it('honors userAgentData.mobile when UA looks desktop', () => {
    const fp = collectBrowserFingerprint({ userAgent: CHROME_UA, userAgentData: { mobile: true } })
    assert.equal(fp.platformClass, 'mobile')
  })

  it('returns an unknown fingerprint when navigator is unavailable', () => {
    const fp = collectBrowserFingerprint(undefined)
    // On Node there is no global navigator, so this exercises the SSR guard.
    assert.equal(fp.browserFamily, 'unknown')
    assert.equal(fp.browserVersion, null)
    assert.equal(fp.renderingEngine, 'unknown')
    assert.equal(fp.os, 'unknown')
    assert.equal(fp.platformClass, 'unknown')
    assert.equal(fp.privateMode, null)
    assert.equal(fp.vpnOrProxyHint, null)
    assert.deepEqual(fp.privacyFeatures, [])
  })
})

describe('sanitizeSessionStartupSnapshot keeps fingerprint fields, strips secrets', () => {
  function baseSnapshot(overrides: Partial<SessionStartupSnapshot> = {}): SessionStartupSnapshot {
    return {
      correlationId: 'rayd8-ss-test',
      kind: 'overlay_shown',
      ...overrides,
    }
  }

  it('keeps browserFamily / browserVersion / renderingEngine / os / privateMode / vpnOrProxyHint / privacyFeatureFlags', () => {
    const cleaned = sanitizeSessionStartupSnapshot(
      baseSnapshot({
        browserFamily: 'chrome',
        browserVersion: '139',
        renderingEngine: 'blink',
        os: 'macos',
        privateMode: false,
        vpnOrProxyHint: null,
        privacyFeatureFlags: 'brave_shields_hint|opera_vpn_hint',
      }),
    )
    assert.equal(cleaned.browserFamily, 'chrome')
    assert.equal(cleaned.browserVersion, '139')
    assert.equal(cleaned.renderingEngine, 'blink')
    assert.equal(cleaned.os, 'macos')
    assert.equal(cleaned.privateMode, false)
    // null values are dropped by sanitize
    assert.equal('vpnOrProxyHint' in cleaned, false)
    assert.equal(cleaned.privacyFeatureFlags, 'brave_shields_hint|opera_vpn_hint')
  })

  it('strips secret keys (token/jwt/email/etc.) but preserves fingerprint keys', () => {
    const cleaned = sanitizeSessionStartupSnapshot(
      baseSnapshot({
        browserFamily: 'firefox',
        browserVersion: '142',
        renderingEngine: 'gecko',
        os: 'windows',
        // @ts-expect-error intentional secret-key probes
        jwt: 'should-drop',
        // @ts-expect-error intentional secret-key probe
        email: 'should-drop@example.com',
        // @ts-expect-error intentional secret-key probe
        playback_id: 'should-drop',
      }),
    )
    assert.equal(cleaned.browserFamily, 'firefox')
    assert.equal(cleaned.browserVersion, '142')
    assert.equal(cleaned.renderingEngine, 'gecko')
    assert.equal(cleaned.os, 'windows')
    assert.equal(cleaned.jwt, undefined)
    assert.equal(cleaned.email, undefined)
    assert.equal(cleaned.playback_id, undefined)
  })

  it('does not treat fingerprint key names as secret (no false-positive strip)', () => {
    // Keys like privateMode / vpnOrProxyHint / privacyFeatureFlags must NOT
    // match the SECRET_KEY regex even though they contain "private"/"proxy".
    const cleaned = sanitizeSessionStartupSnapshot(
      baseSnapshot({
        privateMode: true,
        vpnOrProxyHint: 'opera_vpn_capability',
        privacyFeatureFlags: 'brave_shields_hint',
      }),
    )
    assert.equal(cleaned.privateMode, true)
    assert.equal(cleaned.vpnOrProxyHint, 'opera_vpn_capability')
    assert.equal(cleaned.privacyFeatureFlags, 'brave_shields_hint')
  })
})
