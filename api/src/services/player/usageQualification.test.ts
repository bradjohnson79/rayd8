/**
 * Reproduction tests for server-side usage qualification.
 *
 * INC-2026-08-06-VIDEO-LOOP: heartbeats must not accrue trial usage when the
 * client reports the required media is not qualified (e.g. video dead while
 * audio continues). The server must never trust raw elapsed time alone.
 */
import { describe, expect, it } from 'vitest'
import { computeQualifiedHeartbeatAccrual } from './usageQualification.js'

describe('computeQualifiedHeartbeatAccrual', () => {
  it('accrues full elapsed seconds when media is qualified', () => {
    const result = computeQualifiedHeartbeatAccrual({
      elapsedSeconds: 30,
      maxHeartbeatSeconds: 30,
      mediaQualified: true,
    })
    expect(result.accrualSeconds).toBe(30)
    expect(result.qualified).toBe(true)
  })

  it('accrues ZERO when media is not qualified (incident case)', () => {
    const result = computeQualifiedHeartbeatAccrual({
      elapsedSeconds: 30,
      maxHeartbeatSeconds: 30,
      mediaQualified: false,
    })
    expect(result.accrualSeconds).toBe(0)
    expect(result.qualified).toBe(false)
  })

  it('clamps runaway elapsed time to the heartbeat cap', () => {
    const result = computeQualifiedHeartbeatAccrual({
      elapsedSeconds: 9_999,
      maxHeartbeatSeconds: 30,
      mediaQualified: true,
    })
    expect(result.accrualSeconds).toBe(30)
  })

  it('treats a missing mediaQualified flag as unqualified (fail closed)', () => {
    const result = computeQualifiedHeartbeatAccrual({
      elapsedSeconds: 30,
      maxHeartbeatSeconds: 30,
      mediaQualified: undefined,
    })
    expect(result.accrualSeconds).toBe(0)
    expect(result.qualified).toBe(false)
  })

  it('never accrues negative time', () => {
    const result = computeQualifiedHeartbeatAccrual({
      elapsedSeconds: -5,
      maxHeartbeatSeconds: 30,
      mediaQualified: true,
    })
    expect(result.accrualSeconds).toBe(0)
  })
})
