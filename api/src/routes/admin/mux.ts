import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { env } from '../../env.js'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import {
  createMuxUpload,
  getMuxAssets,
  getMuxPlaybackToken,
  getMuxStats,
  isMuxPlaybackSigningConfigured,
} from '../../services/admin/muxAdmin.js'

const uploadBodySchema = z.object({
  title: z.string().min(1).max(120).optional(),
})

const playbackTokenQuerySchema = z.object({
  assetId: z.string().min(1),
})

export const adminMuxRoutes: FastifyPluginAsync = async (app) => {
  app.get('/assets', { preHandler: requireAdminAccess }, async () => ({
    assets: await getMuxAssets(),
  }))

  app.get('/stats', { preHandler: requireAdminAccess }, async () => ({
    stats: await getMuxStats(),
  }))

  app.post('/upload', { preHandler: requireAdminAccess }, async (request, reply) => {
    const { title } = uploadBodySchema.parse(request.body)
    const upload = await createMuxUpload({
      corsOrigin: env.APP_URL,
      title,
    })

    if (!upload) {
      return reply.code(503).send({ error: 'Mux is not configured on the server.' })
    }

    return { upload }
  })

  app.get(
    '/playback-token',
    { preHandler: requireAdminAccess },
    async (request, reply) => {
      const { assetId } = playbackTokenQuerySchema.parse(request.query)

      if (!isMuxPlaybackSigningConfigured()) {
        return reply.code(503).send({
          error:
            'Mux playback signing is not configured on the server. Add MUX_SIGNING_KEY_ID and MUX_SIGNING_KEY_PRIVATE.',
        })
      }

      const playback = await getMuxPlaybackToken(assetId)

      if (!playback) {
        return reply.code(404).send({
          error: 'Mux playback token could not be created for this asset.',
        })
      }

      return { playback }
    },
  )
}
