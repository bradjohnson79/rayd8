import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import { db } from '../db/client.js'
import { env } from '../env.js'
import {
  activeSessions,
  affiliateCommissions,
  contactMessages,
  stripeCheckoutSessions,
  subscriptionCancellationFeedback,
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
import { ensureTrialWindowForUser } from './player/trialStatus.js'

export type UserRecord = InferSelectModel<typeof users>

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

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

function generateReferralCodeCandidate(length = 8) {
  const bytes = randomBytes(length)
  let code = ''

  for (let index = 0; index < length; index += 1) {
    code += REFERRAL_CODE_ALPHABET[bytes[index] % REFERRAL_CODE_ALPHABET.length]
  }

  return code.toUpperCase()
}

function isReferralCodeConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('users_referral_code_idx') || message.includes('referral_code')
}

async function createUniqueReferralCode() {
  if (!db) {
    return generateReferralCodeCandidate()
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const referralCode = generateReferralCodeCandidate()
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, referralCode))
      .limit(1)

    if (!existingUser) {
      return referralCode
    }
  }

  throw new Error('Unable to generate a unique referral code.')
}

async function reconcileUserIdentity(nextUser: UserRecord) {
  if (!db) {
    return
  }

  const [userWithEmail] = await db.select().from(users).where(eq(users.email, nextUser.email)).limit(1)

  if (userWithEmail && userWithEmail.id !== nextUser.id) {
    // Neon HTTP does not support transactions, so keep the relink flow explicit.
    await db
      .update(users)
      .set({
        email: `${userWithEmail.email}__relinked__${userWithEmail.id}`,
      })
      .where(eq(users.id, userWithEmail.id))

    await db.insert(users).values({
      ...nextUser,
      referralCode: userWithEmail.referralCode ?? nextUser.referralCode,
      referredByUserId: userWithEmail.referredByUserId,
      createdAt: userWithEmail.createdAt,
      trialEndsAt: userWithEmail.trialEndsAt,
      trialHoursUsed: userWithEmail.trialHoursUsed,
      trialNotificationsSent: userWithEmail.trialNotificationsSent,
      trialStartedAt: userWithEmail.trialStartedAt,
    })

    await db.update(subscriptions).set({ userId: nextUser.id }).where(eq(subscriptions.userId, userWithEmail.id))
    await db
      .update(subscriptionCancellationFeedback)
      .set({ userId: nextUser.id })
      .where(eq(subscriptionCancellationFeedback.userId, userWithEmail.id))
    await db.update(userSettings).set({ userId: nextUser.id }).where(eq(userSettings.userId, userWithEmail.id))
    await db
      .update(stripeCheckoutSessions)
      .set({ userId: nextUser.id })
      .where(eq(stripeCheckoutSessions.userId, userWithEmail.id))
    await db.update(usageSessions).set({ userId: nextUser.id }).where(eq(usageSessions.userId, userWithEmail.id))
    await db.update(usagePeriods).set({ userId: nextUser.id }).where(eq(usagePeriods.userId, userWithEmail.id))
    await db.update(userDevices).set({ userId: nextUser.id }).where(eq(userDevices.userId, userWithEmail.id))
    await db.update(activeSessions).set({ userId: nextUser.id }).where(eq(activeSessions.userId, userWithEmail.id))
    await db.update(users).set({ referredByUserId: nextUser.id }).where(eq(users.referredByUserId, userWithEmail.id))
    await db
      .update(affiliateCommissions)
      .set({ affiliateUserId: nextUser.id })
      .where(eq(affiliateCommissions.affiliateUserId, userWithEmail.id))
    await db
      .update(affiliateCommissions)
      .set({ referredUserId: nextUser.id })
      .where(eq(affiliateCommissions.referredUserId, userWithEmail.id))
    await db
      .update(contactMessages)
      .set({ userId: nextUser.id })
      .where(eq(contactMessages.userId, userWithEmail.id))

    await db.delete(users).where(eq(users.id, userWithEmail.id))
    return
  }

  await db
    .insert(users)
    .values(nextUser)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: nextUser.email,
        referralCode: nextUser.referralCode,
        referredByUserId: nextUser.referredByUserId,
        role: nextUser.role,
        plan: nextUser.plan,
      },
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

  if (!db) {
    return {
      id: clerkUser.id,
      email,
      referralCode: generateReferralCodeCandidate(),
      referredByUserId: null,
      role: resolveSourceOfTruthRole(email, normalizeRole(clerkUser.publicMetadata.role)),
      plan: normalizePlan(clerkUser.publicMetadata.plan),
      trialEndsAt: null,
      trialHoursUsed: 0,
      trialNotificationsSent: [],
      trialStartedAt: null,
      createdAt: new Date(),
    }
  }

  const [existingUserById] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  let nextUser: UserRecord = {
    id: clerkUser.id,
    email,
    referralCode: existingUserById?.referralCode ?? (await createUniqueReferralCode()),
    referredByUserId: existingUserById?.referredByUserId ?? null,
    role: resolveSourceOfTruthRole(email, normalizeRole(clerkUser.publicMetadata.role)),
    plan: normalizePlan(clerkUser.publicMetadata.plan),
    trialEndsAt: existingUserById?.trialEndsAt ?? null,
    trialHoursUsed: existingUserById?.trialHoursUsed ?? 0,
    trialNotificationsSent: existingUserById?.trialNotificationsSent ?? [],
    trialStartedAt: existingUserById?.trialStartedAt ?? null,
    createdAt: existingUserById?.createdAt ?? new Date(),
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await reconcileUserIdentity(nextUser)
      break
    } catch (error) {
      if (attempt < 4 && isReferralCodeConflict(error)) {
        nextUser = {
          ...nextUser,
          referralCode: await createUniqueReferralCode(),
        }
        continue
      }

      throw error
    }
  }

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

  if (user?.plan === 'free') {
    return (await ensureTrialWindowForUser(user.id)) ?? user
  }

  return user ?? nextUser
}

export function getUserAppPlan(plan: UserRecord['plan'] | null | undefined) {
  return toAppPlan(plan)
}
