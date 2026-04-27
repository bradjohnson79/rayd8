import { eq } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import { db } from '../db/client.js'
import { env } from '../env.js'
import { users } from '../db/schema.js'
import { clerkClient } from '../lib/clerk.js'
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

  await db
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

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  return user ?? nextUser
}

export function getUserAppPlan(plan: UserRecord['plan'] | null | undefined) {
  return toAppPlan(plan)
}
