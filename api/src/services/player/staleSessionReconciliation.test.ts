import { describe, expect, it } from 'vitest'
import { isHeartbeatStale, reconcileStaleSessions } from './staleSessionReconciliation.js'

describe('staleSessionReconciliation', () => {
  it('classifies heartbeat staleness with conservative threshold', () => {
    const now = new Date('2026-08-06T00:00:00.000Z')
    const fresh = new Date('2026-08-05T23:30:00.000Z')
    const stale = new Date('2026-08-05T22:00:00.000Z')
    expect(isHeartbeatStale(fresh, now, 60)).toBe(false)
    expect(isHeartbeatStale(stale, now, 60)).toBe(true)
  })

  it('dry-run reconcile returns counters without requiring writes when db unavailable', async () => {
    const result = await reconcileStaleSessions({ dryRun: true, batchLimit: 10 })
    expect(result.dryRun).toBe(true)
    expect(result.usageEnded).toBe(0)
    expect(result.activeDeleted).toBe(0)
    expect(typeof result.openUsageCandidates).toBe('number')
    expect(typeof result.activeRowCandidates).toBe('number')
  })
})
