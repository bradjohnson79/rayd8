import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { env } from '../env.js'
import { clerkClient } from '../lib/clerk.js'
import { getUserAppPlan, syncUserFromClerk } from '../services/users.js'

function toRequestUrl(request: FastifyRequest) {
  const protocol =
    request.headers['x-forwarded-proto'] ??
    (request.protocol ? request.protocol : 'http')
  const host = request.headers.host ?? 'localhost:3001'

  return `${protocol}://${host}${request.url}`
}

function toRequestHeaders(request: FastifyRequest) {
  const headers = new Headers()

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry))
      continue
    }

    if (typeof value === 'string') {
      headers.set(key, value)
    }
  }

  return headers
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('auth', null)

  app.addHook('preHandler', async (request) => {
    if (!env.CLERK_SECRET_KEY || !clerkClient) {
      request.auth = null
      return
    }

    try {
      const authState = await clerkClient.authenticateRequest(
        new Request(toRequestUrl(request), {
          method: request.method,
          headers: toRequestHeaders(request),
        }),
        {
          acceptsToken: 'session_token',
        },
      )

      if (!authState.isAuthenticated) {
        request.auth = null
        return
      }

      const auth = authState.toAuth()

      if (!auth.userId) {
        request.auth = null
        return
      }

      const user = await syncUserFromClerk(auth.userId)

      request.auth = {
        userId: auth.userId,
        email: user?.email ?? null,
        plan: getUserAppPlan(user?.plan),
        role: user?.role ?? 'member',
      }
    } catch {
      request.auth = null
    }
  })
}

export const registerAuth = fp(authPlugin)
