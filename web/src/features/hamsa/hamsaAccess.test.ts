import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveHamsaAccessDecision } from './hamsaAccess.ts'

describe('resolveHamsaAccessDecision', () => {
  it('shows loading while auth is resolving', () => {
    assert.equal(
      resolveHamsaAccessDecision({
        authStatus: 'loading',
        clerkPlan: null,
        dbBackedPlan: null,
        dbPlanChecked: false,
      }),
      'loading',
    )
  })

  it('launches immediately when Clerk metadata already grants REGEN', () => {
    assert.equal(
      resolveHamsaAccessDecision({
        authStatus: 'signed-in',
        clerkPlan: 'regen',
        dbBackedPlan: null,
        dbPlanChecked: false,
      }),
      'launch',
    )
  })

  it('launches immediately when Clerk metadata already grants AMRITA', () => {
    assert.equal(
      resolveHamsaAccessDecision({
        authStatus: 'signed-in',
        clerkPlan: 'amrita',
        dbBackedPlan: null,
        dbPlanChecked: false,
      }),
      'launch',
    )
  })

  it('keeps loading while the DB plan check is in flight for a stale Clerk plan', () => {
    assert.equal(
      resolveHamsaAccessDecision({
        authStatus: 'signed-in',
        clerkPlan: 'free',
        dbBackedPlan: null,
        dbPlanChecked: false,
      }),
      'loading',
    )
  })

  it('launches when the DB says REGEN even though Clerk metadata lags', () => {
    assert.equal(
      resolveHamsaAccessDecision({
        authStatus: 'signed-in',
        clerkPlan: 'free',
        dbBackedPlan: 'regen',
        dbPlanChecked: true,
      }),
      'launch',
    )
  })

  it('locks only when both Clerk and the DB deny access', () => {
    assert.equal(
      resolveHamsaAccessDecision({
        authStatus: 'signed-in',
        clerkPlan: 'free',
        dbBackedPlan: 'free',
        dbPlanChecked: true,
      }),
      'locked',
    )
  })

  it('locks when the DB check fails and Clerk denies access', () => {
    assert.equal(
      resolveHamsaAccessDecision({
        authStatus: 'signed-in',
        clerkPlan: 'free',
        dbBackedPlan: null,
        dbPlanChecked: true,
      }),
      'locked',
    )
  })

  it('locks signed-out users without waiting on the DB check', () => {
    assert.equal(
      resolveHamsaAccessDecision({
        authStatus: 'signed-out',
        clerkPlan: null,
        dbBackedPlan: null,
        dbPlanChecked: false,
      }),
      'locked',
    )
  })
})
