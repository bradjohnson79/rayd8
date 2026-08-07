/**
 * Reproduction tests for startup instrumentation counters.
 *
 * The incidents showed repeated request sequences and silent loops. Startup
 * must emit structured counters: token requests, media mounts, recovery
 * attempts, and stage timings — all redaction-safe.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createStartupInstrumentation } from './startupInstrumentation'

describe('startup instrumentation', () => {
  it('counts playback token requests per startup attempt', () => {
    const inst = createStartupInstrumentation()
    inst.beginAttempt()
    inst.recordTokenRequest()
    inst.recordTokenRequest()
    const snapshot = inst.snapshot()
    assert.equal(snapshot.tokenRequestCount, 2)
  })

  it('counts media mounts and recovery attempts', () => {
    const inst = createStartupInstrumentation()
    inst.beginAttempt()
    inst.recordMediaMount()
    inst.recordMediaMount()
    inst.recordMediaMount()
    inst.recordRecoveryAttempt('soft')
    inst.recordRecoveryAttempt('major')
    const snapshot = inst.snapshot()
    assert.equal(snapshot.mediaMountCount, 3)
    assert.equal(snapshot.softRecoveryCount, 1)
    assert.equal(snapshot.majorRecoveryCount, 1)
  })

  it('resets counters on a new attempt but keeps a session total', () => {
    const inst = createStartupInstrumentation()
    inst.beginAttempt()
    inst.recordTokenRequest()
    inst.beginAttempt()
    inst.recordTokenRequest()
    const snapshot = inst.snapshot()
    assert.equal(snapshot.tokenRequestCount, 1)
    assert.equal(snapshot.sessionTokenRequestTotal, 2)
    assert.equal(snapshot.attemptNumber, 2)
  })

  it('records stage timings in order', () => {
    const inst = createStartupInstrumentation()
    inst.beginAttempt()
    inst.recordStage('AUTH_READINESS')
    inst.recordStage('PLAYBACK_TOKEN')
    inst.recordStage('MEDIA_READY')
    const snapshot = inst.snapshot()
    assert.deepEqual(
      snapshot.stages.map((s) => s.stage),
      ['AUTH_READINESS', 'PLAYBACK_TOKEN', 'MEDIA_READY'],
    )
  })

  it('detects non-monotonic stage cycles (overlay flicker signature)', () => {
    const inst = createStartupInstrumentation()
    inst.beginAttempt()
    inst.recordStage('PLAYBACK_TOKEN')
    inst.recordStage('MEDIA_SOURCE_APPLY')
    inst.recordStage('PLAYBACK_TOKEN')
    const snapshot = inst.snapshot()
    assert.equal(snapshot.hasNonMonotonicCycle, true)
    assert.equal(snapshot.nonMonotonicCycles.length, 1)
    assert.equal(snapshot.nonMonotonicCycles[0]?.from, 'MEDIA_SOURCE_APPLY')
    assert.equal(snapshot.nonMonotonicCycles[0]?.to, 'PLAYBACK_TOKEN')
  })

  it('counts element/controller/source/overlay/health-guard events', () => {
    const inst = createStartupInstrumentation()
    inst.beginAttempt()
    inst.recordVideoElementCreate()
    inst.recordAudioElementCreate()
    inst.recordControllerCreate('hls')
    inst.recordControllerCreate('native')
    inst.recordSourceAssignment()
    inst.recordOverlayMount()
    inst.recordOverlayRender()
    inst.recordOverlayRender()
    inst.recordHealthGuardActivation()
    const snapshot = inst.snapshot()
    assert.equal(snapshot.videoElementCreateCount, 1)
    assert.equal(snapshot.audioElementCreateCount, 1)
    assert.equal(snapshot.hlsControllerCreateCount, 1)
    assert.equal(snapshot.nativeControllerCreateCount, 1)
    assert.equal(snapshot.sourceAssignmentCount, 1)
    assert.equal(snapshot.overlayMountCount, 1)
    assert.equal(snapshot.overlayRenderCount, 2)
    assert.equal(snapshot.healthGuardActivationCount, 1)
  })

  it('records timing phase durations', () => {
    const inst = createStartupInstrumentation()
    inst.beginAttempt()
    inst.markTimingPhase('playback_token')
    inst.endTimingPhase('playback_token')
    const snapshot = inst.snapshot()
    assert.equal(typeof snapshot.timingPhasesMs.playback_token, 'number')
    assert.ok((snapshot.timingPhasesMs.playback_token ?? -1) >= 0)
  })

  it('snapshot contains no tokens, URLs, or PII', () => {
    const inst = createStartupInstrumentation()
    inst.beginAttempt()
    inst.recordTokenRequest()
    inst.recordStage('PLAYBACK_TOKEN')
    const raw = JSON.stringify(inst.snapshot())
    assert.equal(raw.includes('signed_url'), false)
    assert.equal(raw.includes('token='), false)
    assert.equal(raw.includes('eyJ'), false, 'no JWT fragments')
  })
})
