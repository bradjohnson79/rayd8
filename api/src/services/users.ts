import { eq } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import { db } from '../db/client.js'
import { env } from '../env.js'
import {
  activeSessions,
  contactMessages,
  stripeCheckoutSessions,
  subscriptions,
  usagePeriods,
  usageSessions,
  userDevices,
  userSettings,
  users,
} from '../db/schema.js'
import { clerkClient } from '../lib/clerk.js'
import { dispatchNotification } from './notifications/dispatchNotification.js'
import { toAppPlan } from './player/accessPolicy.js'

export type UserRecord = InferSelectModel<typeof users>

function normalizeRole(value: unknown): UserRecord['role'] {
  return value === 'admin' ? 'admin' : 'member'
}

function getSourceOfTruthAdminEmails() {
  return new Set(
    (env.SOURCE_OF_TRUTH_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

function resolveSourceOfTruthRole(email: string, role: UserRecord['role']) {
  return getSourceOfTruthAdminEmails().has(email.toLowerCase()) ? 'admin' : role
}

function normalizePlan(value: unknown): UserRecord['plan'] {
  if (value === 'premium' || value === 'regen' || value === 'amrita') {
    return value
  }

  return 'free'
}

async function reconcileUserIdentity(nextUser: UserRecord) {
  if (!db) {
    return
  }

  await db.transaction(async (tx) => {
    const [userWithEmail] = await tx.select().from(users).where(eq(users.email, nextUser.email)).limit(1)

    if (userWithEmail && userWithEmail.id !== nextUser.id) {
      await tx
        .update(users)
        .set({
          email: `${userWithEmail.email}__relinked__${userWithEmail.id}`,
        })
        .where(eq(users.id, userWithEmail.id))

      await tx.insert(users).values({
        ...nextUser,
        createdAt: userWithEmail.createdAt,
      })

      await tx.update(subscriptions).set({ userId: nextUser.id }).where(eq(subscriptions.userId, userWithEmail.id))
      await tx.update(userSettings).set({ userId: nextUser.id }).where(eq(userSettings.userId, userWithEmail.id))
      await tx
        .update(stripeCheckoutSessions)
        .set({ userId: nextUser.id })
        .where(eq(stripeCheckoutSessions.userId, userWithEmail.id))
      await tx.update(usageSessions).set({ userId: nextUser.id }).where(eq(usageSessions.userId, userWithEmail.id))
      await tx.update(usagePeriods).set({ userId: nextUser.id }).where(eq(usagePeriods.userId, userWithEmail.id))
      await tx.update(userDevices).set({ userId: nextUser.id }).where(eq(userDevices.userId, userWithEmail.id))
      await tx.update(activeSessions).set({ userId: nextUser.id }).where(eq(activeSessions.userId, userWithEmail.id))
      await tx
        .update(contactMessages)
        .set({ userId: nextUser.id })
        .where(eq(contactMessages.userId, userWithEmail.id))

      await tx.delete(users).where(eq(users.id, userWithEmail.id))
      return
    }

    await tx
      .insert(users)
      .values(nextUser)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: nextUser.email,
          role: nextUser.role,
          plan: nextUser.plan,
        },
      })
  })
}

async function safeDispatchNotification(
  ...args: Parameters<typeof dispatchNotification>
) {
  try {
    await dispatchNotification(...args)
  } catch (error) {
    console.error('[notifications]', error)
  }
}

export async function syncUserFromClerk(userId: string) {
  if (!clerkClient) {
    return null
  }

  const clerkUser = await clerkClient.users.getUser(userId)
  const email =
    clerkUser.emailAddresses.find(
      (address) => address.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress

  if (!email) {
    throw new Error('Authenticated Clerk user does not have an email address.')
  }

  const nextUser: UserRecord = {
    id: clerkUser.id,
    email,
    role: resolveSourceOfTruthRole(email, normalizeRole(clerkUser.publicMetadata.role)),
    plan: normalizePlan(clerkUser.publicMetadata.plan),
    createdAt: new Date(),
  }

  if (!db) {
    return nextUser
  }

  const [existingUserById] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  await reconcileUserIdentity(nextUser)

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!existingUserById && user) {
    await safeDispatchNotification({
      event: 'user.created',
      payload: {
        email: user.email,
        entityId: user.id,
        userId: user.id,
      },
      userId: user.id,
    })

    await safeDispatchNotification({
      event: 'admin.new.user',
      payload: {
        email: user.email,
        entityId: user.id,
        userId: user.id,
      },
      userId: user.id,
    })
  }

  return user ?? nextUser
}

export function getUserAppPlan(plan: UserRecord['plan'] | null | undefined) {
  return toAppPlan(plan)
}
