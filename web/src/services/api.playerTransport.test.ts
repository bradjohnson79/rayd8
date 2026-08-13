/**
 * Reproduction tests for bounded retry semantics on player-critical GETs.
 *
 * INC-2026-08-06-VIDEO-LOOP: transient failures may be retried, but retries
 * must be bounded, backoff-delayed, and NEVER applied to 4xx denials.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiRequestError } from './api'
import { playerApiGet } from './playerTransport'

type FetchCall = { url: string; init?: RequestInit }

function stubFetchSequence(handlers: Array<(call: FetchCall) => Promise<Response>>) {
  const calls: FetchCall[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const call: FetchCall = { url, init }
    calls.push(call)
    const handler = handlers[Math.min(calls.length - 1, handlers.length - 1)]
    return handler(call)
  }) as typeof fetch
  return {
    calls,
    restore() {
      globalThis.fetch = original
    },
  }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('playerApiGet bounded retry', () => {
  it('retries transient 5xx then succeeds, bounded to maxAttempts', async () => {
    const stub = stubFetchSequence([
      async () => jsonResponse(503, { error: 'mux unavailable' }),
      async () => jsonResponse(200, { playback_id: 'p', signed_url: 'https://x', expires_at: 1 }),
    ])
    try {
      const result = await playerApiGet<{ playback_id: string }>(
        '/v1/player/playback-token?assetId=x&experience=regen',
        'tok',
        { maxAttempts: 3, baseDelayMs: 1, timeoutMs: 1_000 },
      )
      assert.equal(result.playback_id, 'p')
      assert.equal(stub.calls.length, 2)
    } finally {
      stub.restore()
    }
  })

  it('never retries 4xx denials (403/404/429)', async () => {
    for (const status of [403, 404, 429]) {
      const stub = stubFetchSequence([async () => jsonResponse(status, { code: 'DENIED' })])
      try {
        await assert.rejects(
          playerApiGet('/v1/player/playback-token?assetId=x&experience=regen', 'tok', {
            maxAttempts: 3,
            baseDelayMs: 1,
            timeoutMs: 1_000,
          }),
          (error: unknown) => {
            assert.ok(error instanceof ApiRequestError)
            assert.equal(error.status, status)
            return true
          },
        )
        assert.equal(stub.calls.length, 1, `status ${status} must not be retried`)
      } finally {
        stub.restore()
      }
    }
  })

  it('stops after maxAttempts on persistent 5xx (no infinite loop)', async () => {
    const stub = stubFetchSequence([async () => jsonResponse(503, { error: 'mux unavailable' })])
    try {
      await assert.rejects(
        playerApiGet('/v1/player/playback-token?assetId=x&experience=regen', 'tok', {
          maxAttempts: 3,
          baseDelayMs: 1,
          timeoutMs: 1_000,
        }),
        (error: unknown) => {
          assert.ok(error instanceof ApiRequestError)
          assert.equal(error.status, 503)
          return true
        },
      )
      assert.equal(stub.calls.length, 3)
    } finally {
      stub.restore()
    }
  })

  it('does not retry REQUEST_TIMEOUT (already waited a full budget)', async () => {
    const stub = stubFetchSequence([
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          call.init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    ])
    try {
      await assert.rejects(
        playerApiGet('/v1/player/playback-token?assetId=x&experience=regen', 'tok', {
          maxAttempts: 3,
          baseDelayMs: 1,
          timeoutMs: 30,
        }),
        (error: unknown) => {
          assert.ok(error instanceof ApiRequestError)
          assert.equal(error.code, 'REQUEST_TIMEOUT')
          return true
        },
      )
      assert.equal(stub.calls.length, 1)
    } finally {
      stub.restore()
    }
  })

  it('retries NETWORK_ERROR once with backoff', async () => {
    const stub = stubFetchSequence([
      async () => {
        throw new TypeError('Failed to fetch')
      },
      async () => jsonResponse(200, { ok: true }),
    ])
    try {
      const result = await playerApiGet<{ ok: boolean }>(
        '/v1/player/playback-token?assetId=x&experience=regen',
        'tok',
        { maxAttempts: 2, baseDelayMs: 1, timeoutMs: 1_000 },
      )
      assert.equal(result.ok, true)
      assert.equal(stub.calls.length, 2)
    } finally {
      stub.restore()
    }
  })
})
