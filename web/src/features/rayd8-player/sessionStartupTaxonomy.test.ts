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
