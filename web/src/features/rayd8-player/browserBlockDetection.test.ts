/**
 * Reproduction tests for browser-blocked media classification.
 *
 * INC-2026-08-06-VIDEO-LOOP (Brave/macOS + Brave/Linux): when the browser
 * blocks or starves media delivery, the player must classify BROWSER_BLOCKED
 * and show actionable copy instead of looping silently while audio continues.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyBrowserBlock,
  detectBrowserFamily,
  type BrowserBlockSignals,
} from './browserBlockDetection'

function baseSignals(overrides: Partial<BrowserBlockSignals> = {}): BrowserBlockSignals {
  return {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    isBrave: false,
    videoReadyState: 0,
    videoCurrentTime: 0,
    videoNetworkState: 2,
    videoError: null,
    audioPlaying: true,
    elapsedMs: 12_000,
    manifestRequests: 6,
    segmentRequests: 0,
    ...overrides,
  }
}

describe('detectBrowserFamily', () => {
  it('detects Brave via the brave UA token or navigator.brave signal', () => {
    assert.equal(detectBrowserFamily(baseSignals({ isBrave: true })), 'brave')
  })

  it('detects Firefox', () => {
    assert.equal(
      detectBrowserFamily(
        baseSignals({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0' }),
      ),
      'firefox',
    )
  })

  it('detects Chrome', () => {
    assert.equal(detectBrowserFamily(baseSignals()), 'chrome')
  })

  it('detects Safari/WebKit', () => {
    assert.equal(
      detectBrowserFamily(
        baseSignals({
          userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
        }),
      ),
      'safari',
    )
  })
})

describe('classifyBrowserBlock', () => {
  it('flags BROWSER_BLOCKED when audio plays but video never loads on Brave', () => {
    const result = classifyBrowserBlock(baseSignals({ isBrave: true }))
    assert.equal(result.blocked, true)
    assert.equal(result.code, 'BROWSER_BLOCKED')
    assert.equal(result.family, 'brave')
  })

  it('flags BROWSER_BLOCKED when segment requests never start on any browser', () => {
    const result = classifyBrowserBlock(baseSignals({ isBrave: false }))
    assert.equal(result.blocked, true)
    assert.equal(result.code, 'BROWSER_BLOCKED')
  })

  it('does NOT flag when video is progressing', () => {
    const result = classifyBrowserBlock(
      baseSignals({ videoReadyState: 3, videoCurrentTime: 12.5, segmentRequests: 40 }),
    )
    assert.equal(result.blocked, false)
  })

  it('does NOT flag during the startup grace window', () => {
    const result = classifyBrowserBlock(baseSignals({ elapsedMs: 3_000 }))
    assert.equal(result.blocked, false)
  })

  it('does NOT flag when audio is also dead (generic stall, not browser block)', () => {
    const result = classifyBrowserBlock(baseSignals({ audioPlaying: false }))
    assert.equal(result.blocked, false)
  })

  it('treats MEDIA_ERR_SRC_NOT_SUPPORTED with audio alive as browser block', () => {
    const result = classifyBrowserBlock(
      baseSignals({ videoError: { code: 4, message: 'DEMUXER_ERROR' } }),
    )
    assert.equal(result.blocked, true)
    assert.equal(result.code, 'BROWSER_BLOCKED')
  })
})
