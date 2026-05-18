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

export async function getAdminSubscribers() {
  const records = await readStripeRecords({ includeArchived: true })

  return records.filter((record) =>
    ['active', 'canceled', 'past_due'].includes(record.status),
  )
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
