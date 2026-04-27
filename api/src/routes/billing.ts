import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { env } from '../env.js'
import {
  createCheckoutSession,
  processStripeEvent,
  verifyCheckoutSession,
  verifyStripeWebhook,
} from '../services/subscriptions.js'
import { syncUserFromClerk } from '../services/users.js'

const checkoutBodySchema = z.object({
  plan: z.enum(['premium', 'regen']),
})

const verifySessionBodySchema = z.object({
  sessionId: z.string().min(1),
})

export const billingRoutes: FastifyPluginAsync = async (app) => {
  app.post('/v1/billing/checkout', async (request, reply) => {
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
  })

  app.post('/v1/billing/webhook', async (request, reply) => {
    const signature = request.headers['stripe-signature']
    const rawBody =
      typeof request.rawBody === 'string' || Buffer.isBuffer(request.rawBody)
        ? request.rawBody
        : JSON.stringify(request.body)

    const event = verifyStripeWebhook(rawBody, typeof signature === 'string' ? signature : undefined)

    if (!event) {
      return reply.code(400).send({
        error: 'Webhook verification failed. Check Stripe keys and signature handling.',
      })
    }

    const result = await processStripeEvent(event)

    return reply.send({
      duplicate: result.duplicate,
      received: true,
    })
  })

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
    const premiumConfigured = Boolean(stripeGatewayConfigured && env.STRIPE_PREMIUM_PRICE_ID)
    const regenConfigured = Boolean(stripeGatewayConfigured && env.STRIPE_REGEN_PRICE_ID)

    return {
      stripeConfigured: stripeGatewayConfigured,
      premiumConfigured,
      regenConfigured,
    }
  })
}
