import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { subscriptions, users } from '../db/schema.js'

export interface BillingConflictReviewStatus {
  reasons: string[]
  reviewRequired: boolean
}

/** Live billing rows. Abandoned `incomplete` checkouts are not overlaps. */
export const OVERLAPPING_CHECKOUT_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'] as const

export function subscriptionCountsAsCheckoutOverlap(status: string) {
  return (OVERLAPPING_CHECKOUT_STATUSES as readonly string[]).includes(status)
}

export function billingReviewFromCounts(input: {
  billingConflictFlag: boolean
  distinctCustomerCount: number
  overlappingSubscriptionCount: number
}): BillingConflictReviewStatus {
  const reasons: string[] = []

  if (input.billingConflictFlag) {
    reasons.push('billing_conflict_review_required_flag')
  }

  if (input.distinctCustomerCount > 1) {
    reasons.push('multiple_stripe_customers_for_user')
  }

  if (input.overlappingSubscriptionCount > 1) {
    reasons.push('overlapping_manageable_subscriptions')
  }

  return {
    reasons,
    reviewRequired: reasons.length > 0,
  }
}

export async function getBillingConflictReviewStatus(userId: string): Promise<BillingConflictReviewStatus> {
  if (!db) {
    return { reasons: [], reviewRequired: false }
  }

  const [user] = await db
    .select({ billingConflictReviewRequired: users.billingConflictReviewRequired })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  const [customerConflict] = await db
    .select({ count: sql<number>`count(DISTINCT ${subscriptions.stripeCustomerId})::int` })
    .from(subscriptions)
    .where(sql`${subscriptions.userId} = ${userId} AND ${subscriptions.stripeCustomerId} IS NOT NULL`)
  const overlappingStatuses = sql.join(
    OVERLAPPING_CHECKOUT_STATUSES.map((status) => sql`${status}`),
    sql`, `,
  )
  const [subscriptionConflict] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(sql`
      ${subscriptions.userId} = ${userId}
      AND ${subscriptions.plan} IN ('regen', 'amrita')
      AND ${subscriptions.status} IN (${overlappingStatuses})
    `)

  return billingReviewFromCounts({
    billingConflictFlag: Boolean(user?.billingConflictReviewRequired),
    distinctCustomerCount: customerConflict?.count ?? 0,
    overlappingSubscriptionCount: subscriptionConflict?.count ?? 0,
  })
}
