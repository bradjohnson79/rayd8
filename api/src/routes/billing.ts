import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { env } from '../env.js'
import {
  createCheckoutSession,
  verifyCheckoutSession,
} from '../services/subscriptions.js'
import { syncUserFromClerk } from '../services/users.js'

const checkoutBodySchema = z.object({
  plan: z.literal('regen'),
})

const verifySessionBodySchema = z.object({
  sessionId: z.string().min(1),
})

export const billingRoutes: FastifyPluginAsync = async (app) => {
  const handleCheckout = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const { plan } = checkoutBodySchema.parse(request.body)
    const user = await syncUserFromClerk(request.auth.userId)

    if (!user) {
      return reply.code(503).send({ error: 'Clerk is not configured on the server.' })
    }

    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      plan,
    })

    if (!session?.url) {
      return reply.code(503).send({
        error: 'Stripe is not configured. Add the Stripe secret key and price IDs.',
      })
    }

    return { checkoutUrl: session.url }
  }

  app.post('/v1/billing/checkout', handleCheckout)
  app.post('/api/stripe/create-checkout-session', handleCheckout)

  app.post('/v1/billing/verify-session', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const { sessionId } = verifySessionBodySchema.parse(request.body)
    const user = await syncUserFromClerk(request.auth.userId)

    if (!user) {
      return reply.code(503).send({ error: 'Clerk is not configured on the server.' })
    }

    const result = await verifyCheckoutSession({
      sessionId,
      userId: request.auth.userId,
    })

    return result
  })

  app.get('/v1/billing/config', async () => {
    const stripeGatewayConfigured = Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET)
    const regenConfigured = Boolean(stripeGatewayConfigured && env.STRIPE_REGEN_PRICE_ID)

    return {
      stripeConfigured: stripeGatewayConfigured,
      regenConfigured,
    }
  })
}
