import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'
import type { AppPlan, ExperienceAccessSummary } from '../player/accessPolicy.js'
import { dispatchNotification } from './dispatchNotification.js'

async function lookupUserEmail(userId: string) {
  if (!db) {
    return null
  }

  const [userRecord] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  return userRecord?.email ?? null
}

function buildLimitReachedEntityId(input: { access: ExperienceAccessSummary; userId: string }) {
  const periodStart = input.access.usage?.periodStart?.toISOString() ?? 'na'
  const periodType = input.access.usage?.periodType ?? 'legacy'
  const blockReason = input.access.blockReason ?? 'unknown'

  return `${input.userId}:${input.access.experience}:${periodType}:${periodStart}:${blockReason}`
}

export async function maybeDispatchStreamLimitReached(input: {
  access: ExperienceAccessSummary
  plan: AppPlan
  userId: string
}) {
  if (!input.access.isBlocked || !input.access.blockReason) {
    return
  }

  if (input.plan !== 'free' && input.plan !== 'regen') {
    return
  }

  const userEmail = await lookupUserEmail(input.userId)

  try {
    await dispatchNotification({
      event: 'stream.limit.reached',
      payload: {
        blockReason: input.access.blockReason,
        entityId: buildLimitReachedEntityId({ access: input.access, userId: input.userId }),
        experience: input.access.experience,
        periodEnd: input.access.usage?.periodEnd?.toISOString() ?? null,
        periodStart: input.access.usage?.periodStart?.toISOString() ?? null,
        plan: input.plan,
        remainingSeconds: input.access.remainingSeconds ?? 0,
        usedSeconds: input.access.usedSeconds,
        userEmail,
      },
      userId: input.userId,
    })
  } catch (error) {
    console.error('[notifications]', error)
  }
}
