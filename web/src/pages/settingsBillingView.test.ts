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
})
