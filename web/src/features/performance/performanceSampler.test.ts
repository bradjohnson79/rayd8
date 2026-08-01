import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PerformanceSampler } from './performanceSampler'

describe('performanceSampler', () => {
  it('does not start high-frequency timers while idle', () => {
    const sampler = new PerformanceSampler()
    sampler.setActivityState('idle')
    assert.equal(sampler.getLastSample(), null)
    sampler.dispose()
  })

  it('accepts injected samples for policy tests', () => {
    const sampler = new PerformanceSampler()
    let seen = 0
    sampler.subscribe(() => {
      seen += 1
    })
    sampler.injectSample({
      at: 1,
      frameIntervalMs: 33,
      longTaskCountWindow: 0,
      heapUsedBytes: null,
      buffering: false,
      registeredResourceCount: 0,
      hidden: false,
    })
    assert.equal(seen, 1)
    sampler.dispose()
  })
})
