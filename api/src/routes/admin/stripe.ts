import type { FastifyPluginAsync } from 'fastify'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import {
  getAdminOrders,
  getAdminSubscribers,
} from '../../services/admin/stripeAdmin.js'

export const adminStripeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/orders', { preHandler: requireAdminAccess }, async () => ({
    orders: await getAdminOrders(),
  }))

  app.get('/subscribers', { preHandler: requireAdminAccess }, async () => ({
    subscribers: await getAdminSubscribers(),
  }))
}
