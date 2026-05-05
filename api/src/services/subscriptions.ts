import { and, desc, eq, inArray } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../db/client.js'
import { env } from '../env.js'
import {
  affiliateCommissions,
  stripeCheckoutSessions,
  stripeEvents,
  subscriptionCancellationFeedback,
  subscriptions,
  users,
} from '../db/schema.js'
import { clerkClient } from '../lib/clerk.js'
import { dispatchNotification } from './notifications/dispatchNotification.js'
import { getAffiliateAttributionForUser } from './referrals.js'
import { recordAffiliateTrackingEvent } from './affiliates/tracking.js'
import { recordPromoCodeRedemption } from './admin/promoCodes.js'

const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as never,
    })
  : null

type ManagedPlan = 'regen'
type ManagedPlanType = 'single' | 'multi'
type PersistedPlan = 'free' | 'premium' | 'regen' | 'amrita'
export type CancellationReason =
  | 'too_expensive'
  | 'not_using_enough'
  | 'technical_issues'
  | 'didnt_see_results'
  | 'found_alternative'
  | 'other'

function getPriceIdForPlan(plan: ManagedPlan) {
  return plan === 'regen' ? env.STRIPE_REGEN_PRICE_ID : null
}

function parseManagedPlan(value: unknown): ManagedPlan | null {
  return value === 'regen' ? value : null
}

function planFromPriceId(priceId?: string | null) {
  if (!priceId) {
    return null
  }

  if (priceId === env.STRIPE_REGEN_PRICE_ID) {
    return 'regen'
  }

  return null
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

  const insertedRows = await db
    .insert(affiliateCommissions)
    .values({
      affiliateUserId: user.referredByUserId,
      amountUsd: 600,
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

  return { created, reason: created ? ('inserted' as const) : ('duplicate' as const) }
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

  const session = await stripeClient.checkout.sessions.create({
    mode: 'subscription',
    allow_promotion_codes: true,
    customer_email: input.email,
    success_url: `${env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/subscription?plan=regen&canceled=true`,
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

  return Boolean(eventRecord)
}

async function markEventProcessed(stripeEventId: string, type: string) {
  if (!db) {
    return
  }

  await db.insert(stripeEvents).values({ stripeEventId, type }).onConflictDoNothing()
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
  userId: string
}) {
  if (!db) {
    return
  }

  await db
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
      },
    })

  await db
    .update(users)
    .set({ plan: input.plan })
    .where(eq(users.id, input.userId))
}

async function updateClerkPlan(userId: string, plan: PersistedPlan) {
  if (!clerkClient) {
    return
  }

  const clerkUser = await clerkClient.users.getUser(userId)

  await clerkClient.users.updateUser(userId, {
    publicMetadata: {
      ...(clerkUser.publicMetadata ?? {}),
      plan,
    },
  })
}

async function findSubscriptionContext(stripeSubscriptionId: string) {
  if (!db) {
    return null
  }

  const [subscriptionRecord] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1)

  return subscriptionRecord ?? null
}

async function findManageableSubscriptionForUser(userId: string) {
  if (!db) {
    return null
  }

  const [subscriptionRecord] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.userId, userId),
        inArray(subscriptions.status, ['active', 'trialing', 'past_due', 'unpaid']),
      ),
    )
    .orderBy(desc(subscriptions.currentPeriodEnd), desc(subscriptions.createdAt))
    .limit(1)

  return subscriptionRecord ?? null
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

export async function upsertUserSubscription(input: {
  cancelAtPeriodEnd?: boolean
  clerkUserId: string
  currentPeriodEnd?: Date | null
  currentPeriodStart?: Date | null
  plan: PersistedPlan
  planType?: ManagedPlanType
  status: string
  stripeCustomerId: string
  stripeSubscriptionId: string
}) {
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
  })

  await updateClerkPlan(input.clerkUserId, input.plan)
}

export async function updateSubscriptionStatus(input: {
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: Date | null
  currentPeriodStart?: Date | null
  status: string
  stripeSubscriptionId: string
}) {
  const existingSubscription = await findSubscriptionContext(input.stripeSubscriptionId)

  if (!db || !existingSubscription) {
    return
  }

  const nextPlan = input.status === 'canceled' ? 'free' : existingSubscription.plan

  await db
    .update(subscriptions)
    .set({
      status: input.status,
      plan: nextPlan,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      currentPeriodStart: input.currentPeriodStart ?? existingSubscription.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd ?? existingSubscription.currentPeriodEnd,
    })
    .where(eq(subscriptions.stripeSubscriptionId, input.stripeSubscriptionId))

  await db
    .update(users)
    .set({ plan: nextPlan })
    .where(eq(users.id, existingSubscription.userId))

  await updateClerkPlan(existingSubscription.userId, nextPlan)
}

export async function markSubscriptionPastDue(stripeSubscriptionId: string) {
  await updateSubscriptionStatus({
    status: 'past_due',
    stripeSubscriptionId,
  })
}

async function activateCheckoutSession(session: Stripe.Checkout.Session) {
  const sessionContext = getCheckoutSessionContext(session)

  if (!sessionContext) {
    return null
  }

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
    status: 'active',
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
  await activateCheckoutSession(session)
}

async function syncSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const existingSubscription = await findSubscriptionContext(subscription.id)
  const userId = subscription.metadata.userId ?? existingSubscription?.userId

  if (!userId || !subscription.customer) {
    return
  }

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
      stripeCustomerId: String(subscription.customer),
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

  await upsertUserSubscription({
    clerkUserId: userId,
    stripeCustomerId: String(subscription.customer),
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    plan,
    planType,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodStart: fromUnixTimestamp(subscription.items.data[0]?.current_period_start),
    currentPeriodEnd: fromUnixTimestamp(subscription.items.data[0]?.current_period_end),
  })
}

async function handleSubscriptionCreated(event: Stripe.CustomerSubscriptionCreatedEvent) {
  const subscription = event.data.object
  await syncSubscriptionFromStripe(subscription)

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
  await syncSubscriptionFromStripe(event.data.object)
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

  invoice = await stripeClient.invoices.retrieve(invoice.id, {
    expand: [
      'discounts',
      'discounts.coupon',
      'discounts.promotion_code',
    ],
  }).catch(() => invoice)
  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId, {
    expand: [
      'discounts',
      'discounts.coupon',
      'discounts.promotion_code',
    ],
  }).catch(() => stripeClient.subscriptions.retrieve(subscriptionId))
  await syncSubscriptionFromStripe(subscription)
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

  await createAffiliateCommissionForSubscriptionCreate({
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
      userEmail: userContext?.email ?? null,
    },
    userId,
  })
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

  await markSubscriptionPastDue(subscriptionId)
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
  if (await hasProcessedEvent(event.id)) {
    return { duplicate: true }
  }

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

  await markEventProcessed(event.id, event.type)

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
    throw new Error('No active REGEN subscription was found for this account.')
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
  const subscription = await findManageableSubscriptionForUser(userId)

  if (!subscription) {
    return {
      subscription: null,
    }
  }

  return {
    subscription: {
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      currentPeriodStart: subscription.currentPeriodStart,
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
    throw new Error('No active REGEN subscription was found for this account.')
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
    expand: ['subscription'],
  })
  const sessionContext = getCheckoutSessionContext(checkoutSession)

  if (!sessionContext) {
    throw new Error('Checkout session is missing subscription details.')
  }

  if (sessionContext.userId !== input.userId) {
    throw new Error('Checkout session does not belong to the authenticated user.')
  }

  if (checkoutSession.status !== 'complete') {
    throw new Error('Checkout session is not complete yet.')
  }

  const alreadyProcessed = await hasProcessedCheckoutSession(input.sessionId)

  if (!alreadyProcessed) {
    await activateCheckoutSession(checkoutSession)
  } else {
    await updateClerkPlan(sessionContext.userId, sessionContext.plan)
  }

  return {
    alreadyProcessed,
    plan: sessionContext.plan,
    status: 'active' as const,
  }
}
