import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AvSyncController } from './avSyncController.ts'

function mockMedia(input: {
  currentTime: number
  paused?: boolean
  seeking?: boolean
  readyState?: number
  play?: () => Promise<void>
}): HTMLMediaElement {
  return {
    currentTime: input.currentTime,
    paused: input.paused ?? false,
    seeking: input.seeking ?? false,
    readyState: input.readyState ?? 4,
    currentSrc: 'https://example.test/stream.m3u8',
    play: input.play ?? (async () => undefined),
  } as HTMLMediaElement
}

const fastConfig = {
  thresholdSeconds: 0.5,
  releaseThresholdSeconds: 0.25,
  startupGraceMs: 0,
  minSecondsBetweenCorrections: 0,
  maxCorrectionsPerMinute: 20,
}

describe('AvSyncController', () => {
  it('does not correct when drift is under threshold', () => {
    const controller = new AvSyncController(fastConfig)
    const video = mockMedia({ currentTime: 10 })
    const audio = mockMedia({ currentTime: 10.2 })
    const sample = controller.reconcile(video, audio, 20_000)
    assert.equal(sample?.corrected, false)
    assert.equal(audio.currentTime, 10.2)
  })

  it('corrects audio toward video when drift exceeds threshold', () => {
    const controller = new AvSyncController(fastConfig)
    const video = mockMedia({ currentTime: 10 })
    const audio = mockMedia({ currentTime: 10 })
    controller.reconcile(video, audio, 20_000)
    video.currentTime = 30
    audio.currentTime = 10.01
    const sample = controller.reconcile(video, audio, 23_000)
    assert.equal(sample?.corrected, true)
    assert.ok(sample?.reason === 'seek' || sample?.reason === 'audio_stall_seek')
    assert.equal(audio.currentTime, 30)
  })

  it('resumes paused audio while video is playing', () => {
    let played = false
    const controller = new AvSyncController(fastConfig)
    const video = mockMedia({ currentTime: 12 })
    const audio = mockMedia({
      currentTime: 12,
      paused: true,
      play: async () => {
        played = true
      },
    })
    const sample = controller.reconcile(video, audio, 20_000)
    assert.equal(sample?.corrected, true)
    assert.equal(sample?.reason, 'audio_resume')
    assert.equal(played, true)
  })

  it('seeks stalled audio when video keeps advancing', () => {
    const controller = new AvSyncController(fastConfig)
    const video = mockMedia({ currentTime: 10 })
    const audio = mockMedia({ currentTime: 10 })
    controller.reconcile(video, audio, 20_000)
    video.currentTime = 25
    audio.currentTime = 10
    const sample = controller.reconcile(video, audio, 23_000)
    assert.equal(sample?.corrected, true)
    assert.equal(sample?.reason, 'audio_stall_seek')
    assert.equal(audio.currentTime, 25)
  })

  it('skips seek across a video loop wrap', () => {
    const controller = new AvSyncController(fastConfig)
    const video = mockMedia({ currentTime: 120 })
    const audio = mockMedia({ currentTime: 120 })
    controller.reconcile(video, audio, 20_000)
    video.currentTime = 1
    audio.currentTime = 125
    const sample = controller.reconcile(video, audio, 23_000)
    assert.equal(sample?.reason, 'skipped_loop_wrap')
    assert.equal(sample?.corrected, false)
    assert.equal(audio.currentTime, 125)
  })

  it('skips correction during startup grace', () => {
    const controller = new AvSyncController({ ...fastConfig, startupGraceMs: 8_000 })
    const video = mockMedia({ currentTime: 10 })
    const audio = mockMedia({ currentTime: 0 })
    const sample = controller.reconcile(video, audio, 1_000)
    assert.equal(sample?.reason, 'startup_grace')
    assert.equal(sample?.corrected, false)
  })

  it('skips correction while media is seeking', () => {
    const controller = new AvSyncController(fastConfig)
    const video = mockMedia({ currentTime: 10, seeking: true })
    const audio = mockMedia({ currentTime: 0 })
    const sample = controller.reconcile(video, audio, 20_000)
    assert.equal(sample?.reason, 'media_not_ready')
    assert.equal(sample?.corrected, false)
  })
})
