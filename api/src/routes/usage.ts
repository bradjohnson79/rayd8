import type { FastifyPluginAsync } from 'fastify'
import { maybeDispatchStreamLimitReached } from '../services/notifications/streamLimitNotifications.js'
import { toAppPlan } from '../services/player/accessPolicy.js'
import { getUsageSnapshotForUser } from '../services/player/usageSummary.js'
import { syncUserFromClerk } from '../services/users.js'
import { sendAuthRequired } from '../http/errors.js'

export const usageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/usage', async (request, reply) => {
    if (!request.auth?.userId) {
      return sendAuthRequired(reply)
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
}
