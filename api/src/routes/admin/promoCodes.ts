import type { FastifyPluginAsync } from 'fastify'
import type { FastifyReply } from 'fastify'
import Stripe from 'stripe'
import { z } from 'zod'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import {
  archivePromoCode,
  createPromoCode,
  deactivatePromoCode,
  getPromoCodeDetails,
  listPromoCodes,
  recreateMissingPromoCode,
  refreshPromoCodeFromStripe,
  repairPromoCodeSync,
  restorePromoCode,
  updatePromoCode,
  validatePromoCodeWithStripe,
} from '../../services/admin/promoCodes.js'

const promoCodeIdSchema = z.object({
  id: z.string().uuid(),
})

const promoCodeListQuerySchema = z.object({
  query: z.string().optional(),
  sort: z.enum(['created', 'expires', 'redemptions', 'status']).optional(),
  status: z.enum([
    'active',
    'all',
    'archived',
    'error',
    'expired',
    'inactive',
    'mismatch',
    'missing',
    'pending',
    'synced',
  ]).optional(),
})

const createPromoCodeSchema = z.object({
  amountOff: z.number().int().positive().optional().nullable(),
  appliesToPlan: z.literal('regen').optional(),
  code: z.string().min(3).max(40),
  description: z.string().max(1000).optional().nullable(),
  discountType: z.enum(['percent', 'amount']),
  duration: z.enum(['once', 'repeating', 'forever']),
  durationInMonths: z.number().int().positive().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  maxRedemptions: z.number().int().positive().optional().nullable(),
  name: z.string().min(1).max(120),
  percentOff: z.number().int().min(1).max(100).optional().nullable(),
})

const updatePromoCodeSchema = z.object({
  appliesToPlan: z.enum(['regen', 'amrita', 'all']).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
})

function respondWithPromoCodeError(reply: FastifyReply, error: unknown) {
  if (error instanceof z.ZodError) {
    return reply.code(400).send({
      code: 'PROMO_CODE_INVALID',
      error: 'Invalid promo code payload.',
      issues: error.issues,
    })
  }

  const message = error instanceof Error ? error.message : 'Promo code request failed.'

  if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === 'resource_missing') {
    return reply.code(404).send({
      code: 'PROMO_CODE_STRIPE_MISSING',
      error: message,
    })
  }

  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    return reply.code(503).send({
      code: 'PROMO_CODE_UNAVAILABLE',
      error: message,
    })
  }

  if (message.includes('already exists')) {
    return reply.code(409).send({
      code: 'PROMO_CODE_DUPLICATE',
      error: message,
    })
  }

  if (
    message.includes('Cannot repair sync') ||
    message.includes('Expiration date') ||
    message.includes('Fixed amount') ||
    message.includes('Max redemptions') ||
    message.includes('Percent discount') ||
    message.includes('Promo code must') ||
    message.includes('Promo code name') ||
    message.includes('Repeating promo codes') ||
    message.includes('Duration in months')
  ) {
    return reply.code(400).send({
      code: 'PROMO_CODE_INVALID',
      error: message,
    })
  }

  if (message.includes('Stripe is not configured') || message.includes('Database is not configured')) {
    return reply.code(503).send({
      code: 'PROMO_CODE_UNAVAILABLE',
      error: message,
    })
  }

  return reply.code(400).send({
    code: 'PROMO_CODE_ERROR',
    error: message,
  })
}

async function runPromoCodeAction<T>(
  reply: FastifyReply,
  action: () => Promise<T | null>,
  wrap: (result: T) => unknown,
) {
  try {
    const result = await action()

    if (!result) {
      return reply.code(404).send({ error: 'Promo code not found.' })
    }

    return wrap(result)
  } catch (error) {
    return respondWithPromoCodeError(reply, error)
  }
}

export const adminPromoCodeRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: requireAdminAccess }, async (request) => {
    const query = promoCodeListQuerySchema.parse(request.query)
    return listPromoCodes(query)
  })

  app.post('/', { preHandler: requireAdminAccess }, async (request, reply) => {
    try {
      const payload = createPromoCodeSchema.parse(request.body)
      return {
        promoCode: await createPromoCode(payload, request.auth?.userId),
      }
    } catch (error) {
      return respondWithPromoCodeError(reply, error)
    }
  })

  app.get('/:id', { preHandler: requireAdminAccess }, async (request, reply) => {
    const { id } = promoCodeIdSchema.parse(request.params)
    const result = await getPromoCodeDetails(id)

    if (!result) {
      return reply.code(404).send({ error: 'Promo code not found.' })
    }

    return result
  })

  app.patch('/:id', { preHandler: requireAdminAccess }, async (request, reply) => {
    try {
      const { id } = promoCodeIdSchema.parse(request.params)
      const payload = updatePromoCodeSchema.parse(request.body)
      const promoCode = await updatePromoCode(id, payload)

      if (!promoCode) {
        return reply.code(404).send({ error: 'Promo code not found.' })
      }

      return { promoCode }
    } catch (error) {
      return respondWithPromoCodeError(reply, error)
    }
  })

  app.post('/:id/validate-stripe', { preHandler: requireAdminAccess }, async (request, reply) => {
    const { id } = promoCodeIdSchema.parse(request.params)
    return runPromoCodeAction(reply, () => validatePromoCodeWithStripe(id), (validation) => ({ validation }))
  })

  app.post('/:id/deactivate', { preHandler: requireAdminAccess }, async (request, reply) => {
    const { id } = promoCodeIdSchema.parse(request.params)
    return runPromoCodeAction(reply, () => deactivatePromoCode(id), (promoCode) => ({ promoCode }))
  })

  app.post('/:id/refresh-from-stripe', { preHandler: requireAdminAccess }, async (request, reply) => {
    const { id } = promoCodeIdSchema.parse(request.params)
    return runPromoCodeAction(reply, () => refreshPromoCodeFromStripe(id), (promoCode) => ({ promoCode }))
  })

  app.post('/:id/repair-sync', { preHandler: requireAdminAccess }, async (request, reply) => {
    const { id } = promoCodeIdSchema.parse(request.params)
    return runPromoCodeAction(reply, () => repairPromoCodeSync(id), (promoCode) => ({ promoCode }))
  })

  app.post('/:id/recreate-if-missing', { preHandler: requireAdminAccess }, async (request, reply) => {
    const { id } = promoCodeIdSchema.parse(request.params)
    return runPromoCodeAction(reply, () => recreateMissingPromoCode(id), (promoCode) => ({ promoCode }))
  })

  app.post('/:id/archive', { preHandler: requireAdminAccess }, async (request, reply) => {
    const { id } = promoCodeIdSchema.parse(request.params)
    const promoCode = await archivePromoCode(id)

    if (!promoCode) {
      return reply.code(404).send({ error: 'Promo code not found.' })
    }

    return { promoCode }
  })

  app.post('/:id/restore', { preHandler: requireAdminAccess }, async (request, reply) => {
    const { id } = promoCodeIdSchema.parse(request.params)
    const promoCode = await restorePromoCode(id)

    if (!promoCode) {
      return reply.code(404).send({ error: 'Promo code not found.' })
    }

    return { promoCode }
  })
}
