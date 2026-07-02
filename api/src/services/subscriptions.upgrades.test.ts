import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

async function importSubscriptionHelpers() {
  vi.doMock('../db/client.js', () => ({ db: null }))
  vi.doMock('../env.js', () => ({ env: {} }))
  vi.doMock('../lib/clerk.js', () => ({ clerkClient: null }))
  vi.doMock('./admin/promoCodes.js', () => ({ recordPromoCodeRedemption: vi.fn() }))
  vi.doMock('./notifications/dispatchNotification.js', () => ({ dispatchNotification: vi.fn() }))
  vi.doMock('./referrals.js', () => ({ getAffiliateAttributionForUser: vi.fn() }))
  vi.doMock('./affiliates/tracking.js', () => ({ recordAffiliateTrackingEvent: vi.fn() }))

  return import('./subscriptions.js')
}

describe('managed subscription upgrade decisions', () => {
  it('activates first-time AMRITA purchases without cancelling any Stripe subscription', async () => {
    const { resolveManagedSubscriptionActivation } = await importSubscriptionHelpers()

    const activation = resolveManagedSubscriptionActivation({
      existingSubscriptions: [],
      incomingSubscription: {
        plan: 'amrita',
        status: 'active',
        stripeSubscriptionId: 'sub_amrita',
      },
    })

    expect(activation).toEqual({
      incomingCanceled: false,
      lowerTierSubscriptionIds: [],
      shouldActivateIncoming: true,
      stripeSubscriptionsToCancel: [],
    })
  })

  it('keeps first-time REGEN purchases unchanged', async () => {
    const { resolveManagedSubscriptionActivation } = await importSubscriptionHelpers()

    const activation = resolveManagedSubscriptionActivation({
      existingSubscriptions: [],
      incomingSubscription: {
        plan: 'regen',
        status: 'active',
        stripeSubscriptionId: 'sub_regen',
      },
    })

    expect(activation.shouldActivateIncoming).toBe(true)
    expect(activation.incomingCanceled).toBe(false)
    expect(activation.stripeSubscriptionsToCancel).toEqual([])
  })

  it('upgrades REGEN to AMRITA by activating AMRITA and retiring the lower-tier row', async () => {
    const { resolveManagedSubscriptionActivation } = await importSubscriptionHelpers()

    const activation = resolveManagedSubscriptionActivation({
      existingSubscriptions: [
        {
          currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
          plan: 'regen',
          status: 'active',
          stripeSubscriptionId: 'sub_regen',
        },
      ],
      incomingSubscription: {
        plan: 'amrita',
        status: 'active',
        stripeSubscriptionId: 'sub_amrita',
      },
    })

    expect(activation).toEqual({
      incomingCanceled: false,
      lowerTierSubscriptionIds: ['sub_regen'],
      shouldActivateIncoming: true,
      stripeSubscriptionsToCancel: ['sub_regen'],
    })
  })

  it('cancels duplicate same-plan REGEN purchases before they can become entitlement source', async () => {
    const { resolveManagedSubscriptionActivation } = await importSubscriptionHelpers()

    const activation = resolveManagedSubscriptionActivation({
      existingSubscriptions: [
        {
          currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
          plan: 'regen',
          status: 'active',
          stripeSubscriptionId: 'sub_regen_existing',
        },
      ],
      incomingSubscription: {
        plan: 'regen',
        status: 'active',
        stripeSubscriptionId: 'sub_regen_duplicate',
      },
    })

    expect(activation).toEqual({
      incomingCanceled: true,
      lowerTierSubscriptionIds: [],
      shouldActivateIncoming: false,
      stripeSubscriptionsToCancel: ['sub_regen_duplicate'],
    })
  })

  it('cancels duplicate same-plan AMRITA purchases before they can become entitlement source', async () => {
    const { resolveManagedSubscriptionActivation } = await importSubscriptionHelpers()

    const activation = resolveManagedSubscriptionActivation({
      existingSubscriptions: [
        {
          currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
          plan: 'amrita',
          status: 'active',
          stripeSubscriptionId: 'sub_amrita_existing',
        },
      ],
      incomingSubscription: {
        plan: 'amrita',
        status: 'active',
        stripeSubscriptionId: 'sub_amrita_duplicate',
      },
    })

    expect(activation.incomingCanceled).toBe(true)
    expect(activation.shouldActivateIncoming).toBe(false)
    expect(activation.stripeSubscriptionsToCancel).toEqual(['sub_amrita_duplicate'])
  })

  it('rejects complete but unpaid checkout sessions for paid membership activation', async () => {
    const { isPaidCheckoutSession } = await importSubscriptionHelpers()

    expect(isPaidCheckoutSession({ payment_status: 'unpaid', status: 'complete' } as never)).toBe(false)
    expect(isPaidCheckoutSession({ payment_status: 'paid', status: 'complete' } as never)).toBe(true)
  })

  it('calculates REGEN to AMRITA upgrade as the fixed monthly price difference', async () => {
    const { getManagedPlanUpgradeAmountCents } = await importSubscriptionHelpers()

    expect(
      getManagedPlanUpgradeAmountCents({
        currentAmountCents: 1999,
        targetAmountCents: 2999,
      }),
    ).toBe(1000)
  })

  it('updates the existing subscription item with explicit proration and unchanged billing cycle', async () => {
    const { buildManagedPlanUpgradeSubscriptionUpdateParams } = await importSubscriptionHelpers()

    expect(
      buildManagedPlanUpgradeSubscriptionUpdateParams({
        currentMetadata: {
          existing: 'preserved',
          plan: 'regen',
          userId: 'user_existing',
        },
        plan: 'amrita',
        planType: 'single',
        subscriptionItemId: 'si_regen',
        targetPriceId: 'price_amrita',
        userId: 'user_upgrade',
      }),
    ).toEqual({
      billing_cycle_anchor: 'unchanged',
      cancel_at_period_end: false,
      items: [
        {
          id: 'si_regen',
          price: 'price_amrita',
        },
      ],
      metadata: {
        existing: 'preserved',
        pendingDowngradePlan: '',
        plan: 'amrita',
        planType: 'single',
        userId: 'user_upgrade',
      },
      payment_behavior: 'pending_if_incomplete',
      proration_behavior: 'always_invoice',
    })
  })

  it('blocks full checkout when persisted REGEN access cannot be matched to a Stripe subscription for AMRITA upgrade', async () => {
    const { getPersistedPlanCheckoutBlockMessage } = await importSubscriptionHelpers()

    expect(
      getPersistedPlanCheckoutBlockMessage({
        persistedPlan: 'regen',
        requestedPlan: 'amrita',
      }),
    ).toContain('no active Stripe subscription was found for a prorated AMRITA upgrade')
  })

  it('blocks duplicate and downgrade checkouts from persisted managed access', async () => {
    const { getPersistedPlanCheckoutBlockMessage } = await importSubscriptionHelpers()

    expect(
      getPersistedPlanCheckoutBlockMessage({
        persistedPlan: 'amrita',
        requestedPlan: 'amrita',
      }),
    ).toBe('This account already has AMRITA access.')
    expect(
      getPersistedPlanCheckoutBlockMessage({
        persistedPlan: 'amrita',
        requestedPlan: 'regen',
      }),
    ).toBe(
      'This account already includes AMRITA access. A lower-tier subscription cannot be purchased while it is active.',
    )
    expect(
      getPersistedPlanCheckoutBlockMessage({
        persistedPlan: 'free',
        requestedPlan: 'regen',
      }),
    ).toBeNull()
  })

  it('rejects non-upgrade price differences', async () => {
    const { getManagedPlanUpgradeAmountCents } = await importSubscriptionHelpers()

    expect(() =>
      getManagedPlanUpgradeAmountCents({
        currentAmountCents: 2999,
        targetAmountCents: 1999,
      }),
    ).toThrow('not a paid upgrade')
  })
})
