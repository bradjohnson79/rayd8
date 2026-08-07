import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getRecoveryOverlayCopy,
  mapApiErrorToStartupFailure,
  mapMediaReasonToStartupFailure,
  selectRecoveryOverlay,
  toSupportReferenceCode,
} from './sessionStartupTaxonomy'
import {
  bucketCurrentTime,
  sanitizeSessionStartupSnapshot,
  shouldEmitSessionStartupIncident,
  _resetSessionStartupIncidentDedupeForTests,
} from './sessionStartupTelemetry'

describe('sessionStartupTaxonomy', () => {
  it('maps auth and entitlement API failures distinctly', () => {
    const auth = mapApiErrorToStartupFailure({
      correlationId: 'c1',
      status: 401,
      code: 'AUTH_REQUIRED',
    })
    assert.equal(auth.code, 'AUTH_EXPIRED')
    assert.equal(auth.recoverability, 'reauth')

    const entitlement = mapApiErrorToStartupFailure({
      correlationId: 'c2',
      status: 403,
      code: 'plan_upgrade_required',
    })
    assert.equal(entitlement.code, 'ENTITLEMENT_DENIED')
  })

  it('maps media health timeout to media-start overlay', () => {
    const failure = mapMediaReasonToStartupFailure({
      correlationId: 'c3',
      reason: 'startup_health_timeout',
      sourceApplied: true,
    })
    const kind = selectRecoveryOverlay({
      softDenialActive: false,
      failure,
      initFailureVisible: false,
      playbackHealthFailed: true,
    })
    assert.equal(kind, 'media_start_failure')
    const copy = getRecoveryOverlayCopy({ kind, correlationId: 'c3' })
    assert.ok(copy)
    assert.match(copy.title, /Playback Did Not Start/)
    assert.ok(copy.actions.includes('restart_playback'))
    assert.ok(copy.actions.includes('reload_session'))
  })

  it('keeps soft denial as winner', () => {
    const kind = selectRecoveryOverlay({
      softDenialActive: true,
      failure: mapMediaReasonToStartupFailure({
        correlationId: 'c4',
        reason: 'startup_health_timeout',
        sourceApplied: true,
      }),
      initFailureVisible: true,
      playbackHealthFailed: true,
    })
    assert.equal(kind, 'soft_denial')
  })

  it('creates short support reference codes without embedding correlation secrets', () => {
    const code = toSupportReferenceCode('express:abc-def-ghi')
    assert.match(code, /^R8-[0-9A-F]{4}$/)
  })

  it('maps REQUEST_TIMEOUT to a retryable timeout, not a generic token failure', () => {
    const failure = mapApiErrorToStartupFailure({
      correlationId: 't1',
      status: 0,
      code: 'REQUEST_TIMEOUT',
    })
    assert.equal(failure.code, 'REQUEST_TIMEOUT')
    assert.equal(failure.recoverability, 'retry')
  })

  it('maps REQUEST_ABORTED to a retryable abort, distinct from offline', () => {
    const failure = mapApiErrorToStartupFailure({
      correlationId: 't2',
      status: 0,
      code: 'REQUEST_ABORTED',
    })
    assert.equal(failure.code, 'REQUEST_ABORTED')
    assert.equal(failure.recoverability, 'retry')
  })

  it('maps 429 rate limiting to a retryable backoff failure, never a hard denial', () => {
    const failure = mapApiErrorToStartupFailure({
      correlationId: 't3',
      status: 429,
      code: 'rate_limited',
    })
    assert.equal(failure.code, 'REQUEST_TIMEOUT')
    assert.equal(failure.recoverability, 'retry')
    assert.notEqual(failure.recoverability, 'return_home')
    assert.notEqual(failure.recoverability, 'fatal')
  })

  it('maps EDGE_HTML_RESPONSE (edge challenge page) to a retryable network failure', () => {
    const failure = mapApiErrorToStartupFailure({
      correlationId: 't4',
      status: 0,
      code: 'EDGE_HTML_RESPONSE',
    })
    assert.equal(failure.code, 'NETWORK_OFFLINE')
    assert.equal(failure.recoverability, 'retry')
  })

  it('classifies BROWSER_BLOCKED media reason with browser guidance', () => {
    const failure = mapMediaReasonToStartupFailure({
      correlationId: 't5',
      reason: 'BROWSER_BLOCKED',
      sourceApplied: true,
    })
    assert.equal(failure.code, 'BROWSER_BLOCKED')
    const kind = selectRecoveryOverlay({
      softDenialActive: false,
      failure,
      initFailureVisible: false,
      playbackHealthFailed: true,
    })
    const copy = getRecoveryOverlayCopy({ kind, correlationId: 't5' })
    assert.ok(copy)
    assert.match(`${copy.title} ${copy.body}`, /browser|Brave|shield|extension|permission/i)
  })
})

describe('sessionStartupTelemetry', () => {
  it('redacts secrets and signed-looking URLs', () => {
    const sanitized = sanitizeSessionStartupSnapshot({
      kind: 'overlay_shown',
      correlationId: 'corr',
      stage: 'PLAYBACK_TOKEN',
      code: 'PLAYBACK_TOKEN_FAILED',
      browserFamily: 'https://stream.mux.com/abc?token=secret',
      currentTimeBucket: bucketCurrentTime(1.2),
    } as Parameters<typeof sanitizeSessionStartupSnapshot>[0] & { signed_url?: string })
    assert.equal(
      sanitizeSessionStartupSnapshot({
        kind: 'overlay_shown',
        correlationId: 'corr2',
        ...({ signed_url: 'https://stream.mux.com/x' } as object),
      } as Parameters<typeof sanitizeSessionStartupSnapshot>[0]).signed_url,
      undefined,
    )
    assert.equal(sanitized.browserFamily, '[redacted-url]')
    assert.equal(sanitized.correlationId, 'corr')
    assert.equal(sanitized.currentTimeBucket, '0.5_2')
  })

  it('dedupes overlay_shown emissions', () => {
    _resetSessionStartupIncidentDedupeForTests()
    assert.equal(shouldEmitSessionStartupIncident('overlay|a|b'), true)
    assert.equal(shouldEmitSessionStartupIncident('overlay|a|b'), false)
  })
})
