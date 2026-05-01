import type { FastifyPluginAsync } from 'fastify'
import { syncUserFromClerk } from '../services/users.js'
import { toAppPlan } from '../services/player/accessPolicy.js'
import { getSettingsForUser } from '../services/settings.js'
import { getTrialStatusForUser } from '../services/player/trialStatus.js'
import { getUsageSnapshotForUser } from '../services/player/usageSummary.js'
import { sendAuthRequired } from '../http/errors.js'

export const meRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/me', async (request, reply) => {
    if (!request.auth?.userId) {
      return sendAuthRequired(reply)
    }

    const user = await syncUserFromClerk(request.auth.userId)
    const settings = await getSettingsForUser(request.auth.userId)
    const plan = toAppPlan(user?.plan)
    const snapshot = await getUsageSnapshotForUser({
      plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })

    return {
      access: {
        expansion: snapshot.access.expansion,
        premium: snapshot.access.premium,
        regen: snapshot.access.regen,
      },
      usage: snapshot.usage,
      user: user
        ? {
            ...user,
            hasSeenRayd8GuideAt: settings.hasSeenRayd8GuideAt,
            plan,
          }
        : null,
    }
  })

  app.get('/v1/me/trial-status', async (request, reply) => {
    if (!request.auth?.userId) {
      return sendAuthRequired(reply)
    }

    const user = await syncUserFromClerk(request.auth.userId)
    const plan = toAppPlan(user?.plan)

    return getTrialStatusForUser({
      plan,
      role: request.auth.role,
      userId: request.auth.userId,
    })
  })
}
