import type { FastifyPluginAsync } from 'fastify'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import { seoController } from '../../modules/seo/seo.controller.js'

export const adminSeoRoutes: FastifyPluginAsync = async (app) => {
  app.get('/overview', { preHandler: requireAdminAccess }, seoController.getOverview)
  app.get('/audits', { preHandler: requireAdminAccess }, seoController.listAudits)
  app.get('/audits/latest', { preHandler: requireAdminAccess }, seoController.getLatestAudit)
  app.get('/reports', { preHandler: requireAdminAccess }, seoController.listReports)
  app.get('/reports/:id', { preHandler: requireAdminAccess }, seoController.getReport)
  app.get('/reports/:id/pdf', { preHandler: requireAdminAccess }, seoController.getReportPdf)
  app.post('/audit', { preHandler: requireAdminAccess }, seoController.audit)
  app.post('/optimize', { preHandler: requireAdminAccess }, seoController.optimize)
  app.post('/apply', { preHandler: requireAdminAccess }, seoController.apply)
  app.post('/rollback/:actionId', { preHandler: requireAdminAccess }, seoController.rollback)
}
