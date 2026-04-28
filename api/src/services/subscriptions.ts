import { and, desc, eq, inArray } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../db/client.js'
import { env } from '../env.js'
import {
  stripeCheckoutSessions,
  stripeEvents,
  subscriptionCancellationFeedback,
  subscriptions,
  users,
} from '../db/schema.js'
import { clerkClient } from '../lib/clerk.js'
import { dispatchNotification } from './notifications/dispatchNotification.js'

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
  userId: string
}) {
  const priceId = getPriceIdForPlan(input.plan)

  if (!stripeClient || !priceId) {
    return null
  }

  return stripeClient.checkout.sessions.create({
    mode: 'subscription',
    customer_email: input.email,
    success_url: `${env.APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/subscription?plan=regen&canceled=true`,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: input.userId,
    metadata: {
      plan: input.plan,
      planType: input.planType ?? 'single',
      userId: input.userId,
    },
    subscription_data: {
      metadata: {
        plan: input.plan,
        planType: input.planType ?? 'single',
        userId: input.userId,
      },
    },
  })
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

async function handleCheckoutCompleted(event: Stripe.CheckoutSessionCompletedEvent) {
  const session = event.data.object
  await activateCheckoutSession(session)
}

async function syncSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const existingSubscription = await findSubscriptionContext(subscription.id)
  const userId = subscription.metadata.userId ?? existingSubscription?.userId

  if (!userId || !subscription.customer) {
    return
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
  const invoice = event.data.object as Stripe.Invoice & {
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

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId)
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
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event as Stripe.InvoicePaymentFailedEvent)
      break
    default:
      break
  }

  await markEventProcessed(event.id, event.type)

  return { duplicate: false }
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
