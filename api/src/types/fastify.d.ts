import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      userId: string
      email: string | null
      plan: 'free' | 'premium' | 'regen' | 'amrita'
      role: 'member' | 'admin'
    } | null
  }
}
