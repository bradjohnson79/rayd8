import type { FastifyPluginAsync } from 'fastify'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import {
  getAdminOverview,
  getAdminUsers,
  ResyncUserError,
  resyncUserSubscriptionsFromStripe,
} from '../../services/admin/usersAdmin.js'

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: requireAdminAccess }, async () => ({
    users: await getAdminUsers(),
  }))

  app.get('/overview', { preHandler: requireAdminAccess }, async () => ({
    overview: await getAdminOverview(),
  }))

  app.post<{ Params: { userId: string } }>(
    '/:userId/resync-from-stripe',
    { preHandler: requireAdminAccess },
    async (request, reply) => {
      try {
        return await resyncUserSubscriptionsFromStripe(request.params.userId)
      } catch (error) {
        if (error instanceof ResyncUserError) {
          const statusCode = error.code === 'USER_NOT_FOUND' ? 404 : 503
          return reply.code(statusCode).send({ error: error.message })
        }

        throw error
      }
    },
  )
}
