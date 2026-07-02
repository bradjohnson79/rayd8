import { describe, expect, it } from 'vitest'
import {
  resolveSubscriptionStateFromRecords,
  type SubscriptionRecord,
} from './subscriptionState.js'

function subscription(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
  const now = new Date('2026-07-01T00:00:00.000Z')

  return {
    cancelAtPeriodEnd: false,
    createdAt: now,
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    currentPeriodStart: now,
    id: '00000000-0000-0000-0000-000000000001',
    pastDueStartedAt: null,
    pendingDowngradePlan: null,
    plan: 'regen',
    planType: 'single',
    status: 'active',
    statusChangedAt: now,
    stripeCustomerId: 'cus_test',
    stripeEventCreatedAt: now,
    stripeSubscriptionId: 'sub_test',
    userId: 'user_test',
    ...overrides,
  }
}

describe('subscription state entitlement policy', () => {
  it('keeps past_due access only within the non-resetting 7 day grace window', () => {
    const state = resolveSubscriptionStateFromRecords([
      subscription({
        pastDueStartedAt: new Date('2026-06-25T00:00:00.000Z'),
        status: 'past_due',
      }),
    ], new Date('2026-07-01T00:00:00.000Z'))

    expect(state.entitlementPlan).toBe('regen')
    expect(state.paymentRecoveryRequired).toBe(true)
    expect(state.reason).toBe('past_due_grace')
  })

  it('removes paid access after past_due grace expires', () => {
    const state = resolveSubscriptionStateFromRecords([
      subscription({
        pastDueStartedAt: new Date('2026-06-20T00:00:00.000Z'),
        status: 'past_due',
      }),
    ], new Date('2026-07-01T00:00:00.000Z'))

    expect(state.entitlementPlan).toBe('free')
    expect(state.paymentRecoveryRequired).toBe(true)
    expect(state.reason).toBe('past_due_expired')
  })

  it('removes paid access immediately for unpaid subscriptions', () => {
    const state = resolveSubscriptionStateFromRecords([
      subscription({
        status: 'unpaid',
      }),
    ])

    expect(state.entitlementPlan).toBe('free')
    expect(state.paymentRecoveryRequired).toBe(true)
    expect(state.reason).toBe('payment_unpaid')
  })

  it('keeps AMRITA entitlement until a scheduled REGEN downgrade period ends', () => {
    const beforePeriodEnd = resolveSubscriptionStateFromRecords([
      subscription({
        pendingDowngradePlan: 'regen',
        plan: 'amrita',
      }),
    ], new Date('2026-07-15T00:00:00.000Z'))
    const afterPeriodEnd = resolveSubscriptionStateFromRecords([
      subscription({
        pendingDowngradePlan: 'regen',
        plan: 'amrita',
      }),
    ], new Date('2026-08-02T00:00:00.000Z'))

    expect(beforePeriodEnd.entitlementPlan).toBe('amrita')
    expect(afterPeriodEnd.entitlementPlan).toBe('regen')
  })
})
