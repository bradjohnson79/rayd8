import type { FastifyPluginAsync } from 'fastify'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import {
  getAdminOverview,
  getAdminUsers,
} from '../../services/admin/usersAdmin.js'

export const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: requireAdminAccess }, async () => ({
    users: await getAdminUsers(),
  }))

  app.get('/overview', { preHandler: requireAdminAccess }, async () => ({
    overview: await getAdminOverview(),
  }))
}
