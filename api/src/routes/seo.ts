import type { FastifyPluginAsync } from 'fastify'
import { seoController } from '../modules/seo/seo.controller.js'

export const seoRoutes: FastifyPluginAsync = async (app) => {
  app.get('/metadata', seoController.getMetadata)
}
