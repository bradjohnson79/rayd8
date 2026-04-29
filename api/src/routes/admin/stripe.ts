import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import {
  archiveAdminOrders,
  getAdminOrders,
  getAdminSubscribers,
} from '../../services/admin/stripeAdmin.js'

const archiveOrdersSchema = z.object({
  stripeSubscriptionIds: z.array(z.string().min(1)).min(1).max(100),
})

export const adminStripeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/orders', { preHandler: requireAdminAccess }, async () => ({
    orders: await getAdminOrders(),
  }))

  app.post('/orders/archive', { preHandler: requireAdminAccess }, async (request) => {
    const { stripeSubscriptionIds } = archiveOrdersSchema.parse(request.body)

    return {
      archived: await archiveAdminOrders({
        archivedBy: request.auth?.userId,
        stripeSubscriptionIds,
      }),
      orders: await getAdminOrders(),
    }
  })

  app.get('/subscribers', { preHandler: requireAdminAccess }, async () => ({
    subscribers: await getAdminSubscribers(),
  }))
}
