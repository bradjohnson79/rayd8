import type { FastifyPluginAsync } from 'fastify'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import { getContactMessages } from '../../services/contactMessages.js'

export const adminMessageRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: requireAdminAccess }, async () => ({
    messages: await getContactMessages(),
  }))
}
