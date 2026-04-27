import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sendContactAdminEmail } from '../services/contactEmail.js'
import { createContactMessage } from '../services/contactMessages.js'

const contactMessageSchema = z.object({
  email: z.string().email(),
  message: z.string().min(10).max(4000),
  name: z.string().min(2).max(120),
})

const publicContactMessageSchema = contactMessageSchema.extend({
  company: z.string().max(200).optional().default(''),
})

const publicContactRequestLog = new Map<string, number>()
const PUBLIC_CONTACT_WINDOW_MS = 60 * 1000

export const contactRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', async (request, reply) => {
    if (!request.auth?.userId || !request.auth.email) {
      return reply.code(401).send({ error: 'Authentication required.' })
    }

    const payload = contactMessageSchema.parse(request.body)
    const subject = `RAYD8 Contact - ${payload.name}`

    const message = await createContactMessage({
      email: payload.email,
      message: payload.message,
      subject,
      userId: request.auth.userId,
    })

    const emailDelivered = await sendContactAdminEmail({
      authEmail: request.auth.email,
      message: payload.message,
      name: payload.name,
      replyToEmail: payload.email,
      userId: request.auth.userId,
    }).catch((error) => {
      request.log.error(error, 'Failed to deliver contact admin email.')
      return false
    })

    return {
      delivery_email: 'bradjohnson79@gmail.com',
      emailDelivered,
      message,
      ok: true,
    }
  })

  app.post('/public', async (request, reply) => {
    const payload = publicContactMessageSchema.parse(request.body)

    if (payload.company.trim()) {
      return {
        delivery_email: 'bradjohnson79@gmail.com',
        emailDelivered: false,
        ok: true,
      }
    }

    const requestKey = request.ip
    const now = Date.now()
    const previousAttempt = publicContactRequestLog.get(requestKey)

    if (typeof previousAttempt === 'number' && now - previousAttempt < PUBLIC_CONTACT_WINDOW_MS) {
      return reply.code(429).send({
        error: 'Please wait a moment before sending another message.',
      })
    }

    publicContactRequestLog.set(requestKey, now)

    const emailDelivered = await sendContactAdminEmail({
      authEmail: 'Public landing visitor',
      message: payload.message,
      name: payload.name,
      replyToEmail: payload.email,
      userId: 'public-landing',
    }).catch((error) => {
      request.log.error(error, 'Failed to deliver public landing contact email.')
      return false
    })

    return {
      delivery_email: 'bradjohnson79@gmail.com',
      emailDelivered,
      ok: true,
    }
  })
}
