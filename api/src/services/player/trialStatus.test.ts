import { describe, expect, it } from 'vitest'
import {
  getTrialNotification,
  getTrialStatus,
  normalizeTrialNotificationsSent,
} from './trialStatus.js'
import { getFreeUsagePeriodStart } from './usagePeriods.js'

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

  it('allows while trial hours remain below the exact limit', () => {
    const status = getTrialStatus(
      buildFreeUser({ trialHoursUsed: 34.999 }),
      new Date('2026-05-12T13:00:00.000Z'),
    )

    expect(status).toMatchObject({
      allowed: true,
      hours_remaining: 0,
      reason: null,
    })
  })

  it('blocks when trial hours reach the exact limit', () => {
    const status = getTrialStatus(
      buildFreeUser({ trialHoursUsed: 35 }),
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

  it('does not reset remaining hours at a calendar month boundary', () => {
    const status = getTrialStatus(
      buildFreeUser({
        trialEndsAt: new Date('2026-02-14T12:00:00.000Z'),
        trialHoursUsed: 12,
        trialStartedAt: new Date('2026-01-15T12:00:00.000Z'),
      }),
      new Date('2026-02-01T12:00:00.000Z'),
    )

    expect(status).toMatchObject({
      allowed: true,
      days_remaining: 13,
      hours_remaining: 23,
      plan: 'free_trial',
      reason: null,
    })
  })

  it('applies free trial expiration to admin users on the free plan', () => {
    const status = getTrialStatus(
      buildFreeUser({
        role: 'admin',
      }),
      new Date('2026-05-30T12:00:00.001Z'),
    )

    expect(status).toMatchObject({
      allowed: false,
      plan: 'free_trial',
      reason: 'TRIAL_EXPIRED',
    })
  })

  it('blocks free users without a trial window', () => {
    const status = getTrialStatus(
      buildFreeUser({
        trialEndsAt: null,
        trialStartedAt: null,
      }),
      new Date('2026-05-12T13:00:00.000Z'),
    )

    expect(status).toMatchObject({
      allowed: false,
      days_remaining: 0,
      hours_remaining: 0,
      plan: 'free_trial',
      reason: 'TRIAL_EXPIRED',
    })
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

describe('normalizeTrialNotificationsSent', () => {
  it('normalizes legacy null or malformed notification state', () => {
    expect(normalizeTrialNotificationsSent(null)).toEqual([])
    expect(normalizeTrialNotificationsSent(['14', 7, null, '3'])).toEqual(['14', '3'])
  })
})

describe('getFreeUsagePeriodStart', () => {
  it('uses account creation as the free usage period start', () => {
    const createdAt = new Date('2026-01-15T12:00:00.000Z')

    expect(getFreeUsagePeriodStart(createdAt)).toBe(createdAt)
  })

  it('does not fall back to the current calendar month when account creation is unavailable', () => {
    expect(getFreeUsagePeriodStart(null)).toEqual(new Date(0))
  })
})
