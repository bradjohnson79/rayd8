import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { activeSessions, subscriptions, usageSessions } from '../../db/schema.js'
import type { AppPlan, Experience } from './accessPolicy.js'
import { toEffectiveMinutes } from './accessPolicy.js'
import {
  addTrackedUsageSeconds,
  getUsagePeriodSummary,
  MAX_HEARTBEAT_SECONDS,
} from './usagePeriods.js'

function toElapsedSeconds(startedAt: Date, endedAt: Date) {
  return Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000))
}

function toTrackedHeartbeatSeconds(lastHeartbeat: Date, nextHeartbeat: Date) {
  return Math.min(MAX_HEARTBEAT_SECONDS, toElapsedSeconds(lastHeartbeat, nextHeartbeat))
}

function getUtcMonthWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  return { end, start }
}

export async function getUsageWindowForUser(userId: string) {
  const fallbackWindow = getUtcMonthWindow(new Date())

  if (!db) {
    return {
      ...fallbackWindow,
      source: 'calendar' as const,
    }
  }

  const [activeSubscription] = await db
    .select({
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      currentPeriodStart: subscriptions.currentPeriodStart,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.currentPeriodEnd), desc(subscriptions.createdAt))
    .limit(1)

  if (
    activeSubscription?.status === 'active' &&
    activeSubscription.currentPeriodStart &&
    activeSubscription.currentPeriodEnd
  ) {
    return {
      end: activeSubscription.currentPeriodEnd,
      source: 'subscription' as const,
      start: activeSubscription.currentPeriodStart,
    }
  }

  return {
    ...fallbackWindow,
    source: 'calendar' as const,
  }
}

export async function getExperienceMinutesUsed(input: {
  experience: Experience
  userId: string
}) {
  return (await getExperienceSecondsUsed(input)) / 60
}

export async function getExperienceSecondsUsed(input: {
  experience: Experience
  userId: string
}) {
  if (!db) {
    return 0
  }

  const window = await getUsageWindowForUser(input.userId)

  const records = await db
    .select({
      endedAt: usageSessions.endedAt,
      lastHeartbeat: usageSessions.lastHeartbeat,
      minutesWatched: usageSessions.minutesWatched,
      secondsWatched: usageSessions.secondsWatched,
      startedAt: usageSessions.startedAt,
    })
    .from(usageSessions)
    .where(
      and(
        eq(usageSessions.userId, input.userId),
        eq(usageSessions.experience, input.experience),
        gte(usageSessions.startedAt, window.start),
        lt(usageSessions.startedAt, window.end),
      ),
    )

  return records.reduce((total, record) => total + Math.floor(toEffectiveMinutes(record) * 60), 0)
}

export async function startUsageSession(input: {
  experience: Experience
  plan: AppPlan
  sessionId: string
  userId: string
}) {
  if (!db) {
    return {
      experience: input.experience,
      id: input.sessionId,
      minutesWatched: 0,
      secondsWatched: 0,
    }
  }

  const now = new Date()

  await getUsagePeriodSummary({
    plan: input.plan,
    userId: input.userId,
  })

  await db.insert(usageSessions).values({
    experience: input.experience,
    id: input.sessionId,
    lastHeartbeat: now,
    secondsWatched: 0,
    startedAt: now,
    userId: input.userId,
  })

  await db.insert(activeSessions).values({
    deviceId: input.sessionId,
    id: input.sessionId,
    lastHeartbeat: now,
    startedAt: now,
    userId: input.userId,
  })

  return {
    experience: input.experience,
    id: input.sessionId,
    minutesWatched: 0,
    secondsWatched: 0,
  }
}

export async function heartbeatUsageSession(input: {
  plan: AppPlan
  sessionId: string
  trackUsage?: boolean
  userId: string
}) {
  if (!db) {
    return null
  }

  const [existingSession] = await db
    .select()
    .from(usageSessions)
    .where(and(eq(usageSessions.id, input.sessionId), eq(usageSessions.userId, input.userId)))
    .limit(1)

  if (!existingSession) {
    return null
  }

  const now = new Date()
  const trackedSeconds = toTrackedHeartbeatSeconds(existingSession.lastHeartbeat, now)
  const appliedTrackedSeconds = input.trackUsage === false ? 0 : trackedSeconds
  const secondsWatched = existingSession.secondsWatched + appliedTrackedSeconds
  const minutesWatched = Math.floor(secondsWatched / 60)

  await db
    .update(usageSessions)
    .set({
      lastHeartbeat: now,
      minutesWatched,
      secondsWatched,
    })
    .where(eq(usageSessions.id, input.sessionId))

  await db
    .update(activeSessions)
    .set({ lastHeartbeat: now })
    .where(and(eq(activeSessions.id, input.sessionId), eq(activeSessions.userId, input.userId)))

  await addTrackedUsageSeconds({
    experience: existingSession.experience,
    plan: input.plan,
    seconds: appliedTrackedSeconds,
    userId: input.userId,
  })

  return {
    experience: existingSession.experience,
    id: existingSession.id,
    minutesWatched,
    secondsWatched,
  }
}

export async function endUsageSession(input: {
  plan: AppPlan
  sessionId: string
  trackUsage?: boolean
  userId: string
}) {
  if (!db) {
    return null
  }

  const [existingSession] = await db
    .select()
    .from(usageSessions)
    .where(and(eq(usageSessions.id, input.sessionId), eq(usageSessions.userId, input.userId)))
    .limit(1)

  if (!existingSession) {
    return null
  }

  const endedAt = new Date()
  const trackedSeconds = toTrackedHeartbeatSeconds(existingSession.lastHeartbeat, endedAt)
  const appliedTrackedSeconds = input.trackUsage === false ? 0 : trackedSeconds
  const secondsWatched = existingSession.secondsWatched + appliedTrackedSeconds
  const minutesWatched = Math.floor(secondsWatched / 60)

  await db
    .update(usageSessions)
    .set({
      endedAt,
      lastHeartbeat: endedAt,
      minutesWatched,
      secondsWatched,
    })
    .where(eq(usageSessions.id, input.sessionId))

  await addTrackedUsageSeconds({
    experience: existingSession.experience,
    plan: input.plan,
    seconds: appliedTrackedSeconds,
    userId: input.userId,
  })

  await db
    .delete(activeSessions)
    .where(and(eq(activeSessions.id, input.sessionId), eq(activeSessions.userId, input.userId)))

  return {
    endedAt,
    experience: existingSession.experience,
    id: existingSession.id,
    minutesWatched,
    secondsWatched,
  }
}
