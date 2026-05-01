import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import {
  AnalyticsRangeError,
  AnalyticsUnavailableError,
  getEvents,
  getOverview,
  getTimeseries,
  getTopPages,
  isUmamiConfigured,
} from '../../services/analytics/umami.js'

const rangeQuerySchema = z.object({
  startAt: z.coerce.number().int().positive().optional(),
  endAt: z.coerce.number().int().positive().optional(),
})

function sendAnalyticsUnavailable(reply: FastifyReply) {
  return reply.code(503).send({ error: 'Analytics temporarily unavailable' })
}

export const adminAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/overview', { preHandler: requireAdminAccess }, async (request, reply) => {
    if (!isUmamiConfigured()) {
      return sendAnalyticsUnavailable(reply)
    }

    try {
      const range = rangeQuerySchema.parse(request.query)
      return { overview: await getOverview(range) }
    } catch (error) {
      if (error instanceof AnalyticsRangeError) {
        return reply.code(400).send({ error: error.message })
      }

      if (error instanceof AnalyticsUnavailableError) {
        return sendAnalyticsUnavailable(reply)
      }

      throw error
    }
  })

  app.get('/pages', { preHandler: requireAdminAccess }, async (request, reply) => {
    if (!isUmamiConfigured()) {
      return sendAnalyticsUnavailable(reply)
    }

    try {
      const range = rangeQuerySchema.parse(request.query)
      return { pages: await getTopPages(range) }
    } catch (error) {
      if (error instanceof AnalyticsRangeError) {
        return reply.code(400).send({ error: error.message })
      }

      if (error instanceof AnalyticsUnavailableError) {
        return sendAnalyticsUnavailable(reply)
      }

      throw error
    }
  })

  app.get('/events', { preHandler: requireAdminAccess }, async (request, reply) => {
    if (!isUmamiConfigured()) {
      return sendAnalyticsUnavailable(reply)
    }

    try {
      const range = rangeQuerySchema.parse(request.query)
      return { events: await getEvents(range) }
    } catch (error) {
      if (error instanceof AnalyticsRangeError) {
        return reply.code(400).send({ error: error.message })
      }

      if (error instanceof AnalyticsUnavailableError) {
        return sendAnalyticsUnavailable(reply)
      }

      throw error
    }
  })

  app.get('/timeseries', { preHandler: requireAdminAccess }, async (request, reply) => {
    if (!isUmamiConfigured()) {
      return sendAnalyticsUnavailable(reply)
    }

    try {
      const range = rangeQuerySchema.parse(request.query)
      return { timeseries: await getTimeseries(range) }
    } catch (error) {
      if (error instanceof AnalyticsRangeError) {
        return reply.code(400).send({ error: error.message })
      }

      if (error instanceof AnalyticsUnavailableError) {
        return sendAnalyticsUnavailable(reply)
      }

      throw error
    }
  })
}
