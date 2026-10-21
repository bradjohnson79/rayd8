import { describe, expect, it } from 'vitest'
import {
  resolveSubscriptionStateFromRecords,
  subscriptionBlocksNewCheckout,
  type SubscriptionRecord,
} from './subscriptionState.js'

function subscription(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
  const now = new Date('2026-07-01T00:00:00.000Z')

  return {
    cancelAtPeriodEnd: false,
    createdAt: now,
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    currentPeriodStart: now,
    discountPercentOff: null,
    id: '00000000-0000-0000-0000-000000000001',
    pastDueStartedAt: null,
    pauseResumesAt: null,
    pauseStartedAt: null,
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

  it('keeps entitlement for a 100%-off promo subscription stuck in past_due beyond the grace window', () => {
    const state = resolveSubscriptionStateFromRecords([
      subscription({
        discountPercentOff: 100,
        pastDueStartedAt: new Date('2026-06-01T00:00:00.000Z'),
        status: 'past_due',
      }),
    ], new Date('2026-07-01T00:00:00.000Z'))

    expect(state.entitlementPlan).toBe('regen')
    expect(state.paymentRecoveryRequired).toBe(false)
    expect(state.reason).toBe('past_due_grace_promo')
  })

  it('still drops a partial-discount past_due subscription after the grace window', () => {
    const state = resolveSubscriptionStateFromRecords([
      subscription({
        discountPercentOff: 50,
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

  it('drops paid entitlement while an account hold is active', () => {
    const state = resolveSubscriptionStateFromRecords(
      [
        subscription({
          pauseResumesAt: new Date('2026-09-17T00:00:00.000Z'),
          pauseStartedAt: new Date('2026-08-18T00:00:00.000Z'),
        }),
      ],
      new Date('2026-08-18T00:00:00.000Z'),
    )

    expect(state.entitlementPlan).toBe('free')
    expect(state.paymentRecoveryRequired).toBe(false)
    expect(state.reason).toBe('paused')
    expect(state.activeSubscription?.stripeSubscriptionId).toBe('sub_test')
  })

  it('restores entitlement after pauseResumesAt expires', () => {
    const state = resolveSubscriptionStateFromRecords(
      [
        subscription({
          pauseResumesAt: new Date('2026-08-01T00:00:00.000Z'),
          pauseStartedAt: new Date('2026-07-02T00:00:00.000Z'),
        }),
      ],
      new Date('2026-08-18T00:00:00.000Z'),
    )

    expect(state.entitlementPlan).toBe('regen')
    expect(state.reason).toBe('active')
    expect(state.paymentRecoveryRequired).toBe(false)
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

  it('does not treat an unpaid expired Amrita checkout as an active subscription', () => {
    const state = resolveSubscriptionStateFromRecords([
      subscription({
        plan: 'amrita',
        status: 'incomplete_expired',
      }),
    ], new Date('2026-10-21T00:00:00.000Z'))

    expect(state.entitlementPlan).toBe('free')
    expect(state.paymentRecoveryRequired).toBe(false)
    expect(state.reason).toBe('canceled')
    expect(subscriptionBlocksNewCheckout(state)).toBe(false)
  })

  it('still blocks checkout for a paused or paying subscription', () => {
    const paused = resolveSubscriptionStateFromRecords(
      [
        subscription({
          pauseResumesAt: new Date('2026-09-17T00:00:00.000Z'),
          pauseStartedAt: new Date('2026-08-18T00:00:00.000Z'),
        }),
      ],
      new Date('2026-08-18T00:00:00.000Z'),
    )
    const active = resolveSubscriptionStateFromRecords([
      subscription({ plan: 'amrita', status: 'active' }),
    ])

    expect(subscriptionBlocksNewCheckout(paused)).toBe(true)
    expect(subscriptionBlocksNewCheckout(active)).toBe(true)
  })

  it('allows a new checkout after a canceled subscription has no remaining entitlement', () => {
    const state = resolveSubscriptionStateFromRecords([
      subscription({ plan: 'amrita', status: 'canceled' }),
    ])

    expect(state.entitlementPlan).toBe('free')
    expect(subscriptionBlocksNewCheckout(state)).toBe(false)
  })

  it('keeps an incomplete checkout unpaid and allows another purchase attempt', () => {
    const state = resolveSubscriptionStateFromRecords([
      subscription({ plan: 'amrita', status: 'incomplete' }),
    ])

    expect(state.entitlementPlan).toBe('free')
    expect(state.reason).toBe('pending_payment')
    expect(state.paymentRecoveryRequired).toBe(false)
    expect(subscriptionBlocksNewCheckout(state)).toBe(false)
  })

  it('keeps past-due grace entitled and blocks a duplicate purchase', () => {
    const state = resolveSubscriptionStateFromRecords([
      subscription({
        pastDueStartedAt: new Date('2026-06-28T00:00:00.000Z'),
        plan: 'amrita',
        status: 'past_due',
      }),
    ], new Date('2026-07-01T00:00:00.000Z'))

    expect(state.entitlementPlan).toBe('amrita')
    expect(state.reason).toBe('past_due_grace')
    expect(subscriptionBlocksNewCheckout(state)).toBe(true)
  })
})
