import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { subscriptions, usagePeriods, users } from '../../db/schema.js'
import type { AppPlan, Experience } from './accessPolicy.js'
import { incrementTrialHours } from './trialStatus.js'

export const MAX_HEARTBEAT_SECONDS = 30

const HOUR_IN_SECONDS = 60 * 60
const FAR_FUTURE_PERIOD_END = new Date('9999-12-31T23:59:59.999Z')

export const PLAN_LIMITS = {
  free: {
    expansion: 33 * HOUR_IN_SECONDS,
    premium: 1 * HOUR_IN_SECONDS,
    regen: 1 * HOUR_IN_SECONDS,
  },
  regen: {
    total: 250 * HOUR_IN_SECONDS,
  },
} as const

export type UsagePeriodType = 'billing_cycle' | 'lifetime'
export type UsageBucketPlan = 'free' | 'regen'

export interface UsagePeriodSummary {
  expansionUsedSeconds: number
  periodEnd: Date | null
  periodStart: Date | null
  periodType: UsagePeriodType | null
  premiumUsedSeconds: number
  regenUsedSeconds: number
  totalUsedSeconds: number
}

function toUsageBucketPlan(plan: AppPlan): UsageBucketPlan | null {
  if (plan === 'free' || plan === 'regen') {
    return plan
  }

  return null
}

function getUtcMonthWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  return { end, start }
}

async function resolveUsagePeriod(input: { plan: UsageBucketPlan; userId: string }) {
  const fallbackWindow = getUtcMonthWindow(new Date())

  if (!db) {
    return input.plan === 'free'
      ? {
          periodEnd: FAR_FUTURE_PERIOD_END,
          periodStart: fallbackWindow.start,
          periodType: 'lifetime' as const,
        }
      : {
          periodEnd: fallbackWindow.end,
          periodStart: fallbackWindow.start,
          periodType: 'billing_cycle' as const,
        }
  }

  if (input.plan === 'free') {
    const [user] = await db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)

    return {
      periodEnd: FAR_FUTURE_PERIOD_END,
      periodStart: user?.createdAt ?? fallbackWindow.start,
      periodType: 'lifetime' as const,
    }
  }

  const [activeSubscription] = await db
    .select({
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      currentPeriodStart: subscriptions.currentPeriodStart,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, input.userId))
    .orderBy(desc(subscriptions.currentPeriodEnd), desc(subscriptions.createdAt))
    .limit(1)

  if (
    activeSubscription?.status === 'active' &&
    activeSubscription.currentPeriodStart &&
    activeSubscription.currentPeriodEnd
  ) {
    return {
      periodEnd: activeSubscription.currentPeriodEnd,
      periodStart: activeSubscription.currentPeriodStart,
      periodType: 'billing_cycle' as const,
    }
  }

  return {
    periodEnd: fallbackWindow.end,
    periodStart: fallbackWindow.start,
    periodType: 'billing_cycle' as const,
  }
}

async function getOrCreateUsagePeriod(input: { plan: UsageBucketPlan; userId: string }) {
  if (!db) {
    return null
  }

  const period = await resolveUsagePeriod(input)

  const [existingPeriod] = await db
    .select()
    .from(usagePeriods)
    .where(
      and(
        eq(usagePeriods.userId, input.userId),
        eq(usagePeriods.periodType, period.periodType),
        eq(usagePeriods.periodStart, period.periodStart),
      ),
    )
    .limit(1)

  if (existingPeriod) {
    return existingPeriod
  }

  await db.insert(usagePeriods).values({
    periodEnd: period.periodEnd,
    periodStart: period.periodStart,
    periodType: period.periodType,
    userId: input.userId,
  }).onConflictDoNothing()

  const [createdPeriod] = await db
    .select()
    .from(usagePeriods)
    .where(
      and(
        eq(usagePeriods.userId, input.userId),
        eq(usagePeriods.periodType, period.periodType),
        eq(usagePeriods.periodStart, period.periodStart),
      ),
    )
    .limit(1)

  return createdPeriod ?? null
}

function toUsagePeriodSummary(
  record:
    | {
        expansionSeconds: number
        periodEnd: Date
        periodStart: Date
        periodType: UsagePeriodType
        premiumSeconds: number
        regenSeconds: number
      }
    | null
    | undefined,
): UsagePeriodSummary {
  const expansionUsedSeconds = record?.expansionSeconds ?? 0
  const premiumUsedSeconds = record?.premiumSeconds ?? 0
  const regenUsedSeconds = record?.regenSeconds ?? 0

  return {
    expansionUsedSeconds,
    periodEnd: record?.periodEnd ?? null,
    periodStart: record?.periodStart ?? null,
    periodType: record?.periodType ?? null,
    premiumUsedSeconds,
    regenUsedSeconds,
    totalUsedSeconds: expansionUsedSeconds + premiumUsedSeconds + regenUsedSeconds,
  }
}

export async function getUsagePeriodSummary(input: { plan: AppPlan; userId: string }) {
  const bucketPlan = toUsageBucketPlan(input.plan)

  if (!bucketPlan) {
    return toUsagePeriodSummary(null)
  }

  const periodRecord = await getOrCreateUsagePeriod({
    plan: bucketPlan,
    userId: input.userId,
  })

  return toUsagePeriodSummary(periodRecord)
}

export async function addTrackedUsageSeconds(input: {
  experience: Experience
  plan: AppPlan
  seconds: number
  trackTrialHours?: boolean
  userId: string
}) {
  const bucketPlan = toUsageBucketPlan(input.plan)
  const normalizedSeconds = Math.max(0, Math.floor(input.seconds))

  if (!db || !bucketPlan || normalizedSeconds <= 0) {
    return
  }

  const periodRecord = await getOrCreateUsagePeriod({
    plan: bucketPlan,
    userId: input.userId,
  })

  if (!periodRecord) {
    return
  }

  if (input.experience === 'expansion') {
    await db
      .update(usagePeriods)
      .set({
        expansionSeconds: periodRecord.expansionSeconds + normalizedSeconds,
      })
      .where(eq(usagePeriods.id, periodRecord.id))
  } else if (input.experience === 'premium') {
    await db
      .update(usagePeriods)
      .set({
        premiumSeconds: periodRecord.premiumSeconds + normalizedSeconds,
      })
      .where(eq(usagePeriods.id, periodRecord.id))
  } else {
    await db
      .update(usagePeriods)
      .set({
        regenSeconds: periodRecord.regenSeconds + normalizedSeconds,
      })
      .where(eq(usagePeriods.id, periodRecord.id))
  }

  if (input.plan === 'free' && input.trackTrialHours !== false) {
    await incrementTrialHours({
      seconds: normalizedSeconds,
      userId: input.userId,
    })
  }
}
