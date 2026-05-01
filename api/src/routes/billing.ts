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
  const getBillingErrorResponse = (message: string) => {
    if (message.includes('Stripe is not configured')) {
      return {
        code: 'BILLING_UNAVAILABLE',
        error: message,
        statusCode: 503,
      }
    }

    if (message.includes('does not belong to the authenticated user')) {
      return {
        code: 'CHECKOUT_SESSION_MISMATCH',
        error: message,
        statusCode: 403,
      }
    }

    if (message.includes('not complete yet')) {
      return {
        code: 'CHECKOUT_INCOMPLETE',
        error: 'Checkout is still processing. Please wait a moment and try again.',
        statusCode: 409,
      }
    }

    if (message.includes('missing subscription details')) {
      return {
        code: 'CHECKOUT_INVALID',
        error: 'We could not verify this checkout session.',
        statusCode: 400,
      }
    }

    if (message.includes('No active REGEN subscription')) {
      return {
        code: 'SUBSCRIPTION_NOT_FOUND',
        error: message,
        statusCode: 404,
      }
    }

    return {
      code: 'BILLING_ERROR',
      error: message,
      statusCode: 400,
    }
  }

  const respondWithBillingError = (reply: FastifyReply, error: unknown) => {
    const message = error instanceof Error ? error.message : 'Billing request failed.'
    const response = getBillingErrorResponse(message)
    return reply.code(response.statusCode).send({
      code: response.code,
      error: response.error,
    })
  }

  const handleCheckout = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ code: 'UNAUTHENTICATED', error: 'Authentication required.' })
    }

    const { plan } = checkoutBodySchema.parse(request.body)
    const user = await syncUserFromClerk(request.auth.userId)

    if (!user) {
      return reply.code(503).send({
        code: 'USER_SYNC_UNAVAILABLE',
        error: 'We could not verify your account right now. Please try again.',
      })
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
      return reply.code(401).send({ code: 'UNAUTHENTICATED', error: 'Authentication required.' })
    }

    await syncUserFromClerk(request.auth.userId)
    return getBillingStatus(request.auth.userId)
  })

  app.post('/v1/billing/portal', async (request, reply) => {
    if (!request.auth?.userId) {
      return reply.code(401).send({ code: 'UNAUTHENTICATED', error: 'Authentication required.' })
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
      return reply.code(401).send({ code: 'UNAUTHENTICATED', error: 'Authentication required.' })
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
      return reply.code(401).send({ code: 'UNAUTHENTICATED', error: 'Authentication required.' })
    }

    const { sessionId } = verifySessionBodySchema.parse(request.body)
    const user = await syncUserFromClerk(request.auth.userId)

    if (!user) {
      return reply.code(503).send({
        code: 'USER_SYNC_UNAVAILABLE',
        error: 'We could not verify your account right now. Please try again.',
      })
    }

    try {
      const result = await verifyCheckoutSession({
        sessionId,
        userId: request.auth.userId,
      })

      return result
    } catch (error) {
      return respondWithBillingError(reply, error)
    }
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
