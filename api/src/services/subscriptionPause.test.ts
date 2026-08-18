import { describe, expect, it } from 'vitest'
import {
  canStartAccountHold,
  getAccountHoldResumeAt,
  isAccountHoldActive,
  isAccountHoldCooldownActive,
  isStripeManagedSubscriptionId,
  resolveBillingPauseFlags,
} from './subscriptionPause.js'

const now = new Date('2026-08-18T00:00:00.000Z')

describe('subscription pause hold policy', () => {
  it('treats a future pauseResumesAt as an active hold', () => {
    expect(
      isAccountHoldActive(
        { pauseResumesAt: new Date('2026-09-17T00:00:00.000Z') },
        now,
      ),
    ).toBe(true)
  })

  it('treats an expired pauseResumesAt as not paused', () => {
    expect(
      isAccountHoldActive(
        { pauseResumesAt: new Date('2026-08-01T00:00:00.000Z') },
        now,
      ),
    ).toBe(false)
  })

  it('blocks a second pause during the 12-month cooldown', () => {
    const subscription = {
      cancelAtPeriodEnd: false,
      pauseResumesAt: null as Date | null,
      pauseStartedAt: new Date('2026-03-01T00:00:00.000Z'),
      status: 'active',
    }

    expect(isAccountHoldCooldownActive(subscription, now)).toBe(true)
    expect(canStartAccountHold(subscription, {}, now)).toBe(false)
    expect(resolveBillingPauseFlags(subscription, {}, now)).toEqual({
      canPause: false,
      canResume: false,
      pauseBlockReason: 'cooldown',
      paused: false,
    })
  })

  it('allows pause for an active paid subscription outside cooldown', () => {
    const flags = resolveBillingPauseFlags(
      {
        cancelAtPeriodEnd: false,
        pauseResumesAt: null,
        pauseStartedAt: null,
        status: 'active',
      },
      {},
      now,
    )

    expect(flags).toEqual({
      canPause: true,
      canResume: false,
      pauseBlockReason: null,
      paused: false,
    })
  })

  it('exposes resume flags while a hold is active', () => {
    const flags = resolveBillingPauseFlags(
      {
        cancelAtPeriodEnd: false,
        pauseResumesAt: new Date('2026-09-17T00:00:00.000Z'),
        pauseStartedAt: now,
        status: 'active',
      },
      {},
      now,
    )

    expect(flags).toEqual({
      canPause: false,
      canResume: true,
      pauseBlockReason: 'already_paused',
      paused: true,
    })
  })

  it('sets the hold resume date 30 days ahead', () => {
    expect(getAccountHoldResumeAt(now).toISOString()).toBe('2026-09-17T00:00:00.000Z')
  })

  it('treats only Stripe sub_ ids as Stripe-managed', () => {
    expect(isStripeManagedSubscriptionId('sub_123')).toBe(true)
    expect(isStripeManagedSubscriptionId('manual_comp_regen_1')).toBe(false)
  })
})
