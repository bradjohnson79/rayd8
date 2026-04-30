import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { generateSeoReportPdf, getSeoReportById, listSeoReports } from './seo.report.service.js'
import {
  applySeoChanges,
  createAndStoreSeoAudit,
  generateSeoOptimizationPreview,
  getEffectiveSeoMetadataForPath,
  getLatestSeoAudit,
  getSeoOverview,
  listSeoAudits,
  rollbackSeoAction,
} from './seo.service.js'

const pathListSchema = z.object({
  fullSite: z.boolean().optional(),
  paths: z.array(z.string().min(1)).max(20).optional(),
})

const optimizationChangeSchema = z.object({
  canonicalUrl: z.string().url().nullable(),
  description: z.string().min(1).max(320),
  follow: z.boolean(),
  index: z.boolean(),
  keywords: z.array(z.string().min(1).max(80)).max(12),
  openGraph: z.object({
    description: z.string().optional(),
    image: z.string().url().optional(),
    title: z.string().optional(),
    type: z.string().optional(),
    url: z.string().url().optional(),
  }),
  path: z.string().min(1),
  priority: z.number().int().min(0).max(100),
  reason: z.string().min(1).max(500),
  routeType: z.enum(['landing', 'conversion', 'support']),
  title: z.string().min(1).max(120),
})

const applyChangesSchema = z.object({
  changes: z.array(optimizationChangeSchema).min(1).max(20),
})

const reportParamsSchema = z.object({
  id: z.string().uuid(),
})

const rollbackParamsSchema = z.object({
  actionId: z.string().uuid(),
})

const metadataQuerySchema = z.object({
  path: z.string().min(1),
})

export const seoController = {
  async apply(request: FastifyRequest, reply: FastifyReply) {
    const { changes } = applyChangesSchema.parse(request.body)
    const response = await applySeoChanges({
      changes,
      initiatedBy: request.auth?.userId ?? null,
    })

    return reply.send(response)
  },

  async audit(request: FastifyRequest, reply: FastifyReply) {
    const payload = pathListSchema.parse(request.body ?? {})
    const audit = await createAndStoreSeoAudit({
      fullSite: payload.fullSite,
      initiatedBy: request.auth?.userId ?? null,
      paths: payload.paths,
    })

    return reply.send({ audit })
  },

  async getLatestAudit(_request: FastifyRequest, reply: FastifyReply) {
    const audit = await getLatestSeoAudit()
    return reply.send({ audit })
  },

  async getMetadata(request: FastifyRequest, reply: FastifyReply) {
    const { path } = metadataQuerySchema.parse(request.query)
    const metadata = await getEffectiveSeoMetadataForPath(path)
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=300')
    return reply.send({
      canonicalUrl: metadata.canonicalUrl,
      description: metadata.description,
      follow: metadata.follow,
      index: metadata.index,
      keywords: metadata.keywords,
      og: metadata.openGraph,
      path: metadata.path,
      priority: metadata.priority,
      routeType: metadata.routeType,
      title: metadata.title,
    })
  },

  async getOverview(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send(await getSeoOverview())
  },

  async getReport(request: FastifyRequest, reply: FastifyReply) {
    const { id } = reportParamsSchema.parse(request.params)
    const report = await getSeoReportById(id)

    if (!report) {
      return reply.code(404).send({ error: 'SEO report not found.' })
    }

    return reply.send({ report })
  },

  async getReportPdf(request: FastifyRequest, reply: FastifyReply) {
    const { id } = reportParamsSchema.parse(request.params)
    const pdf = await generateSeoReportPdf(id)

    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename="rayd8-seo-report-${id}.pdf"`)

    return reply.send(pdf)
  },

  async listAudits(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ audits: await listSeoAudits() })
  },

  async listReports(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({ reports: await listSeoReports() })
  },

  async optimize(request: FastifyRequest, reply: FastifyReply) {
    const payload = pathListSchema.parse(request.body ?? {})
    const preview = await generateSeoOptimizationPreview({
      fullSite: payload.fullSite,
      paths: payload.paths,
    })

    return reply.send(preview)
  },

  async rollback(request: FastifyRequest, reply: FastifyReply) {
    const { actionId } = rollbackParamsSchema.parse(request.params)
    return reply.send(
      await rollbackSeoAction(actionId, request.auth?.userId ?? null),
    )
  },
}
