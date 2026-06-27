import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'
import type { AppPlan } from './accessPolicy.js'

const TRIAL_HOURS_LIMIT = 35
const TRIAL_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
const TRIAL_NOTIFICATION_CHECKPOINTS = [21, 14, 7, 3, 1] as const

export type TrialBlockReason = 'HOURS_EXCEEDED' | 'TRIAL_EXPIRED'
export type TrialNotificationLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface TrialNotificationPayload {
  level: TrialNotificationLevel
  message: string
  type: 'WARNING'
}

export interface TrialStatusPayload {
  allowed: boolean
  days_remaining?: number
  hours_remaining?: number
  notification: TrialNotificationPayload | null
  plan: 'amrita' | 'free_trial' | 'premium' | 'regen'
  reason: TrialBlockReason | null
  trial_ends_at?: Date | null
  trial_hours_used?: number
}

type TrialUserRow = Pick<
  typeof users.$inferSelect,
  'id' | 'plan' | 'role' | 'trialEndsAt' | 'trialHoursUsed' | 'trialNotificationsSent' | 'trialStartedAt'
>

export function normalizeTrialNotificationsSent(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function roundHours(value: number) {
  return Math.max(0, Math.round(value * 10) / 10)
}

function toDaysRemaining(trialEndsAt: Date, now: Date) {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS))
}

function getNotificationLevel(daysRemaining: number): TrialNotificationLevel {
  if (daysRemaining <= 1) {
    return 'CRITICAL'
  }

  if (daysRemaining <= 7) {
    return 'HIGH'
  }

  if (daysRemaining <= 14) {
    return 'MEDIUM'
  }

  return 'LOW'
}

export function getTrialNotification(daysRemaining: number): TrialNotificationPayload | null {
  if (!TRIAL_NOTIFICATION_CHECKPOINTS.includes(daysRemaining as (typeof TRIAL_NOTIFICATION_CHECKPOINTS)[number])) {
    return null
  }

  return {
    level: getNotificationLevel(daysRemaining),
    message: `Your free trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
    type: 'WARNING',
  }
}

export function getTrialStatus(user: TrialUserRow, now = new Date()): TrialStatusPayload {
  const trialExpired = user.trialEndsAt ? now > user.trialEndsAt : true
  const hoursExceeded = user.trialHoursUsed >= TRIAL_HOURS_LIMIT

  if (user.plan !== 'free') {
    return {
      allowed: true,
      notification: null,
      plan: user.plan,
      reason: null,
      trial_ends_at: user.trialEndsAt,
      trial_hours_used: user.trialHoursUsed,
    }
  }

  if (!user.trialStartedAt || !user.trialEndsAt || trialExpired) {
    return {
      allowed: false,
      days_remaining: 0,
      hours_remaining: 0,
      notification: null,
      plan: 'free_trial',
      reason: 'TRIAL_EXPIRED',
      trial_ends_at: user.trialEndsAt,
      trial_hours_used: user.trialHoursUsed,
    }
  }

  if (hoursExceeded) {
    return {
      allowed: false,
      days_remaining: toDaysRemaining(user.trialEndsAt, now),
      hours_remaining: 0,
      notification: null,
      plan: 'free_trial',
      reason: 'HOURS_EXCEEDED',
      trial_ends_at: user.trialEndsAt,
      trial_hours_used: user.trialHoursUsed,
    }
  }

  return {
    allowed: true,
    days_remaining: toDaysRemaining(user.trialEndsAt, now),
    hours_remaining: roundHours(TRIAL_HOURS_LIMIT - user.trialHoursUsed),
    notification: null,
    plan: 'free_trial',
    reason: null,
    trial_ends_at: user.trialEndsAt,
    trial_hours_used: user.trialHoursUsed,
  }
}

export async function ensureTrialWindowForUser(userId: string) {
  if (!db) {
    return null
  }

  await db
    .update(users)
    .set({
      trialEndsAt: sql`${users.createdAt} + (${TRIAL_DAYS} * INTERVAL '1 day')`,
      trialStartedAt: sql`${users.createdAt}`,
    })
    .where(
      and(
        eq(users.id, userId),
        eq(users.plan, 'free'),
        sql`(${users.trialStartedAt} IS NULL OR ${users.trialEndsAt} IS NULL)`,
      ),
    )

  await db
    .update(users)
    .set({
      trialEndsAt: sql`${users.trialStartedAt} + (${TRIAL_DAYS} * INTERVAL '1 day')`,
    })
    .where(
      and(
        eq(users.id, userId),
        eq(users.plan, 'free'),
        sql`${users.trialStartedAt} IS NOT NULL`,
        sql`${users.trialEndsAt} > ${users.trialStartedAt} + (${TRIAL_DAYS} * INTERVAL '1 day')`,
      ),
    )

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user ?? null
}

export async function incrementTrialHours(input: {
  seconds: number
  userId: string
}) {
  if (!db) {
    return
  }

  const normalizedSeconds = Math.max(0, Math.floor(input.seconds))

  if (normalizedSeconds <= 0) {
    return
  }

  await db
    .update(users)
    .set({
      trialHoursUsed: sql`LEAST(${TRIAL_HOURS_LIMIT}, ${users.trialHoursUsed} + ${normalizedSeconds / 3600})`,
    })
    .where(and(eq(users.id, input.userId), eq(users.plan, 'free')))
}

export async function consumeTrialNotification(input: {
  daysRemaining: number
  trialNotificationsSent: string[] | null
  userId: string
}) {
  const checkpoint = String(input.daysRemaining)
  const notification = getTrialNotification(input.daysRemaining)
  const trialNotificationsSent = normalizeTrialNotificationsSent(input.trialNotificationsSent)

  if (!notification || trialNotificationsSent.includes(checkpoint) || !db) {
    return null
  }

  const updatedRows = await db
    .update(users)
    .set({
      trialNotificationsSent: sql`COALESCE(${users.trialNotificationsSent}, '[]'::jsonb) || jsonb_build_array(${checkpoint})`,
    })
    .where(
      and(
        eq(users.id, input.userId),
        sql`NOT (COALESCE(${users.trialNotificationsSent}, '[]'::jsonb) ? ${checkpoint})`,
      ),
    )
    .returning({ id: users.id })

  return updatedRows.length > 0 ? notification : null
}

export async function getTrialStatusForUser(input: {
  plan: AppPlan
  role: 'admin' | 'member'
  userId: string
}) {
  if (input.role === 'admin' && input.plan !== 'free') {
    return {
      allowed: true,
      notification: null,
      plan: input.plan,
      reason: null,
    } satisfies TrialStatusPayload
  }

  if (input.plan !== 'free') {
    return {
      allowed: true,
      notification: null,
      plan: input.plan,
      reason: null,
    } satisfies TrialStatusPayload
  }

  const user = await ensureTrialWindowForUser(input.userId)

  if (!user) {
    return {
      allowed: false,
      days_remaining: 0,
      hours_remaining: 0,
      notification: null,
      plan: 'free_trial',
      reason: 'TRIAL_EXPIRED',
    } satisfies TrialStatusPayload
  }

  const status = getTrialStatus(user)

  if (!status.allowed || typeof status.days_remaining !== 'number') {
    return status
  }

  return {
    ...status,
    notification: await consumeTrialNotification({
      daysRemaining: status.days_remaining,
      trialNotificationsSent: user.trialNotificationsSent,
      userId: input.userId,
    }).catch((error) => {
      console.error('[trial-notification]', error)
      return null
    }),
  }
}
