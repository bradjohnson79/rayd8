import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  RecoveryStateMachine,
  simulateUnboundedRecoveryStorm,
} from './recoveryStateMachine.ts'

describe('RecoveryStateMachine', () => {
  it('denies unbounded major recovery storms and becomes terminal', () => {
    const machine = new RecoveryStateMachine({
      maxMajorPerWindow: 3,
      maxMajorPerSession: 8,
      maxLoadSourcePerSession: 6,
      baseBackoffMs: 1_000,
      maxBackoffMs: 5_000,
      windowMs: 5 * 60_000,
    })

    const result = simulateUnboundedRecoveryStorm(machine, 40)

    assert.ok(result.allowed <= 8, `allowed=${result.allowed}`)
    assert.ok(result.denied > 0, 'expected denials')
    assert.equal(result.terminal, true)
  })

  it('always allows soft resume unless terminal', () => {
    const machine = new RecoveryStateMachine()
    const permit = machine.request('video', 'soft_resume', 'pause')
    assert.equal(permit.allowed, true)
    assert.equal(permit.action, 'soft_resume')
  })

  it('caps loadSource separately from start_load', () => {
    const machine = new RecoveryStateMachine({
      maxMajorPerWindow: 20,
      maxMajorPerSession: 20,
      maxLoadSourcePerSession: 2,
      baseBackoffMs: 0,
      maxBackoffMs: 0,
      windowMs: 60_000,
    })

    let now = Date.now()
    for (let i = 0; i < 2; i += 1) {
      const permit = machine.request('token', 'load_source', 'refresh', now)
      assert.equal(permit.allowed, true)
      machine.begin('token', 'load_source', 'refresh', now)
      machine.complete(true)
      now += 10_000
    }

    const denied = machine.request('token', 'load_source', 'refresh', now)
    assert.equal(denied.allowed, false)
    assert.equal(denied.terminal, true)
  })
})
