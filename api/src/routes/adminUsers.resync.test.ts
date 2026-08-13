import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../db/client.js', () => ({ db: null }))

process.env.NODE_ENV = 'test'
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

describe('POST /v1/admin/users/:userId/resync-from-stripe', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/admin/users/user_test/resync-from-stripe',
    })

    expect(response.statusCode).toBe(401)
  })

  it('is also registered under /api/admin/users for compatibility', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/admin/users/user_test/resync-from-stripe',
    })

    expect(response.statusCode).toBe(401)
  })
})
