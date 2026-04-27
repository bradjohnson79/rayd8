import type { FastifyReply, FastifyRequest } from 'fastify'

export async function requireAdminAccess(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.auth?.userId) {
    return reply.code(401).send({ error: 'Authentication required.' })
  }

  if (request.auth.role !== 'admin') {
    return reply.code(403).send({ error: 'Admin access required.' })
  }
}
