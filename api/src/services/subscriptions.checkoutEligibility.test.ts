import { beforeEach, describe, expect, it, vi } from 'vitest'
import { billingCheckoutAttempts, stripeEvents, subscriptions, users } from '../db/schema.js'
import { summarizeExperienceAccess } from './player/accessPolicy.js'
import { PLAN_LIMITS } from './player/usagePeriods.js'
import { resolveSubscriptionStateFromRecords, type SubscriptionRecord } from './subscriptionState.js'

const sessionCreate = vi.fn()
const subscriptionUpdate = vi.fn()
const subscriptionCancel = vi.fn()
const invoiceVoid = vi.fn()
const events = new Map<string, { status: string; type: string }>()
let subscriptionRows: SubscriptionRecord[] = []

function subscription(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
  const now = new Date('2026-10-18T20:43:35.000Z')

  return {
    cancelAtPeriodEnd: false,
    createdAt: now,
    currentPeriodEnd: new Date('2026-11-18T20:43:35.000Z'),
    currentPeriodStart: now,
    discountPercentOff: null,
    id: '00000000-0000-0000-0000-000000000010',
    pastDueStartedAt: null,
    pauseResumesAt: null,
    pauseStartedAt: null,
    pendingDowngradePlan: null,
    plan: 'amrita',
    planType: 'single',
    status: 'incomplete_expired',
    statusChangedAt: new Date('2026-10-19T19:44:12.000Z'),
    stripeCustomerId: 'cus_test',
    stripeEventCreatedAt: new Date('2026-10-19T19:44:11.000Z'),
    stripeSubscriptionId: 'sub_expired',
    userId: 'user_expired',
    ...overrides,
  }
}

function selectChain(table: unknown) {
  if (table === subscriptions) {
    return {
      where: () => ({
        orderBy: async () => subscriptionRows,
      }),
    }
  }

  if (table === users) {
    return {
      where: () => ({
        limit: async () => [{ plan: 'free' }],
      }),
    }
  }

  if (table === billingCheckoutAttempts) {
    return {
      where: () => ({
        orderBy: () => ({
          limit: async () => [],
        }),
      }),
    }
  }

  if (table === stripeEvents) {
    return {
      where: () => ({
        limit: async () => {
          const stored = [...events.values()][0]
          return stored ? [stored] : []
        },
      }),
    }
  }

  throw new Error('Unexpected table in checkout test.')
}

vi.mock('../db/client.js', () => ({
  db: {
    select: () => ({ from: (table: unknown) => selectChain(table) }),
    insert: (table: unknown) => ({
      values: (row: { idempotencyKey?: string; stripeEventId?: string; status?: string; type?: string }) => {
        if (table === stripeEvents) {
          return {
            onConflictDoNothing: () => ({
              returning: async () => {
                const id = row.stripeEventId ?? ''
                if (events.has(id)) return []
                events.set(id, { status: 'processing', type: row.type ?? '' })
                return [{ id: 'event-row' }]
              },
            }),
            onConflictDoUpdate: async () => {
              const id = row.stripeEventId ?? ''
              const current = events.get(id)
              if (current) current.status = 'completed'
            },
          }
        }

        return {
          onConflictDoUpdate: () => ({
            returning: async () => [row],
          }),
        }
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => [],
      }),
    }),
  },
}))

vi.mock('../env.js', () => ({
  env: {
    APP_URL: 'https://app.test',
    STRIPE_AMRITA_PRICE_ID: 'price_amrita_test',
    STRIPE_REGEN_PRICE_ID: 'price_regen_test',
    STRIPE_SECRET_KEY: 'sk_test_checkout_repair',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
  },
}))

vi.mock('stripe', () => ({
  default: class Stripe {
    checkout = {
      sessions: {
        create: sessionCreate,
        retrieve: vi.fn(),
      },
    }
    subscriptions = {
      cancel: subscriptionCancel,
      update: subscriptionUpdate,
    }
    invoices = {
      create: vi.fn(),
      voidInvoice: invoiceVoid,
    }
    customers = {
      create: vi.fn(),
      retrieve: vi.fn(),
      update: vi.fn(),
    }
    webhooks = { constructEvent: vi.fn() }
  },
}))

vi.mock('../lib/clerk.js', () => ({ clerkClient: null }))
vi.mock('./admin/promoCodes.js', () => ({ recordPromoCodeRedemption: vi.fn() }))
vi.mock('./notifications/dispatchNotification.js', () => ({ dispatchNotification: vi.fn() }))
vi.mock('./referrals.js', () => ({ getAffiliateAttributionForUser: vi.fn() }))
vi.mock('./affiliates/tracking.js', () => ({ recordAffiliateTrackingEvent: vi.fn() }))
vi.mock('./billingConflictReview.js', async () => {
  const actual = await vi.importActual<typeof import('./billingConflictReview.js')>(
    './billingConflictReview.js',
  )

  return {
    ...actual,
    getBillingConflictReviewStatus: vi.fn(async () => {
      const overlappingSubscriptionCount = subscriptionRows.filter(
        (row) =>
          (row.plan === 'regen' || row.plan === 'amrita') &&
          actual.subscriptionCountsAsCheckoutOverlap(row.status),
      ).length

      return actual.billingReviewFromCounts({
        billingConflictFlag: false,
        distinctCustomerCount: 1,
        overlappingSubscriptionCount,
      })
    }),
  }
})
vi.mock('./billingIdentity.js', () => ({
  assertStripeCustomerBelongsToUser: vi.fn(),
  resolveStripeCustomerForUser: vi.fn(async () => 'cus_test'),
}))

beforeEach(() => {
  sessionCreate.mockReset()
  sessionCreate.mockResolvedValue({ id: 'cs_test_new', url: 'https://checkout.stripe.test/cs_test_new' })
  subscriptionUpdate.mockReset()
  subscriptionCancel.mockReset()
  invoiceVoid.mockReset()
  events.clear()
  subscriptionRows = []
})

describe('checkout eligibility lifecycle', () => {
  it('opens a new Checkout Session for an incomplete_expired Amrita subscription', async () => {
    subscriptionRows = [subscription({ status: 'incomplete_expired' })]
    const { createCheckoutSession } = await import('./subscriptions.js')
    const session = await createCheckoutSession({
      email: 'member@example.test',
      plan: 'amrita',
      userId: 'user_expired',
    })

    expect(session).toMatchObject({ id: 'cs_test_new', url: 'https://checkout.stripe.test/cs_test_new' })
    expect(sessionCreate).toHaveBeenCalledTimes(1)
    expect(sessionCreate.mock.calls[0]?.[0]).toMatchObject({
      customer: 'cus_test',
      mode: 'subscription',
      line_items: [{ price: 'price_amrita_test', quantity: 1 }],
    })
    expect(sessionCreate.mock.calls[0]?.[0]).not.toHaveProperty('payment_method_types')
    expect(subscriptionUpdate).not.toHaveBeenCalled()
    expect(subscriptionCancel).not.toHaveBeenCalled()
    expect(invoiceVoid).not.toHaveBeenCalled()
  })

  it('opens a new Checkout Session after two abandoned incomplete checkouts', async () => {
    subscriptionRows = [
      subscription({
        currentPeriodEnd: new Date('2026-11-21T21:01:59.000Z'),
        currentPeriodStart: new Date('2026-10-21T21:01:59.000Z'),
        status: 'incomplete',
        stripeSubscriptionId: 'sub_incomplete_latest',
      }),
      subscription({
        status: 'incomplete',
        stripeSubscriptionId: 'sub_incomplete_earlier',
      }),
      subscription({ status: 'incomplete_expired' }),
    ]
    const { createCheckoutSession } = await import('./subscriptions.js')
    const session = await createCheckoutSession({
      email: 'member@example.test',
      plan: 'amrita',
      userId: 'user_expired',
    })

    expect(session?.url).toBe('https://checkout.stripe.test/cs_test_new')
    expect(sessionCreate).toHaveBeenCalledTimes(1)
    expect(subscriptionUpdate).not.toHaveBeenCalled()
  })

  it('opens a new Checkout Session after a fully canceled subscription', async () => {
    subscriptionRows = [subscription({ status: 'canceled', stripeSubscriptionId: 'sub_canceled' })]
    const { createCheckoutSession } = await import('./subscriptions.js')
    const session = await createCheckoutSession({
      email: 'member@example.test',
      plan: 'amrita',
      userId: 'user_expired',
    })

    expect(session?.id).toBe('cs_test_new')
    expect(subscriptionUpdate).not.toHaveBeenCalled()
  })

  it('refuses a duplicate purchase for an active paid subscription', async () => {
    subscriptionRows = [subscription({ status: 'active', stripeSubscriptionId: 'sub_live' })]
    const { createCheckoutSession } = await import('./subscriptions.js')

    await expect(
      createCheckoutSession({
        email: 'member@example.test',
        plan: 'amrita',
        userId: 'user_expired',
      }),
    ).rejects.toThrow('already has an active AMRITA subscription')
    expect(sessionCreate).not.toHaveBeenCalled()
    expect(subscriptionUpdate).not.toHaveBeenCalled()
  })

  it('keeps past-due grace from opening a second subscription checkout', async () => {
    subscriptionRows = [
      subscription({
        pastDueStartedAt: new Date('2026-10-20T00:00:00.000Z'),
        status: 'past_due',
      }),
    ]
    const { createCheckoutSession } = await import('./subscriptions.js')

    await expect(
      createCheckoutSession({
        email: 'member@example.test',
        plan: 'amrita',
        userId: 'user_expired',
      }),
    ).rejects.toThrow('already has an active AMRITA subscription')
    expect(sessionCreate).not.toHaveBeenCalled()
  })

  it('activates Amrita only after a manageable paid status and keeps failed payments free', async () => {
    const { resolveManagedSubscriptionActivation } = await import('./subscriptions.js')
    const paid = resolveManagedSubscriptionActivation({
      existingSubscriptions: [subscription({ status: 'incomplete_expired' })],
      incomingSubscription: { plan: 'amrita', status: 'active', stripeSubscriptionId: 'sub_paid' },
    })
    const failed = resolveManagedSubscriptionActivation({
      existingSubscriptions: [],
      incomingSubscription: { plan: 'amrita', status: 'incomplete', stripeSubscriptionId: 'sub_failed' },
    })
    const paidState = resolveSubscriptionStateFromRecords([
      subscription({ status: 'active', stripeSubscriptionId: 'sub_paid' }),
    ])
    const failedState = resolveSubscriptionStateFromRecords([
      subscription({ status: 'incomplete', stripeSubscriptionId: 'sub_failed' }),
    ])
    const paidAccess = summarizeExperienceAccess({
      experience: 'regen',
      minutesUsed: 0,
      plan: paidState.entitlementPlan,
      usage: null,
    })
    const unpaidAccess = summarizeExperienceAccess({
      experience: 'regen',
      minutesUsed: 0,
      plan: failedState.entitlementPlan,
      usage: null,
    })
    const billingStatus = {
      canPause: false,
      canResume: false,
      entitlementPlan: paidState.entitlementPlan,
      pauseBlockReason: null,
      pauseResumesAt: null,
      pauseStartedAt: null,
      paused: false,
      paymentRecoveryRequired: paidState.paymentRecoveryRequired,
      reason: paidState.reason,
      subscription: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        currentPeriodStart: null,
        plan: 'amrita' as const,
        status: 'active',
        stripeSubscriptionId: 'sub_paid',
      },
    }

    expect(paid.shouldActivateIncoming).toBe(true)
    expect(failed.shouldActivateIncoming).toBe(false)
    expect(paidState.entitlementPlan).toBe('amrita')
    expect(failedState.entitlementPlan).toBe('free')
    expect(paidAccess.allowed).toBe(true)
    expect(paidAccess.limitSeconds).toBe(PLAN_LIMITS.amrita.total)
    expect(unpaidAccess.limitSeconds).toBe(PLAN_LIMITS.free.regen)
    const subscribed =
      billingStatus.entitlementPlan === 'regen' || billingStatus.entitlementPlan === 'amrita'
    expect(subscribed).toBe(true)
    expect(failedState.entitlementPlan === 'regen' || failedState.entitlementPlan === 'amrita').toBe(false)
  })

  it('ignores a duplicate Stripe event without creating another subscription', async () => {
    const { processStripeEvent } = await import('./subscriptions.js')
    const event = {
      id: 'evt_test_duplicate',
      type: 'customer.created',
      created: 1_700_000_000,
      data: { object: {} },
    } as unknown as Parameters<typeof processStripeEvent>[0]

    const first = await processStripeEvent(event)
    const second = await processStripeEvent(event)

    expect(first).toEqual({ duplicate: false })
    expect(second).toEqual({ duplicate: true })
    expect(sessionCreate).not.toHaveBeenCalled()
    expect(subscriptionUpdate).not.toHaveBeenCalled()
  })
})
