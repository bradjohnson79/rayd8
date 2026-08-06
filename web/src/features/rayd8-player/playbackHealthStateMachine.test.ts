import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createPlaybackHealthContext,
  evaluatePipelineHealthy,
  reducePlaybackHealth,
  shouldArmHardTimer,
  shouldPauseHardTimer,
  type MediaHealthSnapshot,
} from './playbackHealthStateMachine'

function mediaStub(overrides: Partial<HTMLMediaElement> = {}) {
  return {
    paused: false,
    readyState: 3,
    currentTime: 1,
    videoWidth: 1280,
    ...overrides,
  } as HTMLVideoElement
}

function baseSnapshot(overrides: Partial<MediaHealthSnapshot> = {}): MediaHealthSnapshot {
  return {
    video: mediaStub(),
    audio: null,
    mode: 'video',
    audioRequired: false,
    sourceApplied: true,
    autoplayPending: false,
    intentionallyPaused: false,
    documentHidden: false,
    offline: false,
    ending: false,
    replacingSource: false,
    tokenRefreshing: false,
    metadataReady: true,
    mediaOwned: true,
    ...overrides,
  }
}

describe('playbackHealthStateMachine', () => {
  it('does not arm hard timer before media ownership', () => {
    const ctx = createPlaybackHealthContext()
    const snapshot = baseSnapshot({ mediaOwned: false, sourceApplied: false })
    assert.equal(shouldArmHardTimer(ctx, snapshot), false)
  })

  it('pauses hard timer while hidden, offline, or autoplay pending', () => {
    assert.equal(shouldPauseHardTimer(baseSnapshot({ documentHidden: true })), true)
    assert.equal(shouldPauseHardTimer(baseSnapshot({ offline: true })), true)
    assert.equal(shouldPauseHardTimer(baseSnapshot({ autoplayPending: true })), true)
  })

  it('treats autoplay blocked as nonfatal waiting state', () => {
    const next = reducePlaybackHealth(createPlaybackHealthContext(), { type: 'AUTOPLAY_BLOCKED' })
    assert.equal(next.state, 'WAITING_FOR_AUTOPLAY')
    assert.equal(next.hardTimerArmed, false)
  })

  it('evaluates audio-only healthy without videoWidth', () => {
    const audio = mediaStub({ videoWidth: 0 } as Partial<HTMLMediaElement>) as HTMLAudioElement
    assert.equal(
      evaluatePipelineHealthy(
        baseSnapshot({
          mode: 'audio',
          video: null,
          audio,
          audioRequired: true,
        }),
      ),
      true,
    )
  })

  it('requires video dimensions for video mode', () => {
    assert.equal(
      evaluatePipelineHealthy(
        baseSnapshot({
          video: mediaStub({ videoWidth: 0 }),
        }),
      ),
      false,
    )
  })

  it('dual mode skips audio when not required', () => {
    assert.equal(
      evaluatePipelineHealthy(
        baseSnapshot({
          mode: 'dual',
          audioRequired: false,
          audio: null,
        }),
      ),
      true,
    )
  })

  it('resumes from hidden without preserving failed state incorrectly', () => {
    let ctx = reducePlaybackHealth(createPlaybackHealthContext(), { type: 'MEDIA_OWNED' })
    ctx = reducePlaybackHealth(ctx, { type: 'PIPELINE_PROGRESS', state: 'WAITING_FOR_MEDIA_PROGRESS' })
    ctx = reducePlaybackHealth(ctx, { type: 'HIDDEN' })
    assert.equal(ctx.state, 'PAUSED_HIDDEN')
    ctx = reducePlaybackHealth(ctx, { type: 'VISIBLE' })
    assert.equal(ctx.state, 'WAITING_FOR_MEDIA_PROGRESS')
  })

  it('hard fail only via explicit event', () => {
    const ctx = reducePlaybackHealth(createPlaybackHealthContext(), {
      type: 'HARD_FAIL',
      reason: 'startup_health_timeout',
    })
    assert.equal(ctx.state, 'FAILED')
  })
})
