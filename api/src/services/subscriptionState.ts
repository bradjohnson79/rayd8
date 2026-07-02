import { desc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { subscriptions } from '../db/schema.js'

export type BillingPlan = 'free' | 'regen' | 'amrita'
export type PaidBillingPlan = Exclude<BillingPlan, 'free'>

export const PAST_DUE_GRACE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000
const PLAN_RANK: Record<PaidBillingPlan, number> = {
  regen: 2,
  amrita: 3,
}

export type SubscriptionRecord = typeof subscriptions.$inferSelect

export interface SubscriptionState {
  activeSubscription: SubscriptionRecord | null
  entitlementPlan: BillingPlan
  paymentRecoveryRequired: boolean
  reason:
    | 'active'
    | 'free'
    | 'past_due_grace'
    | 'past_due_expired'
    | 'payment_unpaid'
    | 'pending_payment'
    | 'paused'
    | 'canceled'
    | 'unknown_status'
}

function isPaidPlan(plan: string): plan is PaidBillingPlan {
  return plan === 'regen' || plan === 'amrita'
}

function toPastDueStartedAt(subscription: Pick<SubscriptionRecord, 'createdAt' | 'pastDueStartedAt' | 'statusChangedAt'>) {
  return subscription.pastDueStartedAt ?? subscription.statusChangedAt ?? subscription.createdAt
}

export function hasPastDueGrace(subscription: Pick<SubscriptionRecord, 'createdAt' | 'pastDueStartedAt' | 'statusChangedAt'>, now = new Date()) {
  return now.getTime() - toPastDueStartedAt(subscription).getTime() <= PAST_DUE_GRACE_DAYS * DAY_MS
}

export function getSubscriptionEntitlementPlan(subscription: SubscriptionRecord, now = new Date()): BillingPlan {
  if (!isPaidPlan(subscription.plan)) {
    return 'free'
  }

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    if (
      subscription.plan === 'amrita' &&
      subscription.pendingDowngradePlan === 'regen' &&
      subscription.currentPeriodEnd &&
      now >= subscription.currentPeriodEnd
    ) {
      return 'regen'
    }

    return subscription.plan
  }

  if (subscription.status === 'past_due' && hasPastDueGrace(subscription, now)) {
    return subscription.plan
  }

  return 'free'
}

export function isPaidEntitlementActive(subscription: SubscriptionRecord, now = new Date()) {
  return getSubscriptionEntitlementPlan(subscription, now) !== 'free'
}

export function resolveSubscriptionStateFromRecords(records: SubscriptionRecord[], now = new Date()): SubscriptionState {
  const paidRecords = records.filter((record) => isPaidPlan(record.plan))
  const entitledRecords = paidRecords.filter((record) => isPaidEntitlementActive(record, now))
  const activeSubscription = entitledRecords.sort((left, right) => {
    const rankDelta =
      PLAN_RANK[getSubscriptionEntitlementPlan(right, now) as PaidBillingPlan] -
      PLAN_RANK[getSubscriptionEntitlementPlan(left, now) as PaidBillingPlan]

    if (rankDelta !== 0) {
      return rankDelta
    }

    return (right.currentPeriodEnd?.getTime() ?? 0) - (left.currentPeriodEnd?.getTime() ?? 0)
  })[0] ?? null

  if (activeSubscription) {
    return {
      activeSubscription,
      entitlementPlan: getSubscriptionEntitlementPlan(activeSubscription, now),
      paymentRecoveryRequired: activeSubscription.status === 'past_due',
      reason: activeSubscription.status === 'past_due' ? 'past_due_grace' : 'active',
    }
  }

  const paymentProblem = paidRecords.find((record) => record.status === 'unpaid')

  if (paymentProblem) {
    return {
      activeSubscription: paymentProblem,
      entitlementPlan: 'free',
      paymentRecoveryRequired: true,
      reason: 'payment_unpaid',
    }
  }

  const expiredPastDue = paidRecords.find((record) => record.status === 'past_due')

  if (expiredPastDue) {
    return {
      activeSubscription: expiredPastDue,
      entitlementPlan: 'free',
      paymentRecoveryRequired: true,
      reason: 'past_due_expired',
    }
  }

  const pendingPayment = paidRecords.find((record) => record.status === 'incomplete')

  if (pendingPayment) {
    return {
      activeSubscription: pendingPayment,
      entitlementPlan: 'free',
      paymentRecoveryRequired: true,
      reason: 'pending_payment',
    }
  }

  const paused = paidRecords.find((record) => record.status === 'paused')

  if (paused) {
    return {
      activeSubscription: paused,
      entitlementPlan: 'free',
      paymentRecoveryRequired: true,
      reason: 'paused',
    }
  }

  const canceled = paidRecords.find((record) => record.status === 'canceled' || record.status === 'incomplete_expired')

  if (canceled) {
    return {
      activeSubscription: canceled,
      entitlementPlan: 'free',
      paymentRecoveryRequired: false,
      reason: 'canceled',
    }
  }

  return {
    activeSubscription: null,
    entitlementPlan: 'free',
    paymentRecoveryRequired: false,
    reason: 'free',
  }
}

export async function getSubscriptionStateForUser(userId: string, now = new Date()) {
  if (!db) {
    return resolveSubscriptionStateFromRecords([], now)
  }

  const records = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.currentPeriodEnd), desc(subscriptions.createdAt))

  return resolveSubscriptionStateFromRecords(records, now)
}
