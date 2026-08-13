import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  activeSessions,
  subscriptions,
  usageSessions,
  userDevices,
  users,
} from '../../db/schema.js'
import {
  stripeClient,
  syncManagedPlanForUser,
  syncSubscriptionFromStripe,
} from '../subscriptions.js'

export interface AdminOverview {
  totalUsers: number
  activeSubscribers: number
  currentStreamingSessions: number
  totalMinutesWatchedToday: number
  totalMinutesWatchedPast30Days: number
  averageVideoWatchTime: number
}

function isSameUtcDay(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10)
}

export async function getAdminOverview(): Promise<AdminOverview> {
  if (!db) {
    return {
      totalUsers: 0,
      activeSubscribers: 0,
      currentStreamingSessions: 0,
      totalMinutesWatchedToday: 0,
      totalMinutesWatchedPast30Days: 0,
      averageVideoWatchTime: 0,
    }
  }

  const [allUsers, allSubscriptions, allActiveSessions, allUsageSessions] = await Promise.all([
    db.select().from(users),
    db.select().from(subscriptions),
    db.select().from(activeSessions),
    db.select().from(usageSessions),
  ])

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const heartbeatWindowMs = 5 * 60 * 1000
  const sessionsPast30Days = allUsageSessions.filter((record) => record.startedAt >= thirtyDaysAgo)
  const totalMinutesWatchedToday = allUsageSessions
    .filter((record) => isSameUtcDay(record.startedAt, now))
    .reduce((total, record) => total + record.minutesWatched, 0)
  const totalMinutesWatchedPast30Days = sessionsPast30Days.reduce(
    (total, record) => total + record.minutesWatched,
    0,
  )
  const averageVideoWatchTime = sessionsPast30Days.length
    ? Number((totalMinutesWatchedPast30Days / sessionsPast30Days.length).toFixed(1))
    : 0

  return {
    totalUsers: allUsers.length,
    activeSubscribers: allSubscriptions.filter((record) => record.status === 'active').length,
    currentStreamingSessions: allActiveSessions.filter(
      (record) => now.getTime() - record.lastHeartbeat.getTime() <= heartbeatWindowMs,
    ).length,
    totalMinutesWatchedToday,
    totalMinutesWatchedPast30Days,
    averageVideoWatchTime,
  }
}

export async function getAdminUsers() {
  if (!db) {
    return []
  }

  const [allUsers, allSubscriptions, allDevices, allActiveSessions] = await Promise.all([
    db.select().from(users),
    db.select().from(subscriptions),
    db.select().from(userDevices),
    db.select().from(activeSessions),
  ])

  return allUsers.map((user) => {
    const subscription = allSubscriptions.find((record) => record.userId === user.id)
    const devices = allDevices.filter((record) => record.userId === user.id)
    const sessions = allActiveSessions.filter((record) => record.userId === user.id)

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
      created_at: user.createdAt.toISOString(),
      subscription_status: subscription?.status ?? 'free',
      device_count: devices.length,
      active_session_count: sessions.length,
    }
  })
}

export class ResyncUserError extends Error {
  constructor(
    message: string,
    readonly code: 'USER_NOT_FOUND' | 'STRIPE_NOT_CONFIGURED',
  ) {
    super(message)
    this.name = 'ResyncUserError'
  }
}

export interface ResyncedSubscriptionSummary {
  stripeSubscriptionId: string
  status: string
  plan: string
  currentPeriodEnd: string | null
}

export interface ResyncUserResult {
  userId: string
  plan: string
  subscriptions: ResyncedSubscriptionSummary[]
}

export async function resyncUserSubscriptionsFromStripe(userId: string): Promise<ResyncUserResult> {
  if (!db) {
    throw new ResyncUserError('Database is not available.', 'USER_NOT_FOUND')
  }

  const [userRecord] = await db
    .select({ id: users.id, stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userRecord) {
    throw new ResyncUserError('User not found.', 'USER_NOT_FOUND')
  }

  if (!stripeClient) {
    throw new ResyncUserError('Stripe is not configured.', 'STRIPE_NOT_CONFIGURED')
  }

  // A user can have Stripe subscriptions before their users.stripe_customer_id
  // is backfilled. Match on the stored customer id OR on any subscription rows
  // already linked to this user so the resync can recover those customers too.
  const linkedSubscriptions = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))

  const customerIds = [
    ...new Set(
      [userRecord.stripeCustomerId, ...linkedSubscriptions.map((row) => row.stripeCustomerId)].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ]

  const syncedSubscriptionIds: string[] = []

  for (const customerId of customerIds) {
    const stripeSubscriptions = await stripeClient.subscriptions.list({
      customer: customerId,
      limit: 100,
      status: 'all',
      expand: ['data.discounts.coupon'],
    })

    for (const stripeSubscription of stripeSubscriptions.data) {
      await syncSubscriptionFromStripe(stripeSubscription, new Date())
      syncedSubscriptionIds.push(stripeSubscription.id)
    }
  }

  const plan = await syncManagedPlanForUser(userId)

  const subscriptionRows = syncedSubscriptionIds.length
    ? await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            inArray(subscriptions.stripeSubscriptionId, syncedSubscriptionIds),
          ),
        )
        .orderBy(desc(subscriptions.currentPeriodEnd))
    : []

  return {
    userId,
    plan,
    subscriptions: subscriptionRows.map((row) => ({
      stripeSubscriptionId: row.stripeSubscriptionId,
      status: row.status,
      plan: row.plan,
      currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
    })),
  }
}
