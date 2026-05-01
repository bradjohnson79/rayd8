import type { FastifyReply, FastifyRequest } from 'fastify'
import { sendAuthRequired } from '../http/errors.js'

export async function requireAdminAccess(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.auth?.userId) {
    return sendAuthRequired(reply)
  }

  if (request.auth.role !== 'admin') {
    return reply.code(403).send({ error: 'Admin access required.' })
  }
}
