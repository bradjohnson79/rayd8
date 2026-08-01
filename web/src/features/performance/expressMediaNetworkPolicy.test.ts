import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyExpressMediaNetworkPolicy,
  getExpressMediaNetworkState,
  recommendMediaPolicyFromBuffering,
  setExpressMediaFragileOperation,
} from './expressMediaNetworkPolicy'

describe('expressMediaNetworkPolicy', () => {
  it('does not force quality changes during fragile operations', () => {
    setExpressMediaFragileOperation(true)
    assert.equal(
      recommendMediaPolicyFromBuffering({
        buffering: true,
        decoderHealthy: false,
        now: 1_000_000,
      }),
      null,
    )
    setExpressMediaFragileOperation(false)
  })

  it('requires residence before recovering from conservative', () => {
    applyExpressMediaNetworkPolicy('conservative', 'test', 0)
    assert.equal(
      recommendMediaPolicyFromBuffering({
        buffering: false,
        decoderHealthy: true,
        now: 10_000,
      }),
      null,
    )
    assert.equal(
      recommendMediaPolicyFromBuffering({
        buffering: false,
        decoderHealthy: true,
        now: 200_000,
      }),
      'standard',
    )
    assert.equal(getExpressMediaNetworkState().policy, 'conservative')
  })
})
