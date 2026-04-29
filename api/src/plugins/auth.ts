import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { verifyToken } from '@clerk/backend'
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

function getBearerToken(request: FastifyRequest) {
  const authorizationHeader = request.headers.authorization

  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null
  }

  return authorizationHeader.slice('Bearer '.length).trim() || null
}

function getAuthorizedParties() {
  const values = [env.APP_URL, 'https://rayd8.app', 'https://www.rayd8.app', 'http://localhost:5173']
    .map((value) => value?.trim())
    .filter(Boolean)

  return Array.from(new Set(values))
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('auth', null)

  app.addHook('preHandler', async (request) => {
    if (!env.CLERK_SECRET_KEY || !clerkClient) {
      request.auth = null
      return
    }

    try {
      const bearerToken = getBearerToken(request)
      let userId: string | null = null

      if (bearerToken) {
        const payload = await verifyToken(bearerToken, {
          authorizedParties: getAuthorizedParties(),
          ...(env.CLERK_JWT_KEY ? { jwtKey: env.CLERK_JWT_KEY } : {}),
          secretKey: env.CLERK_SECRET_KEY,
        })

        userId = typeof payload.sub === 'string' ? payload.sub : null
      } else {
        const authState = await clerkClient.authenticateRequest(
          new Request(toRequestUrl(request), {
            method: request.method,
            headers: toRequestHeaders(request),
          }),
        )

        if (!authState.isAuthenticated) {
          request.auth = null
          return
        }

        const auth = authState.toAuth()
        userId = auth.userId ?? null
      }

      if (!userId) {
        request.auth = null
        return
      }

      const user = await syncUserFromClerk(userId)

      request.auth = {
        userId,
        email: user?.email ?? null,
        plan: getUserAppPlan(user?.plan),
        role: user?.role ?? 'member',
      }
    } catch (error) {
      request.log.warn(
        {
          error: error instanceof Error ? error.message : String(error),
          hasAuthorizationHeader: Boolean(request.headers.authorization),
          path: request.url,
        },
        'Clerk authentication failed',
      )
      request.auth = null
    }
  })
}

export const registerAuth = fp(authPlugin)
