import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { archivedAdminOrders, subscriptions, users } from '../../db/schema.js'

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
