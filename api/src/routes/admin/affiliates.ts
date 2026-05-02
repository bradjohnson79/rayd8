import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import {
  buildAffiliateCommissionsCsv,
  getAdminAffiliateCommissions,
  getAdminAffiliateOverview,
  getAdminAffiliateSummary,
  getAdminTopAffiliates,
  markAffiliateCommissionsPaid,
  type AffiliateAdminFilters,
} from '../../services/admin/affiliatesAdmin.js'

const filterQuerySchema = z.object({
  endAt: z.string().trim().optional(),
  startAt: z.string().trim().optional(),
  status: z.enum(['all', 'pending', 'approved', 'paid']).optional(),
})

const markPaidBodySchema = z.object({
  commissionIds: z.array(z.string().uuid()).min(1),
})

function toOptionalDate(value?: string, endOfDay = false) {
  if (!value) {
    return null
  }

  const normalizedValue =
    endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value
  const date = new Date(normalizedValue)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseFilters(query: unknown): AffiliateAdminFilters {
  const result = filterQuerySchema.parse(query)

  return {
    endAt: toOptionalDate(result.endAt, true),
    startAt: toOptionalDate(result.startAt),
    status: result.status ?? 'all',
  }
}

export const adminAffiliateRoutes: FastifyPluginAsync = async (app) => {
  app.get('/summary', { preHandler: requireAdminAccess }, async () => {
    return getAdminAffiliateSummary()
  })

  app.get('/top', { preHandler: requireAdminAccess }, async () => {
    return {
      affiliates: await getAdminTopAffiliates(),
    }
  })

  app.get('/overview', { preHandler: requireAdminAccess }, async (request) => {
    return getAdminAffiliateOverview(parseFilters(request.query))
  })

  app.get('/commissions', { preHandler: requireAdminAccess }, async (request) => {
    return {
      commissions: await getAdminAffiliateCommissions(parseFilters(request.query)),
    }
  })

  app.post('/commissions/mark-paid', { preHandler: requireAdminAccess }, async (request) => {
    const { commissionIds } = markPaidBodySchema.parse(request.body)
    return markAffiliateCommissionsPaid(commissionIds)
  })

  app.get('/export.csv', { preHandler: requireAdminAccess }, async (request, reply) => {
    const csv = await buildAffiliateCommissionsCsv(parseFilters(request.query))

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="affiliate-commissions.csv"')
    return reply.send(csv)
  })
}
