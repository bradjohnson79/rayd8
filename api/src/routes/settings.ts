import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getSettingsForUser, upsertSettingsForUser } from '../services/settings.js'
import { syncUserFromClerk } from '../services/users.js'

const settingsSchema = z.object({
  amplifierMode: z.enum(['off', '5x', '10x', '20x']),
  blueLightEnabled: z.boolean(),
  circadianEnabled: z.boolean(),
  lastSpeedMode: z.enum(['standard', 'fast', 'superFast', 'slow', 'superSlow']),
})

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/settings', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    await syncUserFromClerk(request.auth.userId)
    const settings = await getSettingsForUser(request.auth.userId)

    return { settings }
  })

  app.put('/v1/settings', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const settings = settingsSchema.parse(request.body)
    await syncUserFromClerk(request.auth.userId)

    const savedSettings = await upsertSettingsForUser(request.auth.userId, settings)

    return reply.send({ settings: savedSettings })
  })
}
