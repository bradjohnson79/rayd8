import type { FastifyReply } from 'fastify'

export function sendAuthRequired(reply: FastifyReply) {
  return reply.code(401).send({
    code: 'AUTH_REQUIRED',
    error: 'AUTH_REQUIRED',
  })
}
