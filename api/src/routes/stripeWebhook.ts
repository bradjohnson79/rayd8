import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import Stripe from 'stripe'
import { env } from '../env.js'
import { processStripeEvent } from '../services/subscriptions.js'

const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as never,
    })
  : null

function getRawRequestBody(body: unknown, rawBody: unknown) {
  if (typeof rawBody === 'string' || Buffer.isBuffer(rawBody)) {
    return rawBody
  }

  if (Buffer.isBuffer(body) || typeof body === 'string') {
    return body
  }

  return JSON.stringify(body)
}

async function handleStripeWebhook(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!stripeClient || !env.STRIPE_WEBHOOK_SECRET) {
      return reply.status(503).send({
        error: 'Stripe webhook configuration is missing on the server.',
      })
    }

    const signature = request.headers['stripe-signature']

    if (typeof signature !== 'string') {
      return reply.status(400).send('Webhook Error: Missing Stripe signature header.')
    }

    const event = stripeClient.webhooks.constructEvent(
      getRawRequestBody(request.body, request.rawBody),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    )

    request.log.info({ eventType: event.type }, 'Stripe Event Received')

    const result = await processStripeEvent(event)

    return reply.send({
      duplicate: result.duplicate,
      received: true,
    })
  } catch (err) {
    request.log.error(err, 'Stripe webhook error')
    const message = err instanceof Error ? err.message : 'Unknown Stripe webhook error.'

    return reply.status(400).send(`Webhook Error: ${message}`)
  }
}

export const stripeWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/stripe/webhook', handleStripeWebhook)
  app.post('/v1/billing/webhook', handleStripeWebhook)
}
