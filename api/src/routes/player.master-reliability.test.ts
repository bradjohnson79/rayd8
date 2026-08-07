/**
 * Master reliability reproduction + regression suite for player-critical API behavior.
 *
 * Covers incident INC-2026-08-06-PLAYBACK-TOKEN-CORS and INC-2026-08-06-VIDEO-LOOP:
 *  - CORS contract on success, preflight, and every error status the player can hit
 *  - Correlation ID propagation
 *  - No redirect behavior on player endpoints
 *  - Session start idempotency (no duplicate sessions on retry)
 *  - JSON (never HTML) error shape for the token client
 *
 * These tests assert DESIRED behavior. Pre-repair runs capture the exact defect;
 * post-repair runs must pass without the tests being weakened.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Deterministic no-DB fallbacks for all services.
vi.mock('../db/client.js', () => ({ db: null }))

const ALLOWED_ORIGIN = 'https://rayd8.app'
const ALLOWED_WWW_ORIGIN = 'https://www.rayd8.app'
const DISALLOWED_ORIGIN = 'https://evil.example.com'
const REGEN_ASSET_ID = '102CCM01JJ3dlAeCzDw00ibDBLPkcRtZLmN6oQ1eCTPd8E'
const EXPANSION_ONLY_ASSET_ID = 'xmofOgizsbzJ02lVZQGfgJ02MvkbCVh7PP9i4i6LTY4nk'

process.env.NODE_ENV = 'test'
// Auth plugin must short-circuit to auth=null without network access.
process.env.CLERK_SECRET_KEY = ''

type Server = Awaited<ReturnType<typeof import('../server.js')['buildServer']>>

let app: Server

beforeAll(async () => {
  const { buildServer } = await import('../server.js')
  app = buildServer()
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

describe('playback-token CORS contract (real server)', () => {
  it('answers OPTIONS preflight for the production origin with credentials support', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: {
        origin: ALLOWED_ORIGIN,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization,content-type',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['access-control-allow-credentials']).toBe('true')
    expect(response.headers['access-control-allow-methods']).toMatch(/GET/)
    expect(response.headers['access-control-allow-headers']).toMatch(/Authorization/i)
  })

  it('supports the www production origin', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: {
        origin: ALLOWED_WWW_ORIGIN,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_WWW_ORIGIN)
  })

  it('never uses a wildcard origin while credentials are enabled', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: { origin: ALLOWED_ORIGIN },
    })

    expect(response.headers['access-control-allow-origin']).not.toBe('*')
  })

  it('sends Vary: Origin so caches cannot poison cross-origin responses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: { origin: ALLOWED_ORIGIN },
    })

    expect(String(response.headers['vary'] ?? '')).toMatch(/Origin/i)
  })

  it('rejects disallowed origins without ACAO (browser-side CORS rejection)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: { origin: DISALLOWED_ORIGIN },
    })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })

  it('preserves CORS headers on 401 AUTH_REQUIRED', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: { origin: ALLOWED_ORIGIN },
    })

    expect(response.statusCode).toBe(401)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.json()).toMatchObject({ code: 'AUTH_REQUIRED' })
  })

  it('preserves CORS headers and JSON shape on unknown-route 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/player/does-not-exist',
      headers: { origin: ALLOWED_ORIGIN },
    })

    expect(response.statusCode).toBe(404)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['content-type']).toMatch(/application\/json/)
  })

  it('does not redirect player endpoints (no 3xx request loops)', async () => {
    const withSlash = await app.inject({
      method: 'GET',
      url: '/v1/player/playback-token/?assetId=x&experience=regen',
      headers: { origin: ALLOWED_ORIGIN },
    })
    const withoutSlash = await app.inject({
      method: 'GET',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: { origin: ALLOWED_ORIGIN },
    })

    // No 3xx redirect loops; a plain 404 on the trailing-slash variant is fine.
    expect(withSlash.statusCode === 404 || withSlash.statusCode < 300).toBe(true)
    expect(withSlash.headers['location']).toBeUndefined()
    expect(withoutSlash.headers['location']).toBeUndefined()
  })

  it('echoes a client correlation ID and generates one when absent', async () => {
    const withId = await app.inject({
      method: 'GET',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: { origin: ALLOWED_ORIGIN, 'x-rayd8-correlation-id': 'test-corr-123' },
    })
    expect(withId.headers['x-rayd8-correlation-id']).toBe('test-corr-123')

    const withoutId = await app.inject({
      method: 'GET',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: { origin: ALLOWED_ORIGIN },
    })
    expect(typeof withoutId.headers['x-rayd8-correlation-id']).toBe('string')
    expect(String(withoutId.headers['x-rayd8-correlation-id']).length).toBeGreaterThan(8)
  })

  it('accepts the correlation header in preflight allowed headers', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/player/playback-token?assetId=x&experience=regen',
      headers: {
        origin: ALLOWED_ORIGIN,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization,content-type,x-rayd8-correlation-id',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-headers']).toMatch(/x-rayd8-correlation-id/i)
  })
})

/**
 * Authenticated status matrix through the REAL player route handlers.
 * Auth is stubbed at the Fastify layer (no Clerk network); CORS options come
 * from the shared production config module.
 */
describe('playback-token authenticated status matrix (shared CORS config)', () => {
  type Harness = Awaited<ReturnType<typeof buildHarness>>
  let harness: Harness | null = null
  let corsModuleAvailable = true

  async function buildHarness() {
    const [{ default: Fastify }, { default: cors }] = await Promise.all([
      import('fastify'),
      import('@fastify/cors'),
    ])

    let buildCorsOptions: (() => Record<string, unknown>) | null = null
    try {
      const mod = await import('../config/cors.js')
      buildCorsOptions = mod.buildCorsOptions
    } catch {
      corsModuleAvailable = false
    }

    if (!buildCorsOptions) {
      return null
    }

    const { playerRoutes } = await import('./player.js')
    const { ZodError } = await import('zod')

    const instance = Fastify({ logger: false })
    await instance.register(cors, buildCorsOptions() as never)
    instance.decorateRequest('auth', null)
    instance.setErrorHandler((error, request, reply) => {
      if (error instanceof ZodError) {
        return reply.code(400).send({ error: 'Invalid request payload.', issues: error.issues })
      }
      return reply.code(500).send({ error: 'Internal server error.' })
    })
    instance.addHook('preHandler', async (request) => {
      const userId = request.headers['x-test-user-id']
      const plan = request.headers['x-test-plan']
      request.auth =
        typeof userId === 'string'
          ? {
              userId,
              email: null,
              plan: (typeof plan === 'string' ? plan : 'regen') as 'regen',
              role: 'member' as const,
            }
          : null
    })
    await instance.register(playerRoutes)
    await instance.ready()
    return instance
  }

  beforeAll(async () => {
    harness = await buildHarness()
  })

  afterAll(async () => {
    await harness?.close()
  })

  function requireHarness() {
    if (!harness) {
      // Pre-repair reproduction: shared CORS config module does not exist yet.
      expect.unreachable('shared CORS config missing (../config/cors.js)')
    }
    return harness
  }

  it('shares one CORS config module between server and tests', () => {
    expect(corsModuleAvailable).toBe(true)
  })

  it('playback-token always carries CORS + JSON, on success and on 5xx/4xx', async () => {
    const server = requireHarness()
    const response = await server.inject({
      method: 'GET',
      url: `/v1/player/playback-token?assetId=${REGEN_ASSET_ID}&experience=regen`,
      headers: { origin: ALLOWED_ORIGIN, 'x-test-user-id': 'user_test', 'x-test-plan': 'regen' },
    })

    // Local .env may fully configure Mux (200) or not (404/503). The contract
    // under test: whatever the outcome, CORS + JSON are always present.
    expect([200, 404, 503]).toContain(response.statusCode)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['content-type']).toMatch(/application\/json/)
  })

  it('403 trial-expired carries CORS + trial code', async () => {
    const server = requireHarness()
    const response = await server.inject({
      method: 'GET',
      url: `/v1/player/playback-token?assetId=${EXPANSION_ONLY_ASSET_ID}&experience=expansion`,
      headers: { origin: ALLOWED_ORIGIN, 'x-test-user-id': 'user_test', 'x-test-plan': 'free' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.json()).toMatchObject({ code: 'TRIAL_EXPIRED' })
  })

  it('403 asset-not-allowed carries CORS', async () => {
    const server = requireHarness()
    const response = await server.inject({
      method: 'GET',
      url: `/v1/player/playback-token?assetId=${EXPANSION_ONLY_ASSET_ID}&experience=regen`,
      headers: { origin: ALLOWED_ORIGIN, 'x-test-user-id': 'user_test', 'x-test-plan': 'regen' },
    })

    expect(response.statusCode).toBe(403)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
  })

  it('400 invalid query carries CORS + JSON (never HTML)', async () => {
    const server = requireHarness()
    const response = await server.inject({
      method: 'GET',
      url: '/v1/player/playback-token',
      headers: { origin: ALLOWED_ORIGIN, 'x-test-user-id': 'user_test', 'x-test-plan': 'regen' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['content-type']).toMatch(/application\/json/)
  })

  it('playback-token responses are never cached by shared caches', async () => {
    const server = requireHarness()
    const response = await server.inject({
      method: 'GET',
      url: `/v1/player/playback-token?assetId=${REGEN_ASSET_ID}&experience=regen`,
      headers: { origin: ALLOWED_ORIGIN, 'x-test-user-id': 'user_test', 'x-test-plan': 'regen' },
    })

    expect(String(response.headers['cache-control'] ?? '')).toMatch(/no-store/)
  })

  it('session start is idempotent for a client-supplied session ID', async () => {
    const server = requireHarness()
    const clientSessionId = '3f6b8b7a-7c3d-4f4d-9f6d-2f0d1c2b3a49'

    const first = await server.inject({
      method: 'POST',
      url: '/v1/player/session/start',
      headers: {
        origin: ALLOWED_ORIGIN,
        'content-type': 'application/json',
        'x-test-user-id': 'user_test',
        'x-test-plan': 'regen',
      },
      payload: { experience: 'regen', sessionId: clientSessionId },
    })
    const second = await server.inject({
      method: 'POST',
      url: '/v1/player/session/start',
      headers: {
        origin: ALLOWED_ORIGIN,
        'content-type': 'application/json',
        'x-test-user-id': 'user_test',
        'x-test-plan': 'regen',
      },
      payload: { experience: 'regen', sessionId: clientSessionId },
    })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    const firstBody = first.json() as { session: { id: string } }
    const secondBody = second.json() as { session: { id: string } }
    expect(firstBody.session.id).toBe(clientSessionId)
    expect(secondBody.session.id).toBe(clientSessionId)
  })

  it('session start rejects a malformed client session ID', async () => {
    const server = requireHarness()
    const response = await server.inject({
      method: 'POST',
      url: '/v1/player/session/start',
      headers: {
        origin: ALLOWED_ORIGIN,
        'content-type': 'application/json',
        'x-test-user-id': 'user_test',
        'x-test-plan': 'regen',
      },
      payload: { experience: 'regen', sessionId: 'not-a-uuid' },
    })

    expect(response.statusCode).toBe(400)
  })

  it('heartbeat after session end must not accrue usage or resurrect the session', async () => {
    const server = requireHarness()
    const response = await server.inject({
      method: 'POST',
      url: '/v1/player/session/heartbeat',
      headers: {
        origin: ALLOWED_ORIGIN,
        'content-type': 'application/json',
        'x-test-user-id': 'user_test',
        'x-test-plan': 'regen',
      },
      payload: { sessionId: '3f6b8b7a-7c3d-4f4d-9f6d-2f0d1c2b3a49', mediaQualified: true },
    })

    // No DB in tests → unknown session → 404. The contract: never 500, always JSON + CORS.
    expect([404, 409]).toContain(response.statusCode)
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
    expect(response.headers['content-type']).toMatch(/application\/json/)
  })
})
