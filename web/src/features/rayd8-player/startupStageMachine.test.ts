/**
 * Reproduction tests for the startup stage machine.
 *
 * INC-2026-08-06-PLAYBACK-TOKEN-CORS: the "Preparing Your RAYD8 Session / 0%"
 * overlay must be driven by an explicit stage machine that ALWAYS reaches a
 * terminal state (ready or failure). No path may leave the overlay up forever.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createStartupStageMachine } from './startupStageMachine'

describe('startup stage machine', () => {
  it('advances through the happy path to ready', () => {
    const machine = createStartupStageMachine({ videoRequired: true })
    machine.advance('AUTH_READINESS')
    machine.advance('ACCESS_CHECK')
    machine.advance('SESSION_CREATE')
    machine.advance('PLAYBACK_TOKEN')
    machine.advance('MEDIA_SOURCE_APPLY')
    machine.advance('MEDIA_METADATA')
    machine.advance('AUTOPLAY_PENDING')
    machine.advance('MEDIA_READY')
    machine.markReady()

    assert.equal(machine.state.status, 'ready')
    assert.equal(machine.state.overlayVisible, false)
  })

  it('terminal failure always hides the preparation overlay (no infinite 0%)', () => {
    const machine = createStartupStageMachine({ videoRequired: true })
    machine.advance('AUTH_READINESS')
    machine.advance('PLAYBACK_TOKEN')
    machine.fail({ stage: 'PLAYBACK_TOKEN', code: 'REQUEST_TIMEOUT' })

    assert.equal(machine.state.status, 'failed')
    assert.equal(machine.state.overlayVisible, false)
    assert.equal(machine.state.failure?.code, 'REQUEST_TIMEOUT')
  })

  it('failure from ANY stage is terminal and overlay-clearing', () => {
    const stages = [
      'AUTH_READINESS',
      'ACCESS_CHECK',
      'SESSION_CREATE',
      'PLAYBACK_TOKEN',
      'MEDIA_SOURCE_APPLY',
      'MEDIA_METADATA',
      'AUTOPLAY_PENDING',
      'PLAYBACK_HEALTH',
    ] as const
    for (const stage of stages) {
      const machine = createStartupStageMachine({ videoRequired: true })
      machine.advance(stage)
      machine.fail({ stage, code: 'UNKNOWN_FAILURE' })
      assert.equal(machine.state.status, 'failed', `stage ${stage}`)
      assert.equal(machine.state.overlayVisible, false, `stage ${stage}`)
    }
  })

  it('exposes a monotonic stage history for telemetry', () => {
    const machine = createStartupStageMachine({ videoRequired: true })
    machine.advance('AUTH_READINESS')
    machine.advance('PLAYBACK_TOKEN')
    machine.fail({ stage: 'PLAYBACK_TOKEN', code: 'NETWORK_OFFLINE' })

    const stages = machine.state.history.map((entry) => entry.stage)
    assert.deepEqual(stages, ['IDLE', 'AUTH_READINESS', 'PLAYBACK_TOKEN'])
    const times = machine.state.history.map((entry) => entry.atMs)
    for (let i = 1; i < times.length; i += 1) {
      assert.ok(times[i] >= times[i - 1], 'history timestamps must be monotonic')
    }
  })

  it('ignores advances after a terminal state (no zombie transitions)', () => {
    const machine = createStartupStageMachine({ videoRequired: true })
    machine.advance('PLAYBACK_TOKEN')
    machine.fail({ stage: 'PLAYBACK_TOKEN', code: 'REQUEST_TIMEOUT' })
    machine.advance('MEDIA_READY')
    machine.markReady()

    assert.equal(machine.state.status, 'failed')
  })

  it('tracks buffer progress only during media-waiting stages', () => {
    const machine = createStartupStageMachine({ videoRequired: true })
    machine.advance('AUTH_READINESS')
    machine.setBufferPercent(42)
    assert.equal(machine.state.displayPercent, null, 'pre-media stages show no fake percent')

    machine.advance('MEDIA_SOURCE_APPLY')
    machine.advance('MEDIA_METADATA')
    machine.setBufferPercent(42)
    assert.equal(machine.state.displayPercent, 42)
  })
})
