import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { BillingAccountStatus } from '../services/billing'
import { resolveSettingsBillingView } from './settingsBillingView.ts'

function billingStatus(overrides: Partial<BillingAccountStatus> = {}): BillingAccountStatus {
  return {
    canPause: false,
    canResume: false,
    entitlementPlan: 'free',
    pauseBlockReason: null,
    pauseResumesAt: null,
    pauseStartedAt: null,
    paused: false,
    paymentRecoveryRequired: false,
    reason: 'free',
    subscription: null,
    ...overrides,
  }
}

describe('resolveSettingsBillingView', () => {
  it('keeps a paused member on the hold UI instead of upgrade checkout', () => {
    const view = resolveSettingsBillingView(
      billingStatus({
        canResume: true,
        pauseResumesAt: '2026-09-17T00:00:00.000Z',
        paused: true,
        reason: 'paused',
        subscription: {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: '2026-09-01T00:00:00.000Z',
          currentPeriodStart: '2026-08-01T00:00:00.000Z',
          plan: 'regen',
          status: 'active',
          stripeSubscriptionId: 'sub_hold',
        },
      }),
      'free',
    )

    assert.equal(view.onHold, true)
    assert.equal(view.isSubscribedMember, true)
    assert.equal(view.showUpgradeCheckout, false)
    assert.equal(view.displayPlan, 'regen')
    assert.equal(view.canResume, true)
  })

  it('shows upgrade checkout for a free account', () => {
    const view = resolveSettingsBillingView(billingStatus(), 'free')

    assert.equal(view.onHold, false)
    assert.equal(view.isSubscribedMember, false)
    assert.equal(view.showUpgradeCheckout, true)
  })

  it('does not present an unpaid Amrita checkout as an active subscription', () => {
    const view = resolveSettingsBillingView(
      billingStatus({
        entitlementPlan: 'free',
        reason: 'pending_payment',
        subscription: {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: '2026-11-21T21:01:59.000Z',
          currentPeriodStart: '2026-10-21T21:01:59.000Z',
          plan: 'amrita',
          status: 'incomplete',
          stripeSubscriptionId: 'sub_incomplete',
        },
      }),
      'free',
    )

    assert.equal(view.displayPlan, 'free')
    assert.equal(view.isSubscribedMember, false)
    assert.equal(view.showUpgradeCheckout, true)
    assert.equal(view.statusLabel, 'Payment not completed')
    assert.equal(view.statusDetail.includes('active through'), false)
  })

  it('keeps a paid Amrita subscription active', () => {
    const view = resolveSettingsBillingView(
      billingStatus({
        entitlementPlan: 'amrita',
        reason: 'active',
        subscription: {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: '2026-11-21T21:01:59.000Z',
          currentPeriodStart: '2026-10-21T21:01:59.000Z',
          plan: 'amrita',
          status: 'active',
          stripeSubscriptionId: 'sub_paid',
        },
      }),
      'amrita',
    )

    assert.equal(view.displayPlan, 'amrita')
    assert.equal(view.isSubscribedMember, true)
    assert.equal(view.showUpgradeCheckout, false)
    assert.equal(view.statusLabel, 'Active')
  })
})
