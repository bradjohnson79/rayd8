import { desc, eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../../db/client.js'
import { archivedAdminOrders, subscriptions, users } from '../../db/schema.js'
import { env } from '../../env.js'

const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as never,
    })
  : null

export interface AdminStripeRecord {
  clerk_user_id: string
  email: string
  stripe_customer_id: string
  stripe_subscription_id: string
  status: string
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  plan_type: 'single' | 'multi'
  created_at: string
  current_period_end: string | null
}

export type AdminSubscriberSource =
  | 'amrita'
  | 'free_trial'
  | 'legacy_import'
  | 'premium'
  | 'regen'

export interface AdminSubscriberRecord {
  clerk_user_id: string
  email: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  plan_type: 'single' | 'multi' | null
  created_at: string
  current_period_end: string | null
  subscriber_source: AdminSubscriberSource
}

export interface AdminSubscriberSummary {
  amritaSubscribers: number
  freeSubscribers: number
  paidSubscribers: number
  regenSubscribers: number
  totalSubscribers: number
}

export interface AdminSubscribersResponse {
  subscribers: AdminSubscriberRecord[]
  summary: AdminSubscriberSummary
}

export interface AdminStripeRevenueSummary {
  all_time_cents: number
  calculated_at: string
  configured: boolean
  currency: string
  last_24_hours_cents: number
  last_30_days_cents: number
  last_7_days_cents: number
  paid_invoice_count: number
}

async function getArchivedOrderIds() {
  if (!db) {
    return new Set<string>()
  }

  const rows = await db
    .select({ stripeSubscriptionId: archivedAdminOrders.stripeSubscriptionId })
    .from(archivedAdminOrders)
  return new Set(rows.map((row) => row.stripeSubscriptionId))
}

async function readStripeRecords({
  includeArchived = false,
}: {
  includeArchived?: boolean
} = {}) {
  if (!db) {
    return []
  }

  const records = await db
    .select({
      clerk_user_id: users.id,
      email: users.email,
      stripe_customer_id: subscriptions.stripeCustomerId,
      stripe_subscription_id: subscriptions.stripeSubscriptionId,
      status: subscriptions.status,
      plan: subscriptions.plan,
      plan_type: subscriptions.planType,
      created_at: subscriptions.createdAt,
      current_period_end: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .innerJoin(users, eq(subscriptions.userId, users.id))
    .orderBy(desc(subscriptions.createdAt))

  const archivedOrderIds = includeArchived ? new Set<string>() : await getArchivedOrderIds()

  return records
    .filter((record) => !archivedOrderIds.has(record.stripe_subscription_id))
    .map((record) => ({
      ...record,
      created_at: record.created_at.toISOString(),
      current_period_end: record.current_period_end
        ? record.current_period_end.toISOString()
        : null,
    })) satisfies AdminStripeRecord[]
}

export async function getAdminOrders() {
  return readStripeRecords()
}

function getSubscriberSource(plan: AdminSubscriberRecord['plan']): AdminSubscriberSource {
  if (plan === 'free') {
    return 'free_trial'
  }

  return plan
}

export async function getAdminSubscribers() {
  if (!db) {
    return {
      subscribers: [],
      summary: {
        amritaSubscribers: 0,
        freeSubscribers: 0,
        paidSubscribers: 0,
        regenSubscribers: 0,
        totalSubscribers: 0,
      },
    } satisfies AdminSubscribersResponse
  }

  const [allUsers, allSubscriptions] = await Promise.all([
    db.select().from(users),
    db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)),
  ])
  const subscriberSubscriptionStatuses = new Set(['active', 'canceled', 'past_due'])
  const latestSubscriptionByUser = new Map<string, (typeof allSubscriptions)[number]>()

  for (const subscription of allSubscriptions) {
    if (!subscriberSubscriptionStatuses.has(subscription.status)) {
      continue
    }

    if (!latestSubscriptionByUser.has(subscription.userId)) {
      latestSubscriptionByUser.set(subscription.userId, subscription)
    }
  }

  const subscribers = allUsers
    .map((user) => {
      const subscription = latestSubscriptionByUser.get(user.id)
      const plan = subscription?.plan ?? user.plan

      return {
        clerk_user_id: user.id,
        email: user.email,
        stripe_customer_id: subscription?.stripeCustomerId ?? null,
        stripe_subscription_id: subscription?.stripeSubscriptionId ?? null,
        status: subscription?.status ?? (plan === 'free' ? 'free' : 'no_subscription'),
        plan,
        plan_type: subscription?.planType ?? null,
        created_at: user.createdAt.toISOString(),
        current_period_end: subscription?.currentPeriodEnd
          ? subscription.currentPeriodEnd.toISOString()
          : null,
        subscriber_source: getSubscriberSource(plan),
      } satisfies AdminSubscriberRecord
    })
    .sort((left, right) => right.created_at.localeCompare(left.created_at))

  return {
    subscribers,
    summary: {
      amritaSubscribers: allUsers.filter((user) => user.plan === 'amrita').length,
      freeSubscribers: allUsers.filter((user) => user.plan === 'free').length,
      paidSubscribers: subscribers.filter((record) => record.stripe_subscription_id !== null).length,
      regenSubscribers: allUsers.filter((user) => user.plan === 'regen').length,
      totalSubscribers: allUsers.length,
    },
  } satisfies AdminSubscribersResponse
}

export async function getAdminRevenueSummary(): Promise<AdminStripeRevenueSummary> {
  const calculatedAt = new Date()

  if (!stripeClient) {
    return {
      all_time_cents: 0,
      calculated_at: calculatedAt.toISOString(),
      configured: false,
      currency: 'usd',
      last_24_hours_cents: 0,
      last_30_days_cents: 0,
      last_7_days_cents: 0,
      paid_invoice_count: 0,
    }
  }

  const now = calculatedAt.getTime()
  const last24Hours = now - 24 * 60 * 60 * 1000
  const last7Days = now - 7 * 24 * 60 * 60 * 1000
  const last30Days = now - 30 * 24 * 60 * 60 * 1000
  let allTimeCents = 0
  let last24HoursCents = 0
  let last7DaysCents = 0
  let last30DaysCents = 0
  let currency = 'usd'
  let paidInvoiceCount = 0

  for await (const invoice of stripeClient.invoices.list({ limit: 100, status: 'paid' })) {
    const amountPaid = invoice.amount_paid ?? 0

    if (amountPaid <= 0) {
      continue
    }

    const createdAt = invoice.created * 1000
    allTimeCents += amountPaid
    paidInvoiceCount += 1
    currency = invoice.currency ?? currency

    if (createdAt >= last30Days) {
      last30DaysCents += amountPaid
    }

    if (createdAt >= last7Days) {
      last7DaysCents += amountPaid
    }

    if (createdAt >= last24Hours) {
      last24HoursCents += amountPaid
    }
  }

  return {
    all_time_cents: allTimeCents,
    calculated_at: calculatedAt.toISOString(),
    configured: true,
    currency,
    last_24_hours_cents: last24HoursCents,
    last_30_days_cents: last30DaysCents,
    last_7_days_cents: last7DaysCents,
    paid_invoice_count: paidInvoiceCount,
  }
}

export async function archiveAdminOrders(input: {
  archivedBy?: string
  stripeSubscriptionIds: string[]
}) {
  const stripeSubscriptionIds = Array.from(
    new Set(input.stripeSubscriptionIds.map((id) => id.trim()).filter(Boolean)),
  )

  if (!db || stripeSubscriptionIds.length === 0) {
    return stripeSubscriptionIds
  }

  await db
    .insert(archivedAdminOrders)
    .values(
      stripeSubscriptionIds.map((stripeSubscriptionId) => ({
        archivedBy: input.archivedBy,
        stripeSubscriptionId,
      })),
    )
    .onConflictDoNothing()

  return stripeSubscriptionIds
}
