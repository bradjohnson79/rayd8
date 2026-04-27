import { db } from '../../db/client.js'
import {
  activeSessions,
  subscriptions,
  usageSessions,
  userDevices,
  users,
} from '../../db/schema.js'

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
