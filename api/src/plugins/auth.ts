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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function getPostgresErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code

    return typeof code === 'string' ? code : null
  }

  return null
}

function getUserSyncErrorCode(error: unknown) {
  const postgresCode = getPostgresErrorCode(error)
  const message = getErrorMessage(error).toLowerCase()

  if (
    postgresCode?.startsWith('42') ||
    message.includes('column') ||
    message.includes('relation') ||
    message.includes('does not exist') ||
    message.includes('schema')
  ) {
    return 'DB_SCHEMA_ERROR'
  }

  if (
    postgresCode ||
    message.includes('database') ||
    message.includes('neon') ||
    message.includes('sql')
  ) {
    return 'DATABASE_ERROR'
  }

  return 'USER_SYNC_ERROR'
}

const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('auth', null)

  app.addHook('preHandler', async (request, reply) => {
    if (!env.CLERK_SECRET_KEY || !clerkClient) {
      request.auth = null
      return
    }

    const bearerToken = getBearerToken(request)
    let userId: string | null = null

    try {
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
    } catch (error) {
      request.log.warn(
        {
          error: getErrorMessage(error),
          hasAuthorizationHeader: Boolean(request.headers.authorization),
          path: request.url,
        },
        'Clerk token verification failed',
      )
      request.auth = null
      return
    }

    try {
      const user = await syncUserFromClerk(userId)

      request.auth = {
        userId,
        email: user?.email ?? null,
        plan: getUserAppPlan(user?.plan),
        role: user?.role ?? 'member',
      }
    } catch (error) {
      const code = getUserSyncErrorCode(error)

      request.log.error(
        {
          code,
          error: getErrorMessage(error),
          hasAuthorizationHeader: Boolean(request.headers.authorization),
          path: request.url,
          postgresCode: getPostgresErrorCode(error),
          userId,
        },
        'Authenticated user sync failed',
      )

      return reply.code(500).send({ code, error: code })
    }
  })
}

export const registerAuth = fp(authPlugin)
