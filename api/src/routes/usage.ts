import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { maybeDispatchStreamLimitReached } from '../services/notifications/streamLimitNotifications.js'
import { toAppPlan } from '../services/player/accessPolicy.js'
import { getTrialStatusForUser } from '../services/player/trialStatus.js'
import { addTrackedUsageSeconds } from '../services/player/usagePeriods.js'
import { getUsageSnapshotForUser } from '../services/player/usageSummary.js'
import { syncUserFromClerk } from '../services/users.js'

const experienceSchema = z.enum(['expansion', 'premium', 'regen'])

const usageTrackSchema = z.object({
  seconds: z.number().int().positive().max(3600),
  version: experienceSchema,
})

export const usageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/usage', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const user = await syncUserFromClerk(request.auth.userId)
    const plan = toAppPlan(user?.plan)
    const snapshot = await getUsageSnapshotForUser({
      plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    await Promise.all([
      maybeDispatchStreamLimitReached({
        access: snapshot.access.expansion,
        plan,
        userId: request.auth.userId,
      }),
      maybeDispatchStreamLimitReached({
        access: snapshot.access.premium,
        plan,
        userId: request.auth.userId,
      }),
      maybeDispatchStreamLimitReached({
        access: snapshot.access.regen,
        plan,
        userId: request.auth.userId,
      }),
    ])

    return {
      access: snapshot.access,
      plan,
      usage: snapshot.usage,
    }
  })

  app.post('/v1/usage/track', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const { seconds, version } = usageTrackSchema.parse(request.body)
    const user = await syncUserFromClerk(request.auth.userId)
    const plan = toAppPlan(user?.plan)
    const trialStatus = await getTrialStatusForUser({
      plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    if (!trialStatus.allowed && trialStatus.reason) {
      return reply.code(403).send({ error: trialStatus.reason })
    }

    await addTrackedUsageSeconds({
      experience: version,
      plan,
      seconds,
      userId: request.auth.userId,
    })

    const snapshot = await getUsageSnapshotForUser({
      plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    await Promise.all([
      maybeDispatchStreamLimitReached({
        access: snapshot.access.expansion,
        plan,
        userId: request.auth.userId,
      }),
      maybeDispatchStreamLimitReached({
        access: snapshot.access.premium,
        plan,
        userId: request.auth.userId,
      }),
      maybeDispatchStreamLimitReached({
        access: snapshot.access.regen,
        plan,
        userId: request.auth.userId,
      }),
    ])

    return {
      access: snapshot.access,
      plan,
      usage: snapshot.usage,
    }
  })
}
