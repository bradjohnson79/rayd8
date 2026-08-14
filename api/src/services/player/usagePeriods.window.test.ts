import { describe, expect, it } from 'vitest'
import { resolvePaidUsageWindow } from './usagePeriods.js'

describe('resolvePaidUsageWindow', () => {
  it('keeps a normal monthly Stripe billing window', () => {
    const window = resolvePaidUsageWindow({
      currentPeriodStart: new Date('2026-08-15T15:51:20.000Z'),
      currentPeriodEnd: new Date('2026-09-15T15:51:20.000Z'),
      now: new Date('2026-08-20T00:00:00.000Z'),
    })

    expect(window.periodStart.toISOString()).toBe('2026-08-15T15:51:20.000Z')
    expect(window.periodEnd.toISOString()).toBe('2026-09-15T15:51:20.000Z')
  })

  it('falls back to the UTC calendar month for a year-long promo/comp grant', () => {
    const window = resolvePaidUsageWindow({
      currentPeriodStart: new Date('2026-06-15T18:29:00.000Z'),
      currentPeriodEnd: new Date('2027-06-15T18:29:00.000Z'),
      now: new Date('2026-08-14T19:00:00.000Z'),
    })

    expect(window.periodStart.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    expect(window.periodEnd.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})
