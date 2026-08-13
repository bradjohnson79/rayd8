/**
 * Reproduction tests for media-qualified usage accounting.
 *
 * INC-2026-08-06-VIDEO-LOOP: trial usage was consumed while the video looped
 * in a broken state. Usage may only accrue when the REQUIRED media for the
 * session mode is actually healthy and playing.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isUsageQualified, type UsageQualificationInput } from './mediaQualification'

function baseInput(overrides: Partial<UsageQualificationInput> = {}): UsageQualificationInput {
  return {
    sessionMode: 'dual',
    audioPlaying: true,
    audioCurrentTime: 30,
    videoPlaying: true,
    videoCurrentTime: 30,
    videoReadyState: 4,
    videoWidth: 1280,
    startupStatus: 'ready',
    ...overrides,
  }
}

describe('isUsageQualified', () => {
  it('qualifies when dual-mode audio+video are healthy', () => {
    assert.equal(isUsageQualified(baseInput()).qualified, true)
  })

  it('does NOT qualify when video is stalled but audio continues (the incident case)', () => {
    const result = isUsageQualified(
      baseInput({ videoPlaying: false, videoCurrentTime: 0, videoReadyState: 1, videoWidth: 0 }),
    )
    assert.equal(result.qualified, false)
    assert.equal(result.reason, 'video_unhealthy')
  })

  it('does NOT qualify during startup (before ready)', () => {
    const result = isUsageQualified(baseInput({ startupStatus: 'starting' }))
    assert.equal(result.qualified, false)
    assert.equal(result.reason, 'startup_incomplete')
  })

  it('does NOT qualify after terminal startup failure', () => {
    const result = isUsageQualified(baseInput({ startupStatus: 'failed' }))
    assert.equal(result.qualified, false)
  })

  it('qualifies in audio-only mode with healthy audio and no video', () => {
    const result = isUsageQualified(
      baseInput({
        sessionMode: 'audio_only',
        videoPlaying: false,
        videoCurrentTime: 0,
        videoReadyState: 0,
        videoWidth: 0,
      }),
    )
    assert.equal(result.qualified, true)
  })

  it('does NOT qualify in audio-only mode when audio is not playing', () => {
    const result = isUsageQualified(
      baseInput({
        sessionMode: 'audio_only',
        audioPlaying: false,
        audioCurrentTime: 0,
        videoPlaying: false,
        videoCurrentTime: 0,
        videoReadyState: 0,
        videoWidth: 0,
      }),
    )
    assert.equal(result.qualified, false)
    assert.equal(result.reason, 'audio_unhealthy')
  })

  it('does NOT qualify when video has no decoded frames (videoWidth 0)', () => {
    const result = isUsageQualified(baseInput({ videoWidth: 0 }))
    assert.equal(result.qualified, false)
  })
})
