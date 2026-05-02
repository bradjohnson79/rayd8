import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import rawBody from 'fastify-raw-body'
import { ZodError } from 'zod'
import { env } from './env.js'
import { verifyDatabaseStartup } from './db/startupChecks.js'
import { registerAuth } from './plugins/auth.js'
import { adminAnalyticsRoutes } from './routes/admin/analytics.js'
import { adminAffiliateRoutes } from './routes/admin/affiliates.js'
import { adminMessageRoutes } from './routes/admin/messages.js'
import { adminMuxRoutes } from './routes/admin/mux.js'
import { adminNotificationRoutes } from './routes/admin/notifications.js'
import { adminSeoRoutes } from './routes/admin/seo.js'
import { adminStripeRoutes } from './routes/admin/stripe.js'
import { adminUserRoutes } from './routes/admin/users.js'
import { billingRoutes } from './routes/billing.js'
import { contactRoutes } from './routes/contact.js'
import { healthRoutes } from './routes/health.js'
import { meRoutes } from './routes/me.js'
import { playerRoutes } from './routes/player.js'
import { referralRoutes } from './routes/referrals.js'
import { seoRoutes } from './routes/seo.js'
import { settingsRoutes } from './routes/settings.js'
import { stripeWebhookRoutes } from './routes/stripeWebhook.js'
import { usageRoutes } from './routes/usage.js'

const allowedCorsOrigins = Array.from(
  new Set([
    env.APP_URL.trim(),
    'https://rayd8.app',
    'https://www.rayd8.app',
    'http://localhost:5173',
  ]),
)

export function buildServer() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  })

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)

    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Invalid request payload.',
        issues: error.issues,
      })
    }

    return reply.code(500).send({
      error: 'Internal server error.',
    })
  })

  void app.register(cors, {
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    origin: allowedCorsOrigins,
  })
  void app.register(sensible)
  void app.register(rawBody, {
    field: 'rawBody',
    global: true,
    encoding: 'utf8',
    runFirst: true,
  })
  void app.register(registerAuth)
  void app.register(healthRoutes)
  void app.register(meRoutes)
  void app.register(playerRoutes)
  void app.register(referralRoutes)
  void app.register(usageRoutes)
  void app.register(settingsRoutes)
  void app.register(stripeWebhookRoutes)
  void app.register(seoRoutes, { prefix: '/api/seo' })
  void app.register(contactRoutes, { prefix: '/api/contact' })
  void app.register(billingRoutes)
  void app.register(adminAnalyticsRoutes, { prefix: '/api/admin/analytics' })
  void app.register(adminAffiliateRoutes, { prefix: '/api/admin/affiliates' })
  void app.register(adminAffiliateRoutes, { prefix: '/v1/admin/affiliates' })
  void app.register(adminMessageRoutes, { prefix: '/api/admin/messages' })
  void app.register(adminStripeRoutes, { prefix: '/api/admin/stripe' })
  void app.register(adminMuxRoutes, { prefix: '/api/admin/mux' })
  void app.register(adminNotificationRoutes, { prefix: '/api/admin/notifications' })
  void app.register(adminSeoRoutes, { prefix: '/api/admin/seo' })
  void app.register(adminUserRoutes, { prefix: '/api/admin/users' })

  return app
}

const app = buildServer()

async function start() {
  await verifyDatabaseStartup(app.log)
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
}

start().catch((error) => {
  app.log.error(error)
  process.exit(1)
})
