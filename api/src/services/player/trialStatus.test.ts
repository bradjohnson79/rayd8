import { describe, expect, it } from 'vitest'
import { getTrialNotification, getTrialStatus } from './trialStatus.js'

function buildFreeUser(overrides?: Partial<Parameters<typeof getTrialStatus>[0]>) {
  return {
    id: 'user_123',
    plan: 'free' as const,
    role: 'member' as const,
    trialEndsAt: new Date('2026-05-30T12:00:00.000Z'),
    trialHoursUsed: 12.4,
    trialNotificationsSent: [],
    trialStartedAt: new Date('2026-04-30T12:00:00.000Z'),
    ...overrides,
  }
}

describe('getTrialStatus', () => {
  it('returns remaining days and hours for an active free trial', () => {
    const status = getTrialStatus(
      buildFreeUser(),
      new Date('2026-05-12T13:00:00.000Z'),
    )

    expect(status).toMatchObject({
      allowed: true,
      days_remaining: 18,
      hours_remaining: 22.6,
      plan: 'free_trial',
      reason: null,
    })
  })

  it('blocks when trial hours reach the epsilon threshold', () => {
    const status = getTrialStatus(
      buildFreeUser({ trialHoursUsed: 34.999 }),
      new Date('2026-05-12T13:00:00.000Z'),
    )

    expect(status).toMatchObject({
      allowed: false,
      hours_remaining: 0,
      reason: 'HOURS_EXCEEDED',
    })
  })

  it('blocks when the trial end timestamp has passed', () => {
    const status = getTrialStatus(
      buildFreeUser(),
      new Date('2026-05-30T12:00:00.001Z'),
    )

    expect(status).toMatchObject({
      allowed: false,
      days_remaining: 0,
      hours_remaining: 0,
      reason: 'TRIAL_EXPIRED',
    })
  })

  it('allows admin users and includes countdown details when trial window exists', () => {
    const status = getTrialStatus(
      buildFreeUser({ role: 'admin' }),
      new Date('2026-05-12T13:00:00.000Z'),
    )

    expect(status).toMatchObject({
      allowed: true,
      days_remaining: 18,
      hours_remaining: 22.6,
      notification: null,
      plan: 'free_trial',
      reason: null,
    })
  })

  it('allows admin users even without a trial window', () => {
    const status = getTrialStatus(
      buildFreeUser({
        role: 'admin',
        trialEndsAt: null,
        trialStartedAt: null,
      }),
      new Date('2026-06-30T12:00:00.000Z'),
    )

    expect(status).toMatchObject({
      allowed: true,
      notification: null,
      plan: 'free_trial',
      reason: null,
    })
    expect(status.days_remaining).toBeUndefined()
  })
})

describe('getTrialNotification', () => {
  it('returns a checkpoint warning with level metadata', () => {
    expect(getTrialNotification(14)).toEqual({
      level: 'MEDIUM',
      message: 'Your free trial ends in 14 days',
      type: 'WARNING',
    })
  })

  it('skips non-checkpoint days', () => {
    expect(getTrialNotification(18)).toBeNull()
  })
})
