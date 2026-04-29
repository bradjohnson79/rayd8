import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import rawBody from 'fastify-raw-body'
import { ZodError } from 'zod'
import { env } from './env.js'
import { registerAuth } from './plugins/auth.js'
import { adminMessageRoutes } from './routes/admin/messages.js'
import { adminMuxRoutes } from './routes/admin/mux.js'
import { adminNotificationRoutes } from './routes/admin/notifications.js'
import { adminStripeRoutes } from './routes/admin/stripe.js'
import { adminUserRoutes } from './routes/admin/users.js'
import { billingRoutes } from './routes/billing.js'
import { contactRoutes } from './routes/contact.js'
import { healthRoutes } from './routes/health.js'
import { meRoutes } from './routes/me.js'
import { playerRoutes } from './routes/player.js'
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
  void app.register(usageRoutes)
  void app.register(settingsRoutes)
  void app.register(stripeWebhookRoutes)
  void app.register(contactRoutes, { prefix: '/api/contact' })
  void app.register(billingRoutes)
  void app.register(adminMessageRoutes, { prefix: '/api/admin/messages' })
  void app.register(adminStripeRoutes, { prefix: '/api/admin/stripe' })
  void app.register(adminMuxRoutes, { prefix: '/api/admin/mux' })
  void app.register(adminNotificationRoutes, { prefix: '/api/admin/notifications' })
  void app.register(adminUserRoutes, { prefix: '/api/admin/users' })

  return app
}

const app = buildServer()

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .catch((error) => {
    app.log.error(error)
    process.exit(1)
  })
