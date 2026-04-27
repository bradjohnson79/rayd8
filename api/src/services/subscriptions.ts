import { and, eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../db/client.js'
import { env } from '../env.js'
import { stripeCheckoutSessions, stripeEvents, subscriptions, users } from '../db/schema.js'
import { clerkClient } from '../lib/clerk.js'

const stripeClient = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null

type ManagedPlan = 'premium' | 'regen'
type ManagedPlanType = 'single' | 'multi'
type PersistedPlan = 'free' | 'premium' | 'regen' | 'amrita'

function getPriceIdForPlan(plan: ManagedPlan) {
  return plan === 'premium' ? env.STRIPE_PREMIUM_PRICE_ID : env.STRIPE_REGEN_PRICE_ID
}

function planFromPriceId(priceId?: string | null) {
  if (!priceId) {
    return null
  }

  if (priceId === env.STRIPE_PREMIUM_PRICE_ID) {
    return 'premium'
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
  const plan = (metadata.plan as ManagedPlan | 'amrita' | undefined) ?? 'premium'
  const planType = normalizePlanType(metadata.planType)

  if (!userId || !session.subscription || !session.customer) {
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

  await upsertSubscriptionRecord({
    userId: sessionContext.userId,
    customerId: sessionContext.customerId,
    stripeSubscriptionId: sessionContext.stripeSubscriptionId,
    status: 'active',
    plan: sessionContext.plan,
    planType: sessionContext.planType,
    currentPeriodStart: fromUnixTimestamp(
      subscriptionDetails?.items.data[0]?.current_period_start,
    ),
    currentPeriodEnd: fromUnixTimestamp(subscriptionDetails?.items.data[0]?.current_period_end),
  })
  await markCheckoutSessionProcessed(session.id, sessionContext.userId)
  await updateClerkPlan(sessionContext.userId, sessionContext.plan)

  return {
    plan: sessionContext.plan,
    userId: sessionContext.userId,
  }
}

async function handleCheckoutCompleted(event: Stripe.CheckoutSessionCompletedEvent) {
  const session = event.data.object
  await activateCheckoutSession(session)
}

async function handleSubscriptionUpdated(event: Stripe.CustomerSubscriptionUpdatedEvent) {
  const subscription = event.data.object
  const existingSubscription = await findSubscriptionContext(subscription.id)
  const userId = subscription.metadata.userId ?? existingSubscription?.userId

  if (!userId || !subscription.customer) {
    return
  }

  const plan =
    (subscription.metadata.plan as 'premium' | 'regen' | 'amrita' | undefined) ??
    planFromPriceId(subscription.items.data[0]?.price.id) ??
    existingSubscription?.plan ??
    'free'
  const planType =
    normalizePlanType(subscription.metadata.planType) ??
    existingSubscription?.planType ??
    'single'

  await upsertSubscriptionRecord({
    userId,
    customerId: String(subscription.customer),
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    plan,
    planType,
    currentPeriodStart: fromUnixTimestamp(subscription.items.data[0]?.current_period_start),
    currentPeriodEnd: fromUnixTimestamp(subscription.items.data[0]?.current_period_end),
  })
  await updateClerkPlan(userId, plan)
}

async function handleSubscriptionDeleted(event: Stripe.CustomerSubscriptionDeletedEvent) {
  const subscription = event.data.object
  const existingSubscription = await findSubscriptionContext(subscription.id)

  if (!db || !existingSubscription) {
    return
  }

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      plan: 'free',
      currentPeriodStart: fromUnixTimestamp(subscription.items.data[0]?.current_period_start),
      currentPeriodEnd: fromUnixTimestamp(subscription.items.data[0]?.current_period_end),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id))

  await db
    .update(users)
    .set({ plan: 'free' })
    .where(eq(users.id, existingSubscription.userId))

  await updateClerkPlan(existingSubscription.userId, 'free')
}

export async function processStripeEvent(event: Stripe.Event) {
  if (await hasProcessedEvent(event.id)) {
    return { duplicate: true }
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event as Stripe.CheckoutSessionCompletedEvent)
      break
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event as Stripe.CustomerSubscriptionUpdatedEvent)
      break
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event as Stripe.CustomerSubscriptionDeletedEvent)
      break
    default:
      break
  }

  await markEventProcessed(event.id, event.type)

  return { duplicate: false }
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
