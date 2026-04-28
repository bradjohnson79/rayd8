import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { env } from '../env.js'
import {
  cancelSubscriptionAtPeriodEnd,
  createBillingPortalSession,
  createCheckoutSession,
  getBillingStatus,
  verifyCheckoutSession,
  type CancellationReason,
} from '../services/subscriptions.js'
import { syncUserFromClerk } from '../services/users.js'

const checkoutBodySchema = z.object({
  plan: z.literal('regen'),
})

const verifySessionBodySchema = z.object({
  sessionId: z.string().min(1),
})

const cancellationReasonValues = [
  'too_expensive',
  'not_using_enough',
  'technical_issues',
  'didnt_see_results',
  'found_alternative',
  'other',
] as const satisfies readonly CancellationReason[]

const cancelSubscriptionBodySchema = z
  .object({
    customMessage: z.string().trim().max(1200).optional().nullable(),
    reasons: z.array(z.enum(cancellationReasonValues)).min(1),
    userId: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.reasons.includes('other') && !value.customMessage?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Add a short note when selecting Other.',
        path: ['customMessage'],
      })
    }
  })

export const billingRoutes: FastifyPluginAsync = async (app) => {
  const respondWithBillingError = (reply: FastifyReply, error: unknown) => {
    const message = error instanceof Error ? error.message : 'Billing request failed.'
    const statusCode = message.includes('Stripe is not configured') ? 503 : 400
    return reply.code(statusCode).send({ error: message })
  }

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

  app.get('/v1/billing/subscription', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    await syncUserFromClerk(request.auth.userId)
    return getBillingStatus(request.auth.userId)
  })

  app.post('/v1/billing/portal', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    try {
      await syncUserFromClerk(request.auth.userId)
      const session = await createBillingPortalSession({ userId: request.auth.userId })
      return { portalUrl: session.url }
    } catch (error) {
      return respondWithBillingError(reply, error)
    }
  })

  app.post('/v1/billing/cancel', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const payload = cancelSubscriptionBodySchema.parse(request.body)

    if (payload.userId !== request.auth.userId) {
      return reply.code(403).send({ error: 'Cancellation payload does not match the signed-in user.' })
    }

    try {
      await syncUserFromClerk(request.auth.userId)
      const result = await cancelSubscriptionAtPeriodEnd({
        userId: request.auth.userId,
        reasons: payload.reasons,
        customMessage: payload.customMessage,
      })

      return result
    } catch (error) {
      return respondWithBillingError(reply, error)
    }
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
    const regenConfigured = Boolean(stripeGatewayConfigured && env.STRIPE_REGEN_PRICE_ID)

    return {
      stripeConfigured: stripeGatewayConfigured,
      regenConfigured,
    }
  })
}
