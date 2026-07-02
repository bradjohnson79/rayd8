import { eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { subscriptions, users } from '../db/schema.js'

export interface BillingConflictReviewStatus {
  reasons: string[]
  reviewRequired: boolean
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
  const [subscriptionConflict] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subscriptions)
    .where(sql`
      ${subscriptions.userId} = ${userId}
      AND ${subscriptions.plan} IN ('regen', 'amrita')
      AND ${subscriptions.status} IN ('active', 'trialing', 'past_due', 'unpaid', 'incomplete')
    `)
  const reasons: string[] = []

  if (user?.billingConflictReviewRequired) {
    reasons.push('billing_conflict_review_required_flag')
  }

  if ((customerConflict?.count ?? 0) > 1) {
    reasons.push('multiple_stripe_customers_for_user')
  }

  if ((subscriptionConflict?.count ?? 0) > 1) {
    reasons.push('overlapping_manageable_subscriptions')
  }

  return {
    reasons,
    reviewRequired: reasons.length > 0,
  }
}
