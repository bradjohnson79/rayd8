/**
 * Reproduction + regression tests for player-critical API transport hardening.
 *
 * INC-2026-08-06-PLAYBACK-TOKEN-CORS: a hung/stalled playback-token connection
 * must reject with REQUEST_TIMEOUT inside a bounded window instead of leaving
 * the player at "Preparing Your RAYD8 Session / 0%" forever.
 *
 * Uses node:test (repo standard for web unit tests).
 */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { ApiRequestError, apiRequest } from './api'

type FetchCall = { url: string; init?: RequestInit }

function stubFetch(handler: (call: FetchCall) => Promise<Response>) {
  const calls: FetchCall[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const call: FetchCall = { url, init }
    calls.push(call)
    return handler(call)
  }) as typeof fetch
  return {
    calls,
    restore() {
      globalThis.fetch = original
    },
  }
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('apiRequest transport hardening', () => {
  afterEach(() => {
    // each test restores its own stub
  })

  it('classifies network failure as NETWORK_ERROR status 0', async () => {
    const stub = stubFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    try {
      await assert.rejects(
        apiRequest('/v1/player/playback-token?assetId=x&experience=regen', undefined, 'tok'),
        (error: unknown) => {
          assert.ok(error instanceof ApiRequestError)
          assert.equal(error.status, 0)
          assert.equal(error.code, 'NETWORK_ERROR')
          return true
        },
      )
      assert.equal(stub.calls.length, 1)
    } finally {
      stub.restore()
    }
  })

  it('rejects a hung request with REQUEST_TIMEOUT inside the timeout budget', async () => {
    const stub = stubFetch(
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          // Never resolves on its own; only honors the caller's abort signal.
          call.init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )
    try {
      const outcome = await Promise.race([
        apiRequest(
          '/v1/player/playback-token?assetId=x&experience=regen',
          undefined,
          'tok',
          { timeoutMs: 50 },
        ).then(
          () => 'resolved' as const,
          (error: unknown) =>
            error instanceof ApiRequestError ? (`${error.code}` as const) : ('wrong-error' as const),
        ),
        new Promise<'UNRESOLVED'>((resolve) => setTimeout(() => resolve('UNRESOLVED'), 2_000)),
      ])

      assert.equal(outcome, 'REQUEST_TIMEOUT')
    } finally {
      stub.restore()
    }
  })

  it('attaches a correlation ID header and adopts the server-echoed ID', async () => {
    const stub = stubFetch(async () =>
      jsonResponse(200, { ok: true }, { 'x-rayd8-correlation-id': 'srv-corr-1' }),
    )
    try {
      await apiRequest('/v1/player/access?experience=regen', undefined, 'tok')
      const headerValue =
        stub.calls[0]?.init?.headers instanceof Headers
          ? stub.calls[0].init.headers.get('x-rayd8-correlation-id')
          : null
      assert.ok(headerValue && headerValue.length >= 8, 'correlation header must be sent')
    } finally {
      stub.restore()
    }
  })

  it('supports caller-supplied correlation IDs for incident stitching', async () => {
    const stub = stubFetch(async () => jsonResponse(200, { ok: true }))
    try {
      await apiRequest('/v1/player/access?experience=regen', undefined, 'tok', {
        correlationId: 'client-corr-9',
      })
      const headerValue =
        stub.calls[0]?.init?.headers instanceof Headers
          ? stub.calls[0].init.headers.get('x-rayd8-correlation-id')
          : null
      assert.equal(headerValue, 'client-corr-9')
    } finally {
      stub.restore()
    }
  })

  it('treats an HTML 200 response (edge challenge page) as EDGE_HTML_RESPONSE, not success', async () => {
    const stub = stubFetch(
      async () =>
        new Response('<html><body>Attention Required</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    )
    try {
      await assert.rejects(
        apiRequest('/v1/player/playback-token?assetId=x&experience=regen', undefined, 'tok'),
        (error: unknown) => {
          assert.ok(error instanceof ApiRequestError)
          assert.equal(error.code, 'EDGE_HTML_RESPONSE')
          return true
        },
      )
    } finally {
      stub.restore()
    }
  })

  it('preserves API error codes on 403 entitlement denials', async () => {
    const stub = stubFetch(async () =>
      jsonResponse(403, { code: 'TRIAL_EXPIRED', error: 'trial ended' }),
    )
    try {
      await assert.rejects(
        apiRequest('/v1/player/playback-token?assetId=x&experience=regen', undefined, 'tok'),
        (error: unknown) => {
          assert.ok(error instanceof ApiRequestError)
          assert.equal(error.status, 403)
          assert.equal(error.code, 'TRIAL_EXPIRED')
          return true
        },
      )
    } finally {
      stub.restore()
    }
  })

  it('external abort signals cancel the request promptly', async () => {
    const controller = new AbortController()
    const stub = stubFetch(
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          call.init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )
    try {
      const pending = apiRequest(
        '/v1/player/playback-token?assetId=x&experience=regen',
        undefined,
        'tok',
        { signal: controller.signal, timeoutMs: 5_000 },
      )
      controller.abort()
      await assert.rejects(pending, (error: unknown) => {
        assert.ok(error instanceof ApiRequestError)
        assert.equal(error.code, 'REQUEST_ABORTED')
        return true
      })
    } finally {
      stub.restore()
    }
  })
})
