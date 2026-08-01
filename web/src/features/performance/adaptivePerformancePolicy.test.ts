import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  decideTierTransition,
  DEFAULT_POLICY_CONFIG,
  profileForTier,
  type PolicyContext,
} from './adaptivePerformancePolicy'
import type {
  EffectiveTier,
  ObservationWindow,
  PerformanceSample,
} from './adaptivePerformanceTypes'

function sample(partial: Partial<PerformanceSample> & { at: number }): PerformanceSample {
  return {
    frameIntervalMs: 33,
    longTaskCountWindow: 0,
    heapUsedBytes: 50_000_000,
    buffering: false,
    registeredResourceCount: 2,
    hidden: false,
    ...partial,
  }
}

function windowOf(samples: PerformanceSample[], targetFps = 30): ObservationWindow {
  return { samples, targetFps }
}

function baseCtx(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    mode: 'automatic',
    currentTier: 'standard',
    now: 120_000,
    lastTierChangeAt: null,
    ordinaryTierChangesThisSession: 0,
    baselineHeapUsedBytes: 50_000_000,
    ...overrides,
  }
}

function timeline(decisions: ReturnType<typeof decideTierTransition>[]) {
  return decisions.map((d) =>
    d.action === 'hold' ? `hold:${d.reason}` : `${d.action}:${d.to}:${d.reason}`,
  )
}

describe('adaptivePerformancePolicy', () => {
  it('is deterministic for the same sample sequence', () => {
    const samples = [
      sample({ at: 1, frameIntervalMs: 80 }),
      sample({ at: 2, frameIntervalMs: 85 }),
      sample({ at: 3, frameIntervalMs: 90 }),
    ]
    const ctx = baseCtx({ now: 200_000 })
    const a = decideTierTransition(windowOf(samples), ctx)
    const b = decideTierTransition(windowOf(samples), ctx)
    assert.deepEqual(a, b)
    assert.equal(a.action, 'downgrade')
  })

  it('does not downgrade on heap alone', () => {
    const samples = [
      sample({ at: 1, heapUsedBytes: 50_000_000, frameIntervalMs: 32 }),
      sample({ at: 2, heapUsedBytes: 80_000_000, frameIntervalMs: 33 }),
      sample({ at: 3, heapUsedBytes: 90_000_000, frameIntervalMs: 31 }),
    ]
    const decision = decideTierTransition(
      windowOf(samples),
      baseCtx({ baselineHeapUsedBytes: 50_000_000 }),
    )
    assert.equal(decision.action, 'hold')
  })

  it('holds in standard and reduced modes under stress', () => {
    const samples = [
      sample({ at: 1, frameIntervalMs: 90 }),
      sample({ at: 2, frameIntervalMs: 95 }),
      sample({ at: 3, frameIntervalMs: 100 }),
    ]
    assert.equal(
      decideTierTransition(windowOf(samples), baseCtx({ mode: 'standard' })).action,
      'hold',
    )
    assert.equal(
      decideTierTransition(windowOf(samples), baseCtx({ mode: 'reduced' })).action,
      'hold',
    )
  })

  it('respects ordinary session change cap', () => {
    const samples = [
      sample({ at: 1, frameIntervalMs: 90 }),
      sample({ at: 2, frameIntervalMs: 95 }),
      sample({ at: 3, frameIntervalMs: 100 }),
    ]
    const decision = decideTierTransition(
      windowOf(samples),
      baseCtx({
        ordinaryTierChangesThisSession: DEFAULT_POLICY_CONFIG.maxOrdinaryTierChangesPerSession,
        now: 500_000,
      }),
    )
    assert.equal(decision.action, 'hold')
    assert.equal(decision.reason, 'session_ordinary_change_cap')
  })

  it('recovers one tier at a time after healthy residence', () => {
    const samples = [
      sample({ at: 1, frameIntervalMs: 30 }),
      sample({ at: 2, frameIntervalMs: 31 }),
      sample({ at: 3, frameIntervalMs: 29 }),
    ]
    const decision = decideTierTransition(
      windowOf(samples, 20),
      baseCtx({
        currentTier: 'reduced',
        lastTierChangeAt: 0,
        now: 200_000,
      }),
    )
    assert.equal(decision.action, 'recover')
    if (decision.action === 'recover') {
      assert.equal(decision.to, 'balanced')
    }
  })

  it('allows emergency downgrade on critical stress', () => {
    const samples = [
      sample({ at: 1, frameIntervalMs: 100, longTaskCountWindow: 10 }),
      sample({ at: 2, frameIntervalMs: 110, longTaskCountWindow: 10 }),
      sample({ at: 3, frameIntervalMs: 120, longTaskCountWindow: 10 }),
    ]
    const decision = decideTierTransition(
      windowOf(samples),
      baseCtx({
        lastTierChangeAt: 119_000,
        now: 120_000,
      }),
    )
    assert.equal(decision.action, 'downgrade')
    if (decision.action === 'downgrade') {
      assert.equal(decision.emergency, true)
    }
  })

  it('builds versioned profiles', () => {
    const profile = profileForTier('automatic', 'balanced', {
      reason: 'test',
      lastTierChangeAt: 1,
      ordinaryTierChangesThisSession: 2,
      activityState: 'session-active',
    })
    assert.equal(profile.version, 1)
    assert.equal(profile.effectiveTier, 'balanced')
    assert.equal(profile.visualEffectsTier, 'balanced')
    assert.ok(profile.targetFps < 30)
  })

  it('produces identical tier timelines for identical runs', () => {
    const seq = [
      [80, 85, 90],
      [30, 31, 29],
      [30, 30, 30],
    ] as const
    const run = () => {
      let tier: EffectiveTier = 'standard'
      let last: number | null = null
      let ordinary = 0
      const decisions = []
      let now = 100_000
      for (const frames of seq) {
        now += 100_000
        const samples = frames.map((frameIntervalMs, index) =>
          sample({ at: now + index, frameIntervalMs }),
        )
        const decision = decideTierTransition(
          windowOf([...samples]),
          baseCtx({
            currentTier: tier,
            lastTierChangeAt: last,
            ordinaryTierChangesThisSession: ordinary,
            now,
          }),
        )
        decisions.push(decision)
        if (decision.action === 'downgrade' || decision.action === 'recover') {
          tier = decision.to
          last = now
          if (!('emergency' in decision && decision.emergency)) {
            ordinary += 1
          }
        }
      }
      return timeline(decisions)
    }
    assert.deepEqual(run(), run())
  })
})
