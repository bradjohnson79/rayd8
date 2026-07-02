import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../db/client.js'
import { env } from '../env.js'
import {
  affiliateCommissions,
  billingCheckoutAttempts,
  stripeCheckoutSessions,
  stripeEvents,
  subscriptionCancellationFeedback,
  subscriptions,
  users,
} from '../db/schema.js'
import { clerkClient } from '../lib/clerk.js'
import {
  assertStripeCustomerBelongsToUser,
  resolveStripeCustomerForUser,
} from './billingIdentity.js'
import { getBillingConflictReviewStatus } from './billingConflictReview.js'
import { dispatchNotification } from './notifications/dispatchNotification.js'
import {
  getSubscriptionStateForUser,
  resolveSubscriptionStateFromRecords,
  type BillingPlan,
} from './subscriptionState.js'
import { getAffiliateAttributionForUser } from './referrals.js'
import { recordAffiliateTrackingEvent } from './affiliates/tracking.js'
import { recordPromoCodeRedemption } from './admin/promoCodes.js'
import { safeSyncUserToAweber, type AweberSyncPlan } from './aweber.js'

const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as never,
    })
  : null

type AppDatabase = NonNullable<typeof db>
type ManagedPlan = 'regen' | 'amrita'
type ManagedPlanType = 'single' | 'multi'
type PersistedPlan = 'free' | 'premium' | 'regen' | 'amrita'
const MANAGED_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const
const MANAGED_PLAN_RANK: Record<ManagedPlan, number> = {
  regen: 2,
  amrita: 3,
}
const MANAGED_PLAN_UPGRADE_CHECKOUT_KIND = 'managed_plan_upgrade'
const CHECKOUT_ATTEMPT_TTL_MS = 30 * 60 * 1000
const STRIPE_EVENT_LEASE_MS = 5 * 60 * 1000
export type CancellationReason =
  | 'too_expensive'
  | 'not_using_enough'
  | 'technical_issues'
  | 'didnt_see_results'
  | 'found_alternative'
  | 'other'

function getPriceIdForPlan(plan: ManagedPlan) {
  return plan === 'regen' ? env.STRIPE_REGEN_PRICE_ID : env.STRIPE_AMRITA_PRICE_ID
}

function parseManagedPlan(value: unknown): ManagedPlan | null {
  return value === 'regen' || value === 'amrita' ? value : null
}

function planFromPriceId(priceId?: string | null) {
  if (!priceId) {
    return null
  }

  if (priceId === env.STRIPE_REGEN_PRICE_ID) {
    return 'regen'
  }

  if (priceId === env.STRIPE_AMRITA_PRICE_ID) {
    return 'amrita'
  }

  return null
}

function isManagedPlan(plan: PersistedPlan | null | undefined): plan is ManagedPlan {
  return plan === 'regen' || plan === 'amrita'
}

function isManageableSubscriptionStatus(status: string) {
  return MANAGED_SUBSCRIPTION_STATUSES.includes(
    status as (typeof MANAGED_SUBSCRIPTION_STATUSES)[number],
  )
}

function getPlanLabel(plan: ManagedPlan) {
  return plan === 'amrita' ? 'AMRITA' : 'REGEN'
}

export function getPersistedPlanCheckoutBlockMessage(input: {
  persistedPlan: PersistedPlan | null
  requestedPlan: ManagedPlan
}) {
  if (!isManagedPlan(input.persistedPlan)) {
    return null
  }

  const persistedRank = MANAGED_PLAN_RANK[input.persistedPlan]
  const requestedRank = MANAGED_PLAN_RANK[input.requestedPlan]

  if (persistedRank === requestedRank) {
    return `This account already has ${getPlanLabel(input.requestedPlan)} access.`
  }

  if (persistedRank > requestedRank) {
    return `This account already includes ${getPlanLabel(input.persistedPlan)} access. A lower-tier subscription cannot be purchased while it is active.`
  }

  return `This account already has ${getPlanLabel(input.persistedPlan)} access, but no active Stripe subscription was found for a prorated ${getPlanLabel(input.requestedPlan)} upgrade. Please contact support before checkout.`
}

export function getManagedPlanUpgradeAmountCents(input: {
  currentAmountCents: number | null
  targetAmountCents: number | null
}) {
  if (typeof input.currentAmountCents !== 'number' || typeof input.targetAmountCents !== 'number') {
    throw new Error('Stripe prices must use fixed monthly USD amounts before upgrades can be calculated.')
  }

  const amountCents = input.targetAmountCents - input.currentAmountCents

  if (amountCents <= 0) {
    throw new Error('The requested plan is not a paid upgrade from the current subscription.')
  }

  return amountCents
}

async function getPlanPrice(plan: ManagedPlan) {
  const priceId = getPriceIdForPlan(plan)

  if (!stripeClient || !priceId) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and price IDs.')
  }

  const price = await stripeClient.prices.retrieve(priceId)

  if (price.currency !== 'usd' || price.recurring?.interval !== 'month') {
    throw new Error('Managed subscription upgrades require monthly USD Stripe prices.')
  }

  return price
}

async function getManagedPlanUpgradeAmountForStripe(input: {
  currentPlan: ManagedPlan
  targetPlan: ManagedPlan
}) {
  const [currentPrice, targetPrice] = await Promise.all([
    getPlanPrice(input.currentPlan),
    getPlanPrice(input.targetPlan),
  ])

  return getManagedPlanUpgradeAmountCents({
    currentAmountCents: currentPrice.unit_amount,
    targetAmountCents: targetPrice.unit_amount,
  })
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  return fromUnixTimestamp(subscription.items.data[0]?.current_period_end)
}

async function updateExistingSubscriptionPlan(input: {
  currentPlan: ManagedPlan
  idempotencyKey: string
  plan: ManagedPlan
  planType: ManagedPlanType
  stripeSubscriptionId: string
  userId: string
}) {
  if (!stripeClient) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and price IDs.')
  }

  const targetPriceId = getPriceIdForPlan(input.plan)

  if (!targetPriceId) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and price IDs.')
  }

  const currentSubscription = await stripeClient.subscriptions.retrieve(input.stripeSubscriptionId, {
    expand: ['items.data.price'],
  })
  const subscriptionItem =
    currentSubscription.items.data.find((item) => item.price.id === getPriceIdForPlan(input.currentPlan)) ??
    currentSubscription.items.data[0]

  if (!subscriptionItem) {
    throw new Error('No active subscription item was found for this plan change.')
  }

  const updatedSubscription = await stripeClient.subscriptions.update(
    currentSubscription.id,
    buildManagedPlanUpgradeSubscriptionUpdateParams({
      currentMetadata: currentSubscription.metadata,
      plan: input.plan,
      planType: input.planType,
      subscriptionItemId: subscriptionItem.id,
      targetPriceId,
      userId: input.userId,
    }),
    {
      idempotencyKey: input.idempotencyKey,
    },
  )

  await upsertUserSubscription({
    clerkUserId: input.userId,
    stripeCustomerId: String(updatedSubscription.customer),
    stripeSubscriptionId: updatedSubscription.id,
    status: updatedSubscription.status,
    plan: input.plan,
    planType: input.planType,
    cancelAtPeriodEnd: Boolean(updatedSubscription.cancel_at_period_end),
    currentPeriodStart: fromUnixTimestamp(updatedSubscription.items.data[0]?.current_period_start),
    currentPeriodEnd: getSubscriptionPeriodEnd(updatedSubscription),
  })

  return updatedSubscription
}

async function scheduleDowngradeAtPeriodEnd(input: {
  currentPlan: ManagedPlan
  idempotencyKey: string
  plan: ManagedPlan
  planType: ManagedPlanType
  stripeSubscriptionId: string
  userId: string
}) {
  if (!stripeClient) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and price IDs.')
  }

  const targetPriceId = getPriceIdForPlan(input.plan)

  if (!targetPriceId) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and price IDs.')
  }

  const currentSubscription = await stripeClient.subscriptions.retrieve(input.stripeSubscriptionId, {
    expand: ['items.data.price'],
  })
  const currentPeriodStart = currentSubscription.items.data[0]?.current_period_start
  const currentPeriodEnd = currentSubscription.items.data[0]?.current_period_end
  const currentItems = currentSubscription.items.data.map((item) => ({
    price: item.price.id,
    quantity: item.quantity ?? 1,
  }))

  if (!currentPeriodStart || !currentPeriodEnd || currentItems.length === 0) {
    throw new Error('No active subscription period was found for this downgrade.')
  }

  const schedule = currentSubscription.schedule
    ? typeof currentSubscription.schedule === 'string'
      ? { id: currentSubscription.schedule }
      : currentSubscription.schedule
    : await stripeClient.subscriptionSchedules.create(
        {
          from_subscription: input.stripeSubscriptionId,
        },
        {
          idempotencyKey: `${input.idempotencyKey}:schedule`,
        },
      )

  await stripeClient.subscriptionSchedules.update(
    schedule.id,
    {
      phases: [
        {
          end_date: currentPeriodEnd,
          items: currentItems,
          metadata: {
            ...(currentSubscription.metadata ?? {}),
            pendingDowngradePlan: input.plan,
            plan: input.currentPlan,
            planType: input.planType,
            userId: input.userId,
          },
          start_date: currentPeriodStart,
        },
        {
          items: [{ price: targetPriceId, quantity: 1 }],
          metadata: {
            ...(currentSubscription.metadata ?? {}),
            pendingDowngradePlan: '',
            plan: input.plan,
            planType: input.planType,
            userId: input.userId,
          },
        },
      ],
      metadata: {
        pendingDowngradePlan: input.plan,
        userId: input.userId,
      },
    },
    {
      idempotencyKey: `${input.idempotencyKey}:schedule-update`,
    },
  )

  await stripeClient.subscriptions.update(
    input.stripeSubscriptionId,
    {
      metadata: {
        ...(currentSubscription.metadata ?? {}),
        pendingDowngradePlan: input.plan,
        plan: input.currentPlan,
        planType: input.planType,
        userId: input.userId,
      },
    },
    {
      idempotencyKey: input.idempotencyKey,
    },
  )

  if (db) {
    await db
      .update(subscriptions)
      .set({
        pendingDowngradePlan: input.plan,
      })
      .where(eq(subscriptions.stripeSubscriptionId, input.stripeSubscriptionId))
  }

  return currentSubscription
}

export function buildManagedPlanUpgradeSubscriptionUpdateParams(input: {
  currentMetadata?: Stripe.Metadata | null
  plan: ManagedPlan
  planType: ManagedPlanType
  subscriptionItemId: string
  targetPriceId: string
  userId: string
}): Stripe.SubscriptionUpdateParams {
  return {
    billing_cycle_anchor: 'unchanged',
    cancel_at_period_end: false,
    items: [
      {
        id: input.subscriptionItemId,
        price: input.targetPriceId,
      },
    ],
    metadata: {
      ...(input.currentMetadata ?? {}),
      pendingDowngradePlan: '',
      plan: input.plan,
      planType: input.planType,
      userId: input.userId,
    },
    payment_behavior: 'pending_if_incomplete',
    proration_behavior: 'always_invoice',
  }
}

export async function createAffiliateCommissionForSubscriptionCreate(input: {
  affiliateUserIdFromMetadata?: string | null
  billingReason: string | null | undefined
  eventId: string
  invoiceId: string
  plan: PersistedPlan
  referralCodeFromMetadata?: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string
  userId: string
}) {
  if (input.billingReason !== 'subscription_create' || input.plan !== 'regen' || !db) {
    return { created: false, reason: 'not_applicable' as const }
  }

  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
  const hasReferralMetadata = Boolean(input.referralCodeFromMetadata && input.affiliateUserIdFromMetadata)
  const shouldTrackAffiliateSync = Boolean(user?.referredByUserId || hasReferralMetadata)

  if (shouldTrackAffiliateSync) {
    await recordAffiliateTrackingEvent({
      affiliateUserId: input.affiliateUserIdFromMetadata ?? user?.referredByUserId ?? null,
      eventType: 'stripe_payment_processed',
      hasReferralMetadata,
      message: hasReferralMetadata
        ? 'Stripe metadata attached'
        : 'Stripe payment missing affiliate metadata',
      referralCode: input.referralCodeFromMetadata ?? null,
      referredUserId: input.userId,
      result: hasReferralMetadata ? 'success' : 'warning',
      stripeCustomerId: input.stripeCustomerId,
      stripeEventId: input.eventId,
      stripeInvoiceId: input.invoiceId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    })
  }

  if (!user?.referredByUserId) {
    if (hasReferralMetadata) {
      await recordAffiliateTrackingEvent({
        affiliateUserId: input.affiliateUserIdFromMetadata ?? null,
        eventType: 'commission_skipped',
        hasReferralMetadata,
        message: 'Stripe event fired but no referral match was found',
        referralCode: input.referralCodeFromMetadata ?? null,
        referredUserId: input.userId,
        result: 'warning',
        stripeCustomerId: input.stripeCustomerId,
        stripeEventId: input.eventId,
        stripeInvoiceId: input.invoiceId,
        stripeSubscriptionId: input.stripeSubscriptionId,
      })
    }

    return { created: false, reason: 'missing_attribution' as const }
  }

  if (!hasReferralMetadata) {
    await recordAffiliateTrackingEvent({
      affiliateUserId: user.referredByUserId,
      eventType: 'stripe_metadata_missing',
      hasReferralMetadata: false,
      message: 'Referral exists but Stripe metadata is missing',
      referralCode: input.referralCodeFromMetadata ?? null,
      referredUserId: user.id,
      result: 'warning',
      stripeCustomerId: input.stripeCustomerId,
      stripeEventId: input.eventId,
      stripeInvoiceId: input.invoiceId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    })
  }

  const commissionAmountUsd = 600
  const insertedRows = await db
    .insert(affiliateCommissions)
    .values({
      affiliateUserId: user.referredByUserId,
      amountUsd: commissionAmountUsd,
      eventId: input.eventId,
      referredUserId: user.id,
      source: 'stripe_invoice',
      status: 'pending',
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
    })
    .onConflictDoNothing()
    .returning({ id: affiliateCommissions.id })

  const created = insertedRows.length > 0

  await recordAffiliateTrackingEvent({
    affiliateUserId: user.referredByUserId,
    commissionCreated: created,
    eventType: created ? 'commission_created' : 'commission_duplicate',
    hasReferralMetadata,
    message: created ? 'Commission created: $6' : 'Duplicate commission ignored safely',
    referralCode: input.referralCodeFromMetadata ?? null,
    referredUserId: user.id,
    result: created ? 'success' : 'warning',
    stripeCustomerId: input.stripeCustomerId,
    stripeEventId: input.eventId,
    stripeInvoiceId: input.invoiceId,
    stripeSubscriptionId: input.stripeSubscriptionId,
  })

  return {
    affiliateUserId: user.referredByUserId,
    amountUsd: commissionAmountUsd,
    commissionId: insertedRows[0]?.id ?? null,
    created,
    referredUserId: user.id,
    reason: created ? ('inserted' as const) : ('duplicate' as const),
  }
}

export function verifyStripeWebhook(payload: string | Buffer, signature?: string) {
  if (!stripeClient || !env.STRIPE_WEBHOOK_SECRET || !signature) {
    return null
  }

  return stripeClient.webhooks.constructEvent(
    payload,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  )
}

async function findOpenCheckoutAttempt(input: {
  action: string
  targetPlan: ManagedPlan
  userId: string
}) {
  if (!db) {
    return null
  }

  const [attempt] = await db
    .select()
    .from(billingCheckoutAttempts)
    .where(
      and(
        eq(billingCheckoutAttempts.userId, input.userId),
        eq(billingCheckoutAttempts.action, input.action),
        eq(billingCheckoutAttempts.targetPlan, input.targetPlan),
        eq(billingCheckoutAttempts.status, 'pending'),
        gt(billingCheckoutAttempts.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(billingCheckoutAttempts.createdAt))
    .limit(1)

  return attempt ?? null
}

async function createCheckoutAttempt(input: {
  action: string
  targetPlan: ManagedPlan
  userId: string
}) {
  const expiresAt = new Date(Date.now() + CHECKOUT_ATTEMPT_TTL_MS)
  const idempotencyKey = `rayd8:${input.action}:${input.userId}:${input.targetPlan}:${Math.floor(Date.now() / CHECKOUT_ATTEMPT_TTL_MS)}`

  if (!db) {
    return { expiresAt, idempotencyKey, stripeSessionId: null }
  }

  const [attempt] = await db
    .insert(billingCheckoutAttempts)
    .values({
      action: input.action,
      expiresAt,
      idempotencyKey,
      targetPlan: input.targetPlan,
      userId: input.userId,
    })
    .onConflictDoUpdate({
      target: billingCheckoutAttempts.idempotencyKey,
      set: {
        expiresAt,
        updatedAt: new Date(),
      },
    })
    .returning()

  return attempt
}

async function attachCheckoutAttemptSession(input: {
  idempotencyKey: string
  stripeSessionId: string
}) {
  if (!db) {
    return
  }

  await db
    .update(billingCheckoutAttempts)
    .set({
      status: 'pending',
      stripeSessionId: input.stripeSessionId,
      updatedAt: new Date(),
    })
    .where(eq(billingCheckoutAttempts.idempotencyKey, input.idempotencyKey))
}

async function markCheckoutAttemptCompleted(stripeSessionId: string) {
  if (!db) {
    return
  }

  await db
    .update(billingCheckoutAttempts)
    .set({
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(eq(billingCheckoutAttempts.stripeSessionId, stripeSessionId))
}

export async function createCheckoutSession(input: {
  email: string
  plan: ManagedPlan
  planType?: ManagedPlanType
  referralCode?: string | null
  referrerUserId?: string | null
  userId: string
}) {
  const priceId = getPriceIdForPlan(input.plan)

  if (!stripeClient || !priceId) {
    return null
  }

  const conflictReview = await getBillingConflictReviewStatus(input.userId)

  if (conflictReview.reviewRequired) {
    throw new Error('Billing review required: this account has conflicting billing history. Contact support before making subscription changes.')
  }

  const subscriptionState = await getSubscriptionStateForUser(input.userId)
  const existingSubscription = subscriptionState.activeSubscription

  if (existingSubscription) {
    const existingPlan = existingSubscription.plan
    if (!isManagedPlan(existingPlan)) {
      throw new Error('The current subscription state requires support review before checkout.')
    }
    const existingRank = MANAGED_PLAN_RANK[existingPlan]
    const requestedRank = MANAGED_PLAN_RANK[input.plan]

    if (subscriptionState.reason === 'payment_unpaid' || subscriptionState.reason === 'past_due_expired') {
      throw new Error('Resolve Billing: update your payment method in the Customer Portal before starting a new checkout.')
    }

    if (existingRank === requestedRank) {
      throw new Error(`This account already has an active ${getPlanLabel(input.plan)} subscription.`)
    }

    if (existingRank > requestedRank) {
      await scheduleDowngradeAtPeriodEnd({
        currentPlan: existingPlan,
        idempotencyKey: `rayd8:downgrade:${input.userId}:${existingSubscription.stripeSubscriptionId}:${input.plan}`,
        plan: input.plan,
        planType: input.planType ?? existingSubscription.planType ?? 'single',
        stripeSubscriptionId: existingSubscription.stripeSubscriptionId,
        userId: input.userId,
      })

      return {
        id: existingSubscription.stripeSubscriptionId,
        url: `${env.APP_URL}/dashboard/settings?billing=downgrade_scheduled`,
      }
    }

    if (existingRank < requestedRank) {
      const updatedSubscription = await updateExistingSubscriptionPlan({
        currentPlan: existingPlan,
        idempotencyKey: `rayd8:upgrade:${input.userId}:${existingSubscription.stripeSubscriptionId}:${input.plan}`,
        plan: input.plan,
        planType: input.planType ?? existingSubscription.planType ?? 'single',
        stripeSubscriptionId: existingSubscription.stripeSubscriptionId,
        userId: input.userId,
      })

      return {
        id: updatedSubscription.id,
        url: `${env.APP_URL}/dashboard?billing=upgrade_processing`,
      }
    }
  }

  if (subscriptionState.paymentRecoveryRequired) {
    throw new Error('Resolve Billing: update your payment method in the Customer Portal before starting a new checkout.')
  }

  const persistedUserPlan = await findPersistedUserPlan(input.userId)
  const persistedPlanBlockMessage = !existingSubscription
    ? getPersistedPlanCheckoutBlockMessage({
        persistedPlan: persistedUserPlan,
        requestedPlan: input.plan,
      })
    : null

  if (persistedPlanBlockMessage) {
    throw new Error(persistedPlanBlockMessage)
  }

  const customerId = await resolveStripeCustomerForUser({
    email: input.email,
    stripeClient,
    userId: input.userId,
  })
  const openAttempt = await findOpenCheckoutAttempt({
    action: 'new_subscription',
    targetPlan: input.plan,
    userId: input.userId,
  })

  if (openAttempt?.stripeSessionId) {
    const existingSession = await stripeClient.checkout.sessions.retrieve(openAttempt.stripeSessionId)

    if (existingSession.url) {
      return existingSession
    }
  }

  const checkoutAttempt = await createCheckoutAttempt({
    action: 'new_subscription',
    targetPlan: input.plan,
    userId: input.userId,
  })
  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    allow_promotion_codes: true,
    success_url: `${env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/subscription?plan=${input.plan}&canceled=true`,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: input.userId,
    metadata: {
      plan: input.plan,
      planType: input.planType ?? 'single',
      referral_code: input.referralCode ?? '',
      referrer_user_id: input.referrerUserId ?? '',
      userId: input.userId,
    },
    subscription_data: {
      metadata: {
        plan: input.plan,
        planType: input.planType ?? 'single',
        referral_code: input.referralCode ?? '',
        referrer_user_id: input.referrerUserId ?? '',
        userId: input.userId,
      },
    },
    customer: customerId,
  }

  const session = await stripeClient.checkout.sessions.create(sessionConfig, {
    idempotencyKey: checkoutAttempt.idempotencyKey,
  })
  await attachCheckoutAttemptSession({
    idempotencyKey: checkoutAttempt.idempotencyKey,
    stripeSessionId: session.id,
  })

  if (input.referralCode && input.referrerUserId) {
    await recordAffiliateTrackingEvent({
      affiliateUserId: input.referrerUserId,
      eventType: 'checkout_created',
      hasReferralMetadata: true,
      message: 'Stripe metadata attached to checkout',
      referralCode: input.referralCode,
      referredUserId: input.userId,
      result: 'success',
      stripeEventId: session.id,
    })
  }

  return session
}

async function hasProcessedCheckoutSession(stripeSessionId: string) {
  if (!db) {
    return false
  }

  const [sessionRecord] = await db
    .select()
    .from(stripeCheckoutSessions)
    .where(eq(stripeCheckoutSessions.stripeSessionId, stripeSessionId))
    .limit(1)

  return Boolean(sessionRecord)
}

async function markCheckoutSessionProcessed(stripeSessionId: string, userId: string) {
  if (!db) {
    return
  }

  await db
    .insert(stripeCheckoutSessions)
    .values({ stripeSessionId, userId })
    .onConflictDoNothing()
  await markCheckoutAttemptCompleted(stripeSessionId)
}

async function hasProcessedEvent(stripeEventId: string) {
  if (!db) {
    return false
  }

  const [eventRecord] = await db
    .select()
    .from(stripeEvents)
    .where(eq(stripeEvents.stripeEventId, stripeEventId))
    .limit(1)

  return eventRecord?.status === 'completed'
}

async function claimStripeEvent(event: Pick<Stripe.Event, 'created' | 'id' | 'type'>) {
  if (!db) {
    return { claimed: true, duplicate: false }
  }

  const now = new Date()
  const stripeCreatedAt = fromUnixTimestamp(event.created)
  const inserted = await db
    .insert(stripeEvents)
    .values({
      stripeEventId: event.id,
      type: event.type,
      status: 'processing',
      attempts: 1,
      claimedAt: now,
      stripeCreatedAt,
      processedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id })

  if (inserted.length > 0) {
    return { claimed: true, duplicate: false }
  }

  const [existingEvent] = await db
    .select()
    .from(stripeEvents)
    .where(eq(stripeEvents.stripeEventId, event.id))
    .limit(1)

  if (!existingEvent || existingEvent.status === 'completed') {
    return { claimed: false, duplicate: true }
  }

  const claimIsExpired =
    !existingEvent.claimedAt || now.getTime() - existingEvent.claimedAt.getTime() > STRIPE_EVENT_LEASE_MS

  if (existingEvent.status === 'processing' && !claimIsExpired) {
    return { claimed: false, duplicate: true }
  }

  await db
    .update(stripeEvents)
    .set({
      attempts: existingEvent.attempts + 1,
      claimedAt: now,
      failedAt: null,
      lastError: null,
      status: 'processing',
      stripeCreatedAt: existingEvent.stripeCreatedAt ?? stripeCreatedAt,
      type: event.type,
    })
    .where(eq(stripeEvents.stripeEventId, event.id))

  return { claimed: true, duplicate: false }
}

async function markEventCompleted(stripeEventId: string, type: string) {
  if (!db) {
    return
  }

  const now = new Date()
  await db
    .insert(stripeEvents)
    .values({
      attempts: 1,
      completedAt: now,
      processedAt: now,
      status: 'completed',
      stripeEventId,
      type,
    })
    .onConflictDoUpdate({
      target: stripeEvents.stripeEventId,
      set: {
        completedAt: now,
        lastError: null,
        processedAt: now,
        status: 'completed',
        type,
      },
    })
}

async function markEventFailed(stripeEventId: string, error: unknown) {
  if (!db) {
    return
  }

  await db
    .update(stripeEvents)
    .set({
      failedAt: new Date(),
      lastError: error instanceof Error ? error.message : String(error),
      status: 'failed',
    })
    .where(eq(stripeEvents.stripeEventId, stripeEventId))
}

function getInvoicePaymentSideEffectKey(invoiceId: string) {
  return `invoice:${invoiceId}:payment_succeeded`
}

async function upsertSubscriptionRecord(input: {
  cancelAtPeriodEnd: boolean
  customerId: string
  plan: PersistedPlan
  planType: ManagedPlanType
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  status: string
  stripeSubscriptionId: string
  stripeEventCreatedAt?: Date | null
  userId: string
}, database = db) {
  if (!database) {
    return
  }

  const existingSubscription = await findSubscriptionContext(input.stripeSubscriptionId, database)

  if (
    existingSubscription?.stripeEventCreatedAt &&
    input.stripeEventCreatedAt &&
    existingSubscription.stripeEventCreatedAt > input.stripeEventCreatedAt
  ) {
    return
  }

  const statusChangedAt =
    existingSubscription && existingSubscription.status === input.status
      ? existingSubscription.statusChangedAt
      : new Date()
  const pastDueStartedAt =
    input.status === 'past_due'
      ? existingSubscription?.status === 'past_due'
        ? existingSubscription.pastDueStartedAt ?? statusChangedAt
        : new Date()
      : input.status === 'active' || input.status === 'trialing'
        ? null
        : existingSubscription?.pastDueStartedAt ?? null

  await assertStripeCustomerBelongsToUser({
    stripeCustomerId: input.customerId,
    userId: input.userId,
  })

  await database
    .insert(subscriptions)
    .values({
      userId: input.userId,
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status: input.status,
      plan: input.plan,
      planType: input.planType,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      pastDueStartedAt,
      statusChangedAt,
      stripeEventCreatedAt: input.stripeEventCreatedAt ?? null,
    })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        stripeCustomerId: input.customerId,
        status: input.status,
        plan: input.plan,
        planType: input.planType,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        pastDueStartedAt,
        statusChangedAt,
        stripeEventCreatedAt: input.stripeEventCreatedAt ?? existingSubscription?.stripeEventCreatedAt ?? null,
      },
    })
}

async function updateClerkPlan(userId: string, plan: PersistedPlan) {
  if (!clerkClient) {
    return
  }

  try {
    const clerkUser = await clerkClient.users.getUser(userId)

    await clerkClient.users.updateUser(userId, {
      publicMetadata: {
        ...(clerkUser.publicMetadata ?? {}),
        plan,
      },
    })
  } catch (error) {
    console.warn('[subscriptions] Failed to update Clerk plan metadata', { userId, plan, error })
  }
}

async function findSubscriptionContext(stripeSubscriptionId: string, database = db) {
  if (!database) {
    return null
  }

  const [subscriptionRecord] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1)

  return subscriptionRecord ?? null
}

async function findManageableSubscriptionForUser(userId: string, database = db) {
  if (!database) {
    return null
  }

  const subscriptionRecords = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.currentPeriodEnd), desc(subscriptions.createdAt))

  return resolveSubscriptionStateFromRecords(subscriptionRecords).activeSubscription
}

async function findManageableSubscriptionsForUser(userId: string, database = db) {
  if (!database) {
    return []
  }

  return database
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, [...MANAGED_SUBSCRIPTION_STATUSES]),
      ),
    )
}

async function findPersistedUserPlan(userId: string, database = db) {
  if (!database) {
    return null
  }

  const [userRecord] = await database
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return userRecord?.plan ?? null
}

function resolveHighestManagedSubscription<T extends { currentPeriodEnd: Date | null; plan: PersistedPlan }>(
  subscriptionRecords: T[],
) {
  return subscriptionRecords
    .filter((subscriptionRecord): subscriptionRecord is T & { plan: ManagedPlan } =>
      isManagedPlan(subscriptionRecord.plan),
    )
    .sort((left, right) => {
      const rankDifference = MANAGED_PLAN_RANK[right.plan] - MANAGED_PLAN_RANK[left.plan]

      if (rankDifference !== 0) {
        return rankDifference
      }

      return (right.currentPeriodEnd?.getTime() ?? 0) - (left.currentPeriodEnd?.getTime() ?? 0)
    })[0] ?? null
}

export function resolveManagedSubscriptionActivation(input: {
  existingSubscriptions: Array<{
    currentPeriodEnd: Date | null
    plan: PersistedPlan
    status: string
    stripeSubscriptionId: string
  }>
  incomingSubscription: {
    plan: ManagedPlan
    status: string
    stripeSubscriptionId: string
  }
}) {
  if (!isManageableSubscriptionStatus(input.incomingSubscription.status)) {
    return {
      incomingCanceled: false,
      lowerTierSubscriptionIds: [],
      shouldActivateIncoming: false,
      stripeSubscriptionsToCancel: [],
    }
  }

  const existingManagedSubscriptions = input.existingSubscriptions
    .filter((subscriptionRecord): subscriptionRecord is typeof subscriptionRecord & { plan: ManagedPlan } =>
      subscriptionRecord.stripeSubscriptionId !== input.incomingSubscription.stripeSubscriptionId &&
      isManagedPlan(subscriptionRecord.plan) &&
      isManageableSubscriptionStatus(subscriptionRecord.status),
    )
  const highestExistingSubscription = resolveHighestManagedSubscription(existingManagedSubscriptions)
  const incomingRank = MANAGED_PLAN_RANK[input.incomingSubscription.plan]
  const highestExistingRank = highestExistingSubscription
    ? MANAGED_PLAN_RANK[highestExistingSubscription.plan]
    : 0

  if (highestExistingSubscription && highestExistingRank >= incomingRank) {
    return {
      incomingCanceled: true,
      lowerTierSubscriptionIds: [],
      shouldActivateIncoming: false,
      stripeSubscriptionsToCancel: [input.incomingSubscription.stripeSubscriptionId],
    }
  }

  const lowerTierSubscriptionIds = existingManagedSubscriptions
    .filter((subscriptionRecord) => MANAGED_PLAN_RANK[subscriptionRecord.plan] < incomingRank)
    .map((subscriptionRecord) => subscriptionRecord.stripeSubscriptionId)

  return {
    incomingCanceled: false,
    lowerTierSubscriptionIds,
    shouldActivateIncoming: true,
    stripeSubscriptionsToCancel: lowerTierSubscriptionIds,
  }
}

async function persistManagedPlanForUser(userId: string, database = db) {
  if (!database) {
    return 'free' as PersistedPlan
  }

  const subscriptionRecords = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
  const nextPlan = resolveSubscriptionStateFromRecords(subscriptionRecords).entitlementPlan

  await database.update(users).set({ plan: nextPlan }).where(eq(users.id, userId))

  return nextPlan
}

export async function syncManagedPlanForUser(
  userId: string,
  options: { syncAweber?: boolean } = {},
) {
  const nextPlan = await persistManagedPlanForUser(userId)
  await updateClerkPlan(userId, nextPlan)

  if (options.syncAweber !== false) {
    queueAweberPlanSync({ plan: nextPlan, userId })
  }

  return nextPlan
}

async function cancelStripeSubscriptionSafely(stripeSubscriptionId: string, context: Record<string, unknown>) {
  if (!stripeClient) {
    return
  }

  try {
    await stripeClient.subscriptions.cancel(stripeSubscriptionId)
  } catch (error) {
    console.warn('[subscriptions] Failed to cancel Stripe subscription after DB reconciliation', {
      ...context,
      error,
      stripeSubscriptionId,
    })
  }
}

async function activateManagedSubscriptionRecord(input: {
  cancelAtPeriodEnd: boolean
  customerId: string
  currentPeriodEnd: Date | null
  currentPeriodStart: Date | null
  plan: ManagedPlan
  planType: ManagedPlanType
  status: string
  stripeEventCreatedAt?: Date | null
  stripeSubscriptionId: string
  userId: string
}) {
  if (!db || !isManageableSubscriptionStatus(input.status)) {
    await upsertSubscriptionRecord(input)
    await syncManagedPlanForUser(input.userId)
    return
  }

  const reconciliation = await db.transaction(async (transaction) => {
    const database = transaction as unknown as AppDatabase
    const existingManagedSubscriptions = await findManageableSubscriptionsForUser(input.userId, database)
    const activation = resolveManagedSubscriptionActivation({
      existingSubscriptions: existingManagedSubscriptions,
      incomingSubscription: {
        plan: input.plan,
        status: input.status,
        stripeSubscriptionId: input.stripeSubscriptionId,
      },
    })

    if (activation.incomingCanceled) {
      await upsertSubscriptionRecord({
        ...input,
        cancelAtPeriodEnd: false,
        status: 'canceled',
      }, database)
      const nextPlan = await persistManagedPlanForUser(input.userId, database)

      return {
        incomingCanceled: true,
        nextPlan,
        stripeSubscriptionsToCancel: activation.stripeSubscriptionsToCancel,
      }
    }

    if (activation.lowerTierSubscriptionIds.length > 0) {
      await Promise.all(
        activation.lowerTierSubscriptionIds.map((stripeSubscriptionId) =>
          database
            .update(subscriptions)
            .set({
              status: 'canceled',
              cancelAtPeriodEnd: false,
            })
            .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId)),
        ),
      )
    }

    await upsertSubscriptionRecord(input, database)
    const nextPlan = await persistManagedPlanForUser(input.userId, database)

    return {
      incomingCanceled: false,
      nextPlan,
      stripeSubscriptionsToCancel: activation.stripeSubscriptionsToCancel,
    }
  })

  await updateClerkPlan(input.userId, reconciliation.nextPlan)
  queueAweberPlanSync({ plan: reconciliation.nextPlan, userId: input.userId })

  await Promise.all(
    reconciliation.stripeSubscriptionsToCancel.map((stripeSubscriptionId) =>
      cancelStripeSubscriptionSafely(stripeSubscriptionId, {
        incomingCanceled: reconciliation.incomingCanceled,
        incomingPlan: input.plan,
        incomingStripeSubscriptionId: input.stripeSubscriptionId,
        userId: input.userId,
      }),
    ),
  )
}

async function storeCancellationFeedback(input: {
  currentPeriodEnd: Date | null
  customMessage?: string | null
  reasons: CancellationReason[]
  stripeSubscriptionId: string
  userId: string
}) {
  if (!db) {
    return
  }

  await db.insert(subscriptionCancellationFeedback).values({
    userId: input.userId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    reasons: input.reasons,
    customMessage: input.customMessage?.trim() ? input.customMessage.trim() : null,
    currentPeriodEnd: input.currentPeriodEnd,
  })
}

async function getUserNotificationContext(userId: string) {
  if (!db) {
    return null
  }

  const [userRecord] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  return userRecord ?? null
}

async function safeDispatchNotification(
  ...args: Parameters<typeof dispatchNotification>
) {
  try {
    await dispatchNotification(...args)
  } catch (error) {
    console.error('[notifications]', error)
  }
}

function toAweberSyncPlan(plan: PersistedPlan): AweberSyncPlan | null {
  if (plan === 'free' || plan === 'regen' || plan === 'amrita') {
    return plan
  }

  return null
}

async function safeSyncPlanToAweber(input: { plan: PersistedPlan; userId: string }) {
  const plan = toAweberSyncPlan(input.plan)

  if (!db || !plan) {
    return
  }

  try {
    const [userRecord] = await db
      .select({
        email: users.email,
        id: users.id,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)

    if (!userRecord) {
      return
    }

    await safeSyncUserToAweber({
      email: userRecord.email,
      plan,
      userId: userRecord.id,
    })
  } catch (error) {
    console.error('[aweber] unable to sync finalized user plan', {
      message: error instanceof Error ? error.message : String(error),
      plan,
      userId: input.userId,
    })
  }
}

function queueAweberPlanSync(input: { plan: PersistedPlan; userId: string }) {
  void safeSyncPlanToAweber(input)
}

function normalizePlanType(value: unknown): ManagedPlanType {
  return value === 'multi' ? 'multi' : 'single'
}

function fromUnixTimestamp(value?: number | null) {
  return typeof value === 'number' ? new Date(value * 1000) : null
}

function toStripeResourceId(value: string | Stripe.Subscription | Stripe.Customer | Stripe.DeletedCustomer) {
  if (typeof value === 'string') {
    return value
  }

  return value.id
}

function getCheckoutSessionContext(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {}
  const userId = session.client_reference_id ?? metadata.userId
  const plan = parseManagedPlan(metadata.plan)
  const planType = normalizePlanType(metadata.planType)

  if (!userId || !plan || !session.subscription || !session.customer) {
    return null
  }

  return {
    customerId: toStripeResourceId(session.customer),
    plan,
    planType,
    stripeSubscriptionId: toStripeResourceId(session.subscription),
    userId,
  }
}

function getCheckoutSessionUpgradeContext(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {}
  const userId = session.client_reference_id ?? metadata.userId
  const plan = parseManagedPlan(metadata.plan)
  const fromPlan = parseManagedPlan(metadata.fromPlan)
  const planType = normalizePlanType(metadata.planType)

  if (
    metadata.kind !== MANAGED_PLAN_UPGRADE_CHECKOUT_KIND ||
    !userId ||
    !plan ||
    !fromPlan ||
    !metadata.stripeSubscriptionId ||
    !session.customer
  ) {
    return null
  }

  return {
    customerId: toStripeResourceId(session.customer),
    fromPlan,
    plan,
    planType,
    stripeSubscriptionId: metadata.stripeSubscriptionId,
    userId,
  }
}

function getCheckoutSessionCustomerEmail(session: Stripe.Checkout.Session) {
  const customerRecord =
    typeof session.customer === 'string' ? null : asRecord(session.customer)

  return (
    session.customer_details?.email ??
    session.customer_email ??
    (typeof customerRecord?.email === 'string' ? customerRecord.email : null)
  )
}

function getRewardfulConversionDetails(session: Stripe.Checkout.Session) {
  const sessionContext = getCheckoutSessionContext(session)
  const stripeCustomerEmail = getCheckoutSessionCustomerEmail(session)
  const rewardfulConversionEligible = Boolean(
    sessionContext?.plan === 'regen' &&
      session.status === 'complete' &&
      session.payment_status === 'paid' &&
      stripeCustomerEmail,
  )

  return {
    rewardfulConversionEligible,
    stripeCustomerEmail: rewardfulConversionEligible ? stripeCustomerEmail : null,
  }
}

export function isPaidCheckoutSession(session: Pick<Stripe.Checkout.Session, 'payment_status' | 'status'>) {
  return session.status === 'complete' && session.payment_status === 'paid'
}

function assertPaidCheckoutSession(session: Stripe.Checkout.Session) {
  if (!isPaidCheckoutSession(session)) {
    throw new Error('Checkout session is not fully paid yet.')
  }
}

export async function upsertUserSubscription(input: {
  cancelAtPeriodEnd?: boolean
  clerkUserId: string
  currentPeriodEnd?: Date | null
  currentPeriodStart?: Date | null
  plan: PersistedPlan
  planType?: ManagedPlanType
  status: string
  stripeEventCreatedAt?: Date | null
  stripeCustomerId: string
  stripeSubscriptionId: string
}) {
  if (isManagedPlan(input.plan)) {
    await activateManagedSubscriptionRecord({
      userId: input.clerkUserId,
      customerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId,
      status: input.status,
      plan: input.plan,
      planType: input.planType ?? 'single',
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      currentPeriodStart: input.currentPeriodStart ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      stripeEventCreatedAt: input.stripeEventCreatedAt ?? null,
    })
    return
  }

  await upsertSubscriptionRecord({
    userId: input.clerkUserId,
    customerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    status: input.status,
    plan: input.plan,
    planType: input.planType ?? 'single',
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    currentPeriodStart: input.currentPeriodStart ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    stripeEventCreatedAt: input.stripeEventCreatedAt ?? null,
  })

  if (!db) {
    await updateClerkPlan(input.clerkUserId, input.plan)
    return
  }

  await syncManagedPlanForUser(input.clerkUserId)
}

export async function updateSubscriptionStatus(input: {
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: Date | null
  currentPeriodStart?: Date | null
  status: string
  stripeEventCreatedAt?: Date | null
  stripeSubscriptionId: string
}) {
  const existingSubscription = await findSubscriptionContext(input.stripeSubscriptionId)

  if (!db || !existingSubscription) {
    return
  }

  if (
    existingSubscription.stripeEventCreatedAt &&
    input.stripeEventCreatedAt &&
    existingSubscription.stripeEventCreatedAt > input.stripeEventCreatedAt
  ) {
    return
  }

  const statusChangedAt =
    existingSubscription.status === input.status ? existingSubscription.statusChangedAt : new Date()
  const pastDueStartedAt =
    input.status === 'past_due'
      ? existingSubscription.status === 'past_due'
        ? existingSubscription.pastDueStartedAt ?? statusChangedAt
        : new Date()
      : input.status === 'active' || input.status === 'trialing'
        ? null
        : existingSubscription.pastDueStartedAt

  await db
    .update(subscriptions)
    .set({
      status: input.status,
      plan: existingSubscription.plan,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      currentPeriodStart: input.currentPeriodStart ?? existingSubscription.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd ?? existingSubscription.currentPeriodEnd,
      pastDueStartedAt,
      statusChangedAt,
      stripeEventCreatedAt: input.stripeEventCreatedAt ?? existingSubscription.stripeEventCreatedAt,
    })
    .where(eq(subscriptions.stripeSubscriptionId, input.stripeSubscriptionId))

  await syncManagedPlanForUser(existingSubscription.userId)
}

export async function markSubscriptionPastDue(stripeSubscriptionId: string, stripeEventCreatedAt?: Date | null) {
  await updateSubscriptionStatus({
    status: 'past_due',
    stripeEventCreatedAt,
    stripeSubscriptionId,
  })
}

async function activateCheckoutSession(session: Stripe.Checkout.Session) {
  const sessionContext = getCheckoutSessionContext(session)

  if (!sessionContext) {
    return null
  }

  assertPaidCheckoutSession(session)

  const expandedSubscription =
    typeof session.subscription === 'string' && stripeClient
      ? await stripeClient.subscriptions.retrieve(session.subscription)
      : session.subscription
  const subscriptionDetails =
    expandedSubscription && typeof expandedSubscription !== 'string'
      ? expandedSubscription
      : null

  await upsertUserSubscription({
    clerkUserId: sessionContext.userId,
    stripeCustomerId: sessionContext.customerId,
    stripeSubscriptionId: sessionContext.stripeSubscriptionId,
    status: subscriptionDetails?.status ?? 'active',
    plan: sessionContext.plan,
    planType: sessionContext.planType,
    cancelAtPeriodEnd: Boolean(subscriptionDetails?.cancel_at_period_end),
    currentPeriodStart: fromUnixTimestamp(
      subscriptionDetails?.items.data[0]?.current_period_start,
    ),
    currentPeriodEnd: fromUnixTimestamp(subscriptionDetails?.items.data[0]?.current_period_end),
  })
  await markCheckoutSessionProcessed(session.id, sessionContext.userId)

  return {
    plan: sessionContext.plan,
    userId: sessionContext.userId,
  }
}

async function activateManagedPlanUpgradeCheckoutSession(session: Stripe.Checkout.Session) {
  const upgradeContext = getCheckoutSessionUpgradeContext(session)

  if (!upgradeContext) {
    return null
  }

  assertPaidCheckoutSession(session)

  if (!stripeClient) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and price IDs.')
  }

  const targetPriceId = getPriceIdForPlan(upgradeContext.plan)

  if (!targetPriceId) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and price IDs.')
  }

  const currentSubscription = await stripeClient.subscriptions.retrieve(
    upgradeContext.stripeSubscriptionId,
    {
      expand: ['items.data.price'],
    },
  )
  const subscriptionItem =
    currentSubscription.items.data.find((item) => item.price.id === getPriceIdForPlan(upgradeContext.fromPlan)) ??
    currentSubscription.items.data[0]

  if (!subscriptionItem) {
    throw new Error('No active subscription item was found for this upgrade.')
  }

  const updatedSubscription = await stripeClient.subscriptions.update(
    currentSubscription.id,
    buildManagedPlanUpgradeSubscriptionUpdateParams({
      currentMetadata: currentSubscription.metadata,
      plan: upgradeContext.plan,
      planType: upgradeContext.planType,
      subscriptionItemId: subscriptionItem.id,
      targetPriceId,
      userId: upgradeContext.userId,
    }),
  )
  const currentPeriodStart = fromUnixTimestamp(updatedSubscription.items.data[0]?.current_period_start)
  const currentPeriodEnd = fromUnixTimestamp(updatedSubscription.items.data[0]?.current_period_end)

  await upsertUserSubscription({
    clerkUserId: upgradeContext.userId,
    stripeCustomerId: String(updatedSubscription.customer),
    stripeSubscriptionId: updatedSubscription.id,
    status: updatedSubscription.status,
    plan: upgradeContext.plan,
    planType: upgradeContext.planType,
    cancelAtPeriodEnd: Boolean(updatedSubscription.cancel_at_period_end),
    currentPeriodStart,
    currentPeriodEnd,
  })
  await markCheckoutSessionProcessed(session.id, upgradeContext.userId)

  return {
    plan: upgradeContext.plan,
    userId: upgradeContext.userId,
  }
}

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function getStripeObjectId(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  const record = asRecord(value)
  return typeof record?.id === 'string' ? record.id : null
}

function getAmountDiscounted(value: unknown) {
  const record = asRecord(value)
  const amount = record?.amount
  return typeof amount === 'number' ? amount : null
}

export function extractDiscountDetails(discount: unknown, amountDiscounted?: number | null) {
  const record = asRecord(discount)

  if (!record) {
    return null
  }

  const source = asRecord(record.source)
  const promotionCodeId =
    getStripeObjectId(record.promotion_code) ?? getStripeObjectId(source?.promotion_code)
  const couponId = getStripeObjectId(record.coupon) ?? getStripeObjectId(source?.coupon)

  if (!promotionCodeId && !couponId) {
    return null
  }

  return {
    amountDiscounted: amountDiscounted ?? null,
    couponId,
    promotionCodeId,
  }
}

function getFirstDiscountDetailsFromArray(value: unknown, amountDiscounted?: number | null) {
  if (!Array.isArray(value)) {
    return null
  }

  for (const item of value) {
    const itemRecord = asRecord(item)
    const nestedDiscount = itemRecord?.discount ?? item
    const nestedAmount = getAmountDiscounted(item) ?? amountDiscounted ?? null
    const details = extractDiscountDetails(nestedDiscount, nestedAmount)

    if (details) {
      return details
    }
  }

  return null
}

export function getCheckoutDiscountDetails(session: Stripe.Checkout.Session) {
  const checkoutSession = session as Stripe.Checkout.Session & {
    discount?: unknown
    discounts?: unknown
    subscription?: unknown
  }
  const totalDetails = asRecord(checkoutSession.total_details)
  const totalAmountDiscounted =
    typeof totalDetails?.amount_discount === 'number' ? totalDetails.amount_discount : null
  const breakdown = asRecord(totalDetails?.breakdown)
  const fromBreakdown = getFirstDiscountDetailsFromArray(
    breakdown?.discounts,
    totalAmountDiscounted,
  )

  if (fromBreakdown) {
    return fromBreakdown
  }

  const fromSessionDiscounts = getFirstDiscountDetailsFromArray(
    checkoutSession.discounts,
    totalAmountDiscounted,
  )

  if (fromSessionDiscounts) {
    return fromSessionDiscounts
  }

  const fromSessionDiscount = extractDiscountDetails(checkoutSession.discount, totalAmountDiscounted)

  if (fromSessionDiscount) {
    return fromSessionDiscount
  }

  const subscription = asRecord(checkoutSession.subscription)
  const fromSubscriptionDiscounts = getFirstDiscountDetailsFromArray(
    subscription?.discounts,
    totalAmountDiscounted,
  )

  if (fromSubscriptionDiscounts) {
    return fromSubscriptionDiscounts
  }

  return extractDiscountDetails(subscription?.discount, totalAmountDiscounted)
}

async function retrieveCheckoutSessionWithDiscounts(sessionId: string) {
  if (!stripeClient) {
    return null
  }

  try {
    return await stripeClient.checkout.sessions.retrieve(sessionId, {
      expand: [
        'discounts',
        'discounts.coupon',
        'discounts.promotion_code',
        'subscription',
        'subscription.discounts',
        'subscription.discounts.coupon',
        'subscription.discounts.promotion_code',
      ],
    })
  } catch {
    return stripeClient.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })
  }
}

async function recordCheckoutPromoCodeRedemption(session: Stripe.Checkout.Session) {
  const details = getCheckoutDiscountDetails(session)

  if (!details) {
    return
  }

  await recordPromoCodeRedemption({
    amountDiscounted: details.amountDiscounted,
    currency: session.currency ?? null,
    customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
    stripeCheckoutSessionId: session.id,
    stripeCouponId: details.couponId,
    stripeCustomerId:
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
    stripePromotionCodeId: details.promotionCodeId,
    stripeSubscriptionId:
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
    userId: session.client_reference_id ?? session.metadata?.userId ?? null,
  })
}

function getInvoiceDiscountAmount(invoice: Stripe.Invoice) {
  const invoiceRecord = invoice as Stripe.Invoice & {
    total_discount_amounts?: Array<{ amount?: number | null }> | null
  }

  return (
    invoiceRecord.total_discount_amounts?.reduce((total, item) => total + (item.amount ?? 0), 0) ??
    null
  )
}

function getInvoiceDiscountDetails(invoice: Stripe.Invoice, subscription: Stripe.Subscription) {
  const amountDiscounted = getInvoiceDiscountAmount(invoice)
  const invoiceRecord = invoice as Stripe.Invoice & {
    discount?: unknown
    discounts?: unknown
  }
  const fromInvoiceDiscounts = getFirstDiscountDetailsFromArray(
    invoiceRecord.discounts,
    amountDiscounted,
  )

  if (fromInvoiceDiscounts) {
    return fromInvoiceDiscounts
  }

  const fromInvoiceDiscount = extractDiscountDetails(invoiceRecord.discount, amountDiscounted)

  if (fromInvoiceDiscount) {
    return fromInvoiceDiscount
  }

  const subscriptionRecord = subscription as Stripe.Subscription & {
    discount?: unknown
    discounts?: unknown
  }
  const fromSubscriptionDiscounts = getFirstDiscountDetailsFromArray(
    subscriptionRecord.discounts,
    amountDiscounted,
  )

  if (fromSubscriptionDiscounts) {
    return fromSubscriptionDiscounts
  }

  return extractDiscountDetails(subscriptionRecord.discount, amountDiscounted)
}

async function recordInvoicePromoCodeRedemption(input: {
  invoice: Stripe.Invoice
  subscription: Stripe.Subscription
  userEmail?: string | null
  userId?: string | null
}) {
  const details = getInvoiceDiscountDetails(input.invoice, input.subscription)

  if (!details) {
    return
  }

  await recordPromoCodeRedemption({
    amountDiscounted: details.amountDiscounted,
    currency: input.invoice.currency ?? null,
    customerEmail: input.userEmail ?? null,
    stripeCouponId: details.couponId,
    stripeCustomerId:
      typeof input.invoice.customer === 'string'
        ? input.invoice.customer
        : input.invoice.customer?.id ?? null,
    stripeInvoiceId: input.invoice.id,
    stripePromotionCodeId: details.promotionCodeId,
    stripeSubscriptionId: input.subscription.id,
    userId: input.userId ?? null,
  })
}

async function handleCheckoutCompleted(event: Stripe.CheckoutSessionCompletedEvent) {
  let session = event.data.object

  if (await hasProcessedCheckoutSession(session.id)) {
    return
  }

  if (stripeClient) {
    const retrievedSession = await retrieveCheckoutSessionWithDiscounts(event.data.object.id)

    if (retrievedSession) {
      session = retrievedSession
    }
  }
  const metadata = session.metadata ?? {}

  if (metadata.referral_code && metadata.referrer_user_id) {
    await recordAffiliateTrackingEvent({
      affiliateUserId: metadata.referrer_user_id,
      eventType: 'checkout_completed',
      hasReferralMetadata: true,
      message: 'Checkout session completed',
      referralCode: metadata.referral_code,
      referredUserId: (session.client_reference_id ?? metadata.userId) ?? null,
      result: 'success',
      stripeCustomerId:
        typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
      stripeSubscriptionId:
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
    })
  }
  await recordCheckoutPromoCodeRedemption(session)

  if (getCheckoutSessionUpgradeContext(session)) {
    await activateManagedPlanUpgradeCheckoutSession(session)
    return
  }

  await activateCheckoutSession(session)
}

async function syncSubscriptionFromStripe(subscription: Stripe.Subscription, stripeEventCreatedAt?: Date | null) {
  const existingSubscription = await findSubscriptionContext(subscription.id)
  const stripeCustomerId = subscription.customer ? String(subscription.customer) : null
  const [customerMappedUser] =
    db && stripeCustomerId
      ? await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.stripeCustomerId, stripeCustomerId))
          .limit(1)
      : [null]
  const userId = customerMappedUser?.id ?? subscription.metadata.userId ?? existingSubscription?.userId

  if (!userId || !stripeCustomerId) {
    return
  }

  await assertStripeCustomerBelongsToUser({
    stripeCustomerId,
    userId,
  })

  const hasReferralMetadata = Boolean(
    subscription.metadata.referral_code && subscription.metadata.referrer_user_id,
  )

  if (hasReferralMetadata) {
    await recordAffiliateTrackingEvent({
      affiliateUserId: subscription.metadata.referrer_user_id ?? null,
      eventType: 'stripe_metadata_attached',
      hasReferralMetadata: true,
      message: 'Stripe metadata attached',
      referralCode: subscription.metadata.referral_code ?? null,
      referredUserId: userId,
      result: 'success',
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
    })
  }

  const plan =
    (subscription.metadata.plan as 'regen' | 'amrita' | undefined) ??
    planFromPriceId(subscription.items.data[0]?.price.id) ??
    existingSubscription?.plan ??
    'free'
  const planType =
    normalizePlanType(subscription.metadata.planType) ??
    existingSubscription?.planType ??
    'single'
  const currentPeriodStart = fromUnixTimestamp(subscription.items.data[0]?.current_period_start)
  const currentPeriodEnd = fromUnixTimestamp(subscription.items.data[0]?.current_period_end)

  await upsertUserSubscription({
    clerkUserId: userId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    plan,
    planType,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodStart,
    currentPeriodEnd,
    stripeEventCreatedAt,
  })
}

async function handleSubscriptionCreated(event: Stripe.CustomerSubscriptionCreatedEvent) {
  const subscription = event.data.object
  await syncSubscriptionFromStripe(subscription, fromUnixTimestamp(event.created))

  const existingSubscription = await findSubscriptionContext(subscription.id)
  const userId = subscription.metadata.userId ?? existingSubscription?.userId

  if (!userId) {
    return
  }

  const userContext = await getUserNotificationContext(userId)

  await safeDispatchNotification({
    event: 'subscription.created',
    payload: {
      currentPeriodEnd: fromUnixTimestamp(subscription.items.data[0]?.current_period_end)?.toISOString() ?? null,
      currentPeriodStart:
        fromUnixTimestamp(subscription.items.data[0]?.current_period_start)?.toISOString() ?? null,
      entityId: subscription.id,
      plan:
        (subscription.metadata.plan as PersistedPlan | undefined) ??
        existingSubscription?.plan ??
        'regen',
      subscriptionId: subscription.id,
      userEmail: userContext?.email ?? null,
    },
    userId,
  })
}

async function handleSubscriptionUpdated(event: Stripe.CustomerSubscriptionUpdatedEvent) {
  await syncSubscriptionFromStripe(event.data.object, fromUnixTimestamp(event.created))
}

async function handleSubscriptionDeleted(event: Stripe.CustomerSubscriptionDeletedEvent) {
  const subscription = event.data.object
  const existingSubscription = await findSubscriptionContext(subscription.id)
  await updateSubscriptionStatus({
    status: 'canceled',
    stripeSubscriptionId: subscription.id,
    cancelAtPeriodEnd: false,
    currentPeriodStart: fromUnixTimestamp(subscription.items.data[0]?.current_period_start),
    currentPeriodEnd: fromUnixTimestamp(subscription.items.data[0]?.current_period_end),
    stripeEventCreatedAt: fromUnixTimestamp(event.created),
  })

  const userId = subscription.metadata.userId ?? existingSubscription?.userId

  if (!userId) {
    return
  }

  const userContext = await getUserNotificationContext(userId)

  await safeDispatchNotification({
    event: 'subscription.cancelled',
    payload: {
      cancelledAt: new Date().toISOString(),
      entityId: subscription.id,
      plan:
        (subscription.metadata.plan as PersistedPlan | undefined) ??
        existingSubscription?.plan ??
        'regen',
      subscriptionId: subscription.id,
      userEmail: userContext?.email ?? null,
    },
    userId,
  })
}

async function handleInvoicePaymentSucceeded(event: Stripe.InvoicePaymentSucceededEvent) {
  let invoice = event.data.object as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id

  if (!subscriptionId) {
    return
  }

  if (!stripeClient) {
    await updateSubscriptionStatus({
      status: 'active',
      stripeSubscriptionId: subscriptionId,
    })
    return
  }

  invoice = typeof stripeClient.invoices?.retrieve === 'function'
    ? await stripeClient.invoices.retrieve(invoice.id, {
        expand: [
          'discounts',
          'discounts.coupon',
          'discounts.promotion_code',
        ],
      }).catch(() => invoice)
    : invoice
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId, {
    expand: [
      'discounts',
      'discounts.coupon',
      'discounts.promotion_code',
    ],
  }).catch(() => stripeClient.subscriptions.retrieve(subscriptionId))
  await syncSubscriptionFromStripe(subscription, fromUnixTimestamp(event.created))

  const invoiceSideEffectKey = getInvoicePaymentSideEffectKey(invoice.id)

  if (await hasProcessedEvent(invoiceSideEffectKey)) {
    return
  }

  const existingSubscription = await findSubscriptionContext(subscription.id)
  const userId = subscription.metadata.userId ?? existingSubscription?.userId

  if (!userId) {
    return
  }

  const userContext = await getUserNotificationContext(userId)
  const amount = (invoice.amount_paid ?? invoice.amount_due ?? 0) / 100
  const plan =
    (subscription.metadata.plan as PersistedPlan | undefined) ??
    existingSubscription?.plan ??
    'regen'

  await recordInvoicePromoCodeRedemption({
    invoice,
    subscription,
    userEmail: userContext?.email ?? null,
    userId,
  })

  const affiliateCommissionResult = await createAffiliateCommissionForSubscriptionCreate({
    affiliateUserIdFromMetadata: subscription.metadata.referrer_user_id ?? null,
    billingReason: invoice.billing_reason,
    eventId: event.id,
    invoiceId: invoice.id,
    plan,
    referralCodeFromMetadata: subscription.metadata.referral_code ?? null,
    stripeCustomerId:
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null,
    stripeSubscriptionId: subscription.id,
    userId,
  })

  if (affiliateCommissionResult.created && affiliateCommissionResult.commissionId) {
    const affiliateContext = await getUserNotificationContext(affiliateCommissionResult.affiliateUserId)

    await safeDispatchNotification({
      event: 'admin.affiliate.purchase',
      payload: {
        affiliateEmail: affiliateContext?.email ?? null,
        affiliateUserId: affiliateCommissionResult.affiliateUserId,
        amountUsd: affiliateCommissionResult.amountUsd,
        customerEmail: userContext?.email ?? invoice.customer_email ?? null,
        entityId: affiliateCommissionResult.commissionId,
        plan,
        referralCode: subscription.metadata.referral_code ?? null,
        referredUserId: affiliateCommissionResult.referredUserId,
        stripeCustomerId:
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null,
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscription.id,
      },
      userId,
    })
  }

  await safeDispatchNotification({
    event: 'payment.succeeded',
    payload: {
      amount,
      currency: invoice.currency ?? 'usd',
      entityId: invoice.id,
      paymentId: invoice.id,
      plan,
      userEmail: userContext?.email ?? null,
    },
    userId,
  })

  await safeDispatchNotification({
    event: 'admin.payment.received',
    payload: {
      amount,
      currency: invoice.currency ?? 'usd',
      entityId: invoice.id,
      paymentId: invoice.id,
      plan,
      userEmail: userContext?.email ?? invoice.customer_email ?? null,
      stripeCustomerName: invoice.customer_name ?? null,
    },
    userId,
  })

  await markEventCompleted(invoiceSideEffectKey, 'invoice.payment_side_effects')
}

async function handleInvoicePaymentFailed(event: Stripe.InvoicePaymentFailedEvent) {
  const invoice = event.data.object as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }
  const subscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id

  if (!subscriptionId) {
    return
  }

  await markSubscriptionPastDue(subscriptionId, fromUnixTimestamp(event.created))
  const existingSubscription = await findSubscriptionContext(subscriptionId)
  const userId = existingSubscription?.userId

  if (!userId) {
    return
  }

  const userContext = await getUserNotificationContext(userId)

  await safeDispatchNotification({
    event: 'payment.failed',
    payload: {
      amount: (invoice.amount_due ?? 0) / 100,
      currency: invoice.currency ?? 'usd',
      entityId: invoice.id,
      paymentId: invoice.id,
      plan: existingSubscription?.plan ?? 'regen',
      reason: invoice.last_finalization_error?.message ?? 'Stripe could not collect the payment.',
      userEmail: userContext?.email ?? null,
    },
    userId,
  })
}

export async function processStripeEvent(event: Stripe.Event) {
  const claim = await claimStripeEvent(event)

  if (claim.duplicate || !claim.claimed) {
    return { duplicate: true }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event as Stripe.CheckoutSessionCompletedEvent)
        break
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event as Stripe.CustomerSubscriptionCreatedEvent)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event as Stripe.CustomerSubscriptionUpdatedEvent)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event as Stripe.CustomerSubscriptionDeletedEvent)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event as Stripe.InvoicePaymentSucceededEvent)
        break
      case 'invoice.paid':
        await handleInvoicePaymentSucceeded(event as unknown as Stripe.InvoicePaymentSucceededEvent)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event as Stripe.InvoicePaymentFailedEvent)
        break
      default:
        break
    }

    await markEventCompleted(event.id, event.type)
  } catch (error) {
    await markEventFailed(event.id, error)
    throw error
  }

  return { duplicate: false }
}

export async function getCheckoutAffiliateMetadata(userId: string) {
  const attribution = await getAffiliateAttributionForUser(userId)

  if (!attribution) {
    return null
  }

  return {
    referralCode: attribution.referralCode,
    referrerUserId: attribution.referrerUserId,
  }
}

export async function createBillingPortalSession(input: { userId: string }) {
  if (!stripeClient) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and portal settings.')
  }

  const subscription = await findManageableSubscriptionForUser(input.userId)

  if (!subscription) {
    throw new Error('No active subscription was found for this account.')
  }

  const session = await stripeClient.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${env.APP_URL}/dashboard/settings`,
  })

  return {
    currentPeriodEnd: subscription.currentPeriodEnd,
    url: session.url,
  }
}

export async function getBillingStatus(userId: string) {
  const state = await getSubscriptionStateForUser(userId)
  const subscription = state.activeSubscription

  if (!subscription) {
    return {
      entitlementPlan: state.entitlementPlan,
      paymentRecoveryRequired: state.paymentRecoveryRequired,
      reason: state.reason,
      subscription: null,
    }
  }

  return {
    entitlementPlan: state.entitlementPlan,
    paymentRecoveryRequired: state.paymentRecoveryRequired,
    reason: state.reason,
    subscription: {
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart,
      pendingDowngradePlan: subscription.pendingDowngradePlan,
      plan: subscription.plan,
      status: subscription.status,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    },
  }
}

export async function cancelSubscriptionAtPeriodEnd(input: {
  customMessage?: string | null
  reasons: CancellationReason[]
  userId: string
}) {
  if (!stripeClient) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and portal settings.')
  }

  const subscription = await findManageableSubscriptionForUser(input.userId)

  if (!subscription) {
    throw new Error('No active subscription was found for this account.')
  }

  if (subscription.cancelAtPeriodEnd) {
    return {
      currentPeriodEnd: subscription.currentPeriodEnd,
      status: subscription.status,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      cancelAtPeriodEnd: true,
    }
  }

  const updatedSubscription = await stripeClient.subscriptions.update(
    subscription.stripeSubscriptionId,
    {
      cancel_at_period_end: true,
    },
  )

  const currentPeriodStart = fromUnixTimestamp(updatedSubscription.items.data[0]?.current_period_start)
  const currentPeriodEnd = fromUnixTimestamp(updatedSubscription.items.data[0]?.current_period_end)

  await upsertSubscriptionRecord({
    userId: input.userId,
    customerId: String(updatedSubscription.customer),
    stripeSubscriptionId: updatedSubscription.id,
    status: updatedSubscription.status,
    plan: subscription.plan,
    planType: subscription.planType,
    cancelAtPeriodEnd: Boolean(updatedSubscription.cancel_at_period_end),
    currentPeriodStart,
    currentPeriodEnd,
  })

  await storeCancellationFeedback({
    userId: input.userId,
    stripeSubscriptionId: updatedSubscription.id,
    reasons: input.reasons,
    customMessage: input.customMessage,
    currentPeriodEnd,
  })

  return {
    currentPeriodEnd,
    status: updatedSubscription.status,
    stripeSubscriptionId: updatedSubscription.id,
    cancelAtPeriodEnd: Boolean(updatedSubscription.cancel_at_period_end),
  }
}

export async function getActiveSubscription(userId: string) {
  if (!db) {
    return null
  }

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, 'active'),
      ),
    )
    .limit(1)

  return subscription ?? null
}

export async function verifyCheckoutSession(input: {
  sessionId: string
  userId: string
}) {
  if (!stripeClient) {
    throw new Error('Stripe is not configured. Add the Stripe secret key and price IDs.')
  }

  const checkoutSession = await stripeClient.checkout.sessions.retrieve(input.sessionId, {
    expand: ['customer', 'subscription'],
  })
  const upgradeContext = getCheckoutSessionUpgradeContext(checkoutSession)
  const sessionContext = getCheckoutSessionContext(checkoutSession)

  if (!sessionContext && !upgradeContext) {
    throw new Error('Checkout session is missing subscription details.')
  }

  const checkoutUserId = upgradeContext?.userId ?? sessionContext?.userId

  if (checkoutUserId !== input.userId) {
    throw new Error('Checkout session does not belong to the authenticated user.')
  }

  assertPaidCheckoutSession(checkoutSession)

  const alreadyProcessed = await hasProcessedCheckoutSession(input.sessionId)

  if (!alreadyProcessed) {
    if (upgradeContext) {
      await activateManagedPlanUpgradeCheckoutSession(checkoutSession)
    } else {
      await activateCheckoutSession(checkoutSession)
    }
  } else {
    await syncManagedPlanForUser(checkoutUserId)
  }
  const plan = upgradeContext?.plan ?? sessionContext?.plan

  return {
    alreadyProcessed,
    plan: plan ?? 'regen',
    ...getRewardfulConversionDetails(checkoutSession),
    status: 'active' as const,
  }
}
