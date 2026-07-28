import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  _resetPlaybackIncidentDedupeForTests,
  isAbnormalPlaybackIncident,
  sanitizePlaybackIncidentPayload,
  shouldEmitPlaybackIncident,
} from './playbackIncidentTelemetry.ts'

describe('playbackIncidentTelemetry', () => {
  it('redacts token query params and secret keys', () => {
    const cleaned = sanitizePlaybackIncidentPayload({
      correlationId: 'rayd8-pb-test',
      freezeClass: 'browser_tab_freeze',
      reason: 'https://stream.mux.com/abc.m3u8?token=eyJhbGciOiJIUzI1NiJ9.payload.sig',
      // @ts-expect-error intentional secret key probe
      jwt: 'should-drop',
    })
    assert.equal(cleaned.correlationId, 'rayd8-pb-test')
    assert.equal(cleaned.freezeClass, 'browser_tab_freeze')
    assert.match(String(cleaned.reason), /token=\[redacted\]/)
    assert.equal(cleaned.jwt, undefined)
  })

  it('classifies only abnormal freeze classes for emission', () => {
    assert.equal(isAbnormalPlaybackIncident('av_desync'), false)
    assert.equal(isAbnormalPlaybackIncident('browser_tab_freeze'), true)
    assert.equal(isAbnormalPlaybackIncident('media_stall'), true)
  })

  it('deduplicates identical incidents within TTL', () => {
    _resetPlaybackIncidentDedupeForTests()
    assert.equal(shouldEmitPlaybackIncident('a|b', 1_000), true)
    assert.equal(shouldEmitPlaybackIncident('a|b', 2_000), false)
    assert.equal(shouldEmitPlaybackIncident('a|b', 70_000), true)
  })
})
