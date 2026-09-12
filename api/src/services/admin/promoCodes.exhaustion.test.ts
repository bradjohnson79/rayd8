import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Promo code exhaustion + reissue coverage.
 *
 * Root cause this guards against: a code created with max_redemptions = 1 that has
 * already been redeemed renders as SYNCED in the admin console while Stripe rejects
 * it at checkout with "This promotion code is invalid." Stripe cannot raise a
 * coupon's max_redemptions or reactivate an exhausted promotion code, so the only
 * recovery is reissuing a fresh coupon + promotion code.
 */

function makeSelectLimitChain<T>(result: T) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(result),
      })),
    })),
  }
}

function makeSelectWhereChain<T>(result: T) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(result),
    })),
  }
}

function makeSelectOrderByChain<T>(result: T) {
  return {
    from: vi.fn(() => ({
      orderBy: vi.fn().mockResolvedValue(result),
    })),
  }
}

function makeSelectGroupByChain<T>(result: T) {
  return {
    from: vi.fn(() => ({
      groupBy: vi.fn().mockResolvedValue(result),
    })),
  }
}

function makeUpdateReturningChain<T>(result: T) {
  const returning = vi.fn().mockResolvedValue(result)
  const set = vi.fn(() => ({ where: vi.fn(() => ({ returning })) }))
  const where = vi.fn().mockResolvedValue(undefined)

  return { returning, set, where }
}

function makeInsertReturningChain<T>(result: T) {
  return {
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(result),
      })),
    })),
  }
}

function makePromoCode(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-08-26T20:57:35.304Z')

  return {
    amountOff: null,
    appliesToPlan: 'regen',
    archivedAt: null,
    code: 'REGEN1MONTH',
    createdAt: now,
    currency: 'usd',
    description: null,
    discountType: 'percent',
    duration: 'once',
    durationInMonths: null,
    expiresAt: null,
    id: '11111111-1111-4111-8111-111111111111',
    isActive: true,
    maxRedemptions: 1,
    name: 'REGEN1MONTH',
    percentOff: 100,
    stripeCouponId: 'uZXag4J0',
    stripeEnvironment: 'live',
    stripePromotionCodeId: 'promo_1U8nt5GPXfP6Qy0mUafRop6k',
    stripeSyncError: null,
    stripeSyncStatus: 'synced',
    timesRedeemed: 1,
    updatedAt: now,
    ...overrides,
  }
}

function mockStripeClient(stripeClient: Record<string, unknown>) {
  class StripeError extends Error {
    statusCode?: number
  }

  class StripeInvalidRequestError extends StripeError {
    code?: string
  }

  class StripeAuthenticationError extends StripeError {}

  const StripeMock = Object.assign(
    class {
      constructor() {
        return stripeClient
      }
    },
    {
      errors: {
        StripeAuthenticationError,
        StripeError,
        StripeInvalidRequestError,
      },
    },
  )

  vi.doMock('stripe', () => ({ default: StripeMock }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('isPromoCodeExhausted', () => {
  it('treats a used-up single-use code as exhausted', async () => {
    vi.doMock('../../db/client.js', () => ({ db: null }))
    vi.doMock('../../env.js', () => ({ env: {} }))

    const { isPromoCodeExhausted } = await import('./promoCodes.js')

    expect(isPromoCodeExhausted({ maxRedemptions: 1, recordedRedemptions: 1 })).toBe(true)
    expect(isPromoCodeExhausted({ maxRedemptions: 1, recordedRedemptions: 0 })).toBe(false)
  })

  it('treats uncapped and higher-cap codes correctly', async () => {
    vi.doMock('../../db/client.js', () => ({ db: null }))
    vi.doMock('../../env.js', () => ({ env: {} }))

    const { isPromoCodeExhausted } = await import('./promoCodes.js')

    expect(isPromoCodeExhausted({ maxRedemptions: null, recordedRedemptions: 999 })).toBe(false)
    expect(isPromoCodeExhausted({ maxRedemptions: 1000, recordedRedemptions: 11 })).toBe(false)
    expect(isPromoCodeExhausted({ maxRedemptions: 100, recordedRedemptions: 100 })).toBe(true)
  })
})

describe('admin promo code exhaustion surfacing', () => {
  it('marks an exhausted code in the list and excludes it from the active count', async () => {
    const exhausted = makePromoCode()
    // A healthy, uncapped code in the same list proves the derivation is per-row.
    const healthy = makePromoCode({
      code: 'REGEN25',
      id: '22222222-2222-4222-8222-222222222222',
      maxRedemptions: 1000,
      timesRedeemed: 0,
    })

    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce(makeSelectOrderByChain([exhausted, healthy]))
        .mockReturnValueOnce(
          makeSelectGroupByChain([
            { count: 1, promoCodeId: exhausted.id },
            { count: 0, promoCodeId: healthy.id },
          ]),
        ),
    }

    vi.doMock('../../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../../env.js', () => ({ env: { STRIPE_SECRET_KEY: 'sk_test_mock' } }))
    mockStripeClient({})

    const { listPromoCodes } = await import('./promoCodes.js')
    const result = await listPromoCodes({})

    const exhaustedRecord = result.promoCodes.find((row) => row.code === 'REGEN1MONTH')
    const healthyRecord = result.promoCodes.find((row) => row.code === 'REGEN25')

    expect(exhaustedRecord?.is_exhausted).toBe(true)
    expect(exhaustedRecord?.display_status).toBe('exhausted')
    expect(exhaustedRecord?.remaining_redemptions).toBe(0)
    expect(healthyRecord?.is_exhausted).toBe(false)
    expect(healthyRecord?.display_status).toBe('synced')
    expect(healthyRecord?.remaining_redemptions).toBe(1000)
    expect(result.summary.exhausted).toBe(1)
    // The exhausted code must not inflate "Active" even though is_active is still true.
    expect(result.summary.active).toBe(1)
  })

  it('reports exhaustion as inactive when validating against Stripe', async () => {
    const existing = makePromoCode()

    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce(makeSelectLimitChain([existing]))
        .mockReturnValueOnce(makeSelectWhereChain([{ count: 1 }])),
      update: vi.fn().mockReturnValue(makeUpdateReturningChain([existing])),
    }

    const mockStripe = {
      coupons: {
        retrieve: vi.fn().mockResolvedValue({
          applies_to: { products: [] },
          amount_off: null,
          duration: 'once',
          duration_in_months: null,
          id: 'uZXag4J0',
          max_redemptions: 1,
          percent_off: 100,
          redeem_by: null,
          times_redeemed: 1,
          valid: false,
        }),
      },
      promotionCodes: {
        retrieve: vi.fn().mockResolvedValue({
          active: false,
          code: 'REGEN1MONTH',
          expires_at: null,
          id: 'promo_1U8nt5GPXfP6Qy0mUafRop6k',
          max_redemptions: 1,
          times_redeemed: 1,
        }),
      },
    }

    vi.doMock('../../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../../env.js', () => ({ env: { STRIPE_SECRET_KEY: 'sk_test_mock' } }))
    mockStripeClient(mockStripe)

    const { validatePromoCodeWithStripe } = await import('./promoCodes.js')
    const validation = await validatePromoCodeWithStripe(existing.id)

    expect(validation?.status).toBe('inactive')
    expect(validation?.messages.join(' ')).toContain('Redemption cap reached (1/1)')
    expect(validation?.messages.join(' ')).toContain('cannot be reactivated')
    expect(validation?.messages.join(' ')).toContain('underlying coupon as invalid')
  })
})

describe('reissuePromoCode', () => {
  it('mints a fresh coupon and promotion code while preserving redemption history', async () => {
    const existing = makePromoCode()
    const reissued = makePromoCode({
      maxRedemptions: null,
      stripeCouponId: 'coupon_fresh',
      stripePromotionCodeId: 'promo_fresh',
    })

    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce(makeSelectLimitChain([existing]))
        .mockReturnValueOnce(makeSelectWhereChain([{ count: 1 }])),
      update: vi.fn().mockReturnValue(makeUpdateReturningChain([reissued])),
    }

    const mockStripe = {
      coupons: { create: vi.fn().mockResolvedValue({ id: 'coupon_fresh' }) },
      promotionCodes: {
        create: vi.fn().mockResolvedValue({ active: true, id: 'promo_fresh', times_redeemed: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
    }

    vi.doMock('../../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../../env.js', () => ({ env: { STRIPE_SECRET_KEY: 'sk_test_mock' } }))
    mockStripeClient(mockStripe)

    const { reissuePromoCode } = await import('./promoCodes.js')
    const result = await reissuePromoCode(existing.id, { maxRedemptions: null })

    // The dead Stripe promotion code is retired first.
    expect(mockStripe.promotionCodes.update).toHaveBeenCalledWith(
      'promo_1U8nt5GPXfP6Qy0mUafRop6k',
      { active: false },
    )

    // A genuinely new coupon is created with no cap.
    expect(mockStripe.coupons.create).toHaveBeenCalledWith(
      expect.objectContaining({
        max_redemptions: undefined,
        metadata: expect.objectContaining({ rayd8_code: 'REGEN1MONTH' }),
        percent_off: 100,
      }),
    )

    // The customer-facing code text is unchanged.
    expect(mockStripe.promotionCodes.create).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
        code: 'REGEN1MONTH',
        max_redemptions: undefined,
      }),
    )

    // Local history is retained rather than reset to zero.
    const updatePayload = mockDb.update.mock.results[0]?.value.set.mock.calls[0]?.[0]
    expect(updatePayload).toMatchObject({
      isActive: true,
      stripeCouponId: 'coupon_fresh',
      stripePromotionCodeId: 'promo_fresh',
      stripeSyncStatus: 'synced',
      timesRedeemed: 1,
    })

    expect(result?.stripe_sync_status).toBe('synced')
  })

  it('refuses a new cap that is not above already-recorded redemptions', async () => {
    const existing = makePromoCode()

    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce(makeSelectLimitChain([existing]))
        .mockReturnValueOnce(makeSelectWhereChain([{ count: 1 }])),
      update: vi.fn(),
    }
    const mockStripe = {
      coupons: { create: vi.fn() },
      promotionCodes: { create: vi.fn(), update: vi.fn() },
    }

    vi.doMock('../../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../../env.js', () => ({ env: { STRIPE_SECRET_KEY: 'sk_test_mock' } }))
    mockStripeClient(mockStripe)

    const { reissuePromoCode } = await import('./promoCodes.js')

    await expect(reissuePromoCode(existing.id, { maxRedemptions: 1 })).rejects.toThrow(
      'Max redemptions must be greater than the 1 redemption(s) already recorded',
    )
    expect(mockStripe.coupons.create).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})

describe('recordPromoCodeRedemption exhaustion persistence', () => {
  it('flips a single-use code out of synced as soon as the cap is consumed', async () => {
    const existing = makePromoCode({ timesRedeemed: 0 })

    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce(makeSelectLimitChain([existing]))
        .mockReturnValueOnce(makeSelectWhereChain([{ count: 1 }])),
      insert: vi.fn().mockReturnValue(makeInsertReturningChain([{ id: 'redemption_1' }])),
      update: vi.fn().mockReturnValue(makeUpdateReturningChain([])),
    }

    vi.doMock('../../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../../env.js', () => ({ env: { STRIPE_SECRET_KEY: 'sk_test_mock' } }))
    mockStripeClient({})

    const { recordPromoCodeRedemption } = await import('./promoCodes.js')

    await recordPromoCodeRedemption({
      code: 'REGEN1MONTH',
      customerEmail: '1936034135@qq.com',
      stripeCheckoutSessionId: 'cs_live_example',
      stripePromotionCodeId: 'promo_1U8nt5GPXfP6Qy0mUafRop6k',
      stripeSubscriptionId: 'sub_1UA2wGGPXfP6Qy0mnqmElrDU',
    })

    const updatePayload = mockDb.update.mock.results[0]?.value.set.mock.calls[0]?.[0]

    expect(updatePayload).toMatchObject({
      isActive: false,
      stripeSyncStatus: 'inactive',
      timesRedeemed: 1,
    })
    expect(String(updatePayload?.stripeSyncError)).toContain('Redemption cap reached (1/1)')
  })
})
