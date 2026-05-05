import { beforeEach, describe, expect, it, vi } from 'vitest'

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

function makeUpdateReturningChain<T>(result: T) {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue(result),
      })),
    })),
  }
}

function makePromoCode(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date('2026-05-01T00:00:00.000Z')

  return {
    amountOff: null,
    appliesToPlan: 'regen',
    archivedAt: null,
    code: 'REGEN25',
    createdAt: now,
    currency: 'usd',
    description: null,
    discountType: 'percent',
    duration: 'once',
    durationInMonths: null,
    expiresAt: null,
    id: 'promo_1',
    isActive: true,
    maxRedemptions: null,
    name: 'REGEN 25',
    percentOff: 25,
    stripeCouponId: null,
    stripeEnvironment: 'test',
    stripePromotionCodeId: null,
    stripeSyncError: null,
    stripeSyncStatus: 'missing',
    timesRedeemed: 0,
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

describe('admin promo codes', () => {
  it('rejects create when Stripe already has an active promotion code', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue(makeSelectLimitChain([])),
    }
    const mockStripe = {
      promotionCodes: {
        list: vi.fn().mockResolvedValue({
          data: [{ active: true, code: 'REGEN25', id: 'promo_stripe_1' }],
        }),
      },
    }

    vi.doMock('../../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../../env.js', () => ({ env: { STRIPE_SECRET_KEY: 'sk_test_mock' } }))
    mockStripeClient(mockStripe)

    const { createPromoCode } = await import('./promoCodes.js')

    await expect(
      createPromoCode({
        code: 'regen25',
        discountType: 'percent',
        duration: 'once',
        name: 'REGEN 25',
        percentOff: 25,
      }),
    ).rejects.toThrow('An active Stripe promotion code with code REGEN25 already exists.')
  })

  it('links recreate-if-missing to a matching active Stripe promotion code', async () => {
    const existingPromo = makePromoCode()
    const updatedPromo = makePromoCode({
      stripeCouponId: 'coupon_stripe_1',
      stripePromotionCodeId: 'promo_stripe_1',
      stripeSyncStatus: 'synced',
      timesRedeemed: 2,
    })
    const update = vi.fn().mockReturnValue(makeUpdateReturningChain([updatedPromo]))
    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce(makeSelectLimitChain([existingPromo]))
        .mockReturnValueOnce(makeSelectWhereChain([{ count: 2 }])),
      update,
    }
    const mockStripe = {
      coupons: {
        retrieve: vi.fn().mockResolvedValue({
          amount_off: null,
          duration: 'once',
          duration_in_months: null,
          id: 'coupon_stripe_1',
          max_redemptions: null,
          percent_off: 25,
          redeem_by: null,
        }),
      },
      promotionCodes: {
        list: vi.fn().mockResolvedValue({
          data: [{ active: true, code: 'REGEN25', coupon: { id: 'coupon_stripe_1' }, id: 'promo_stripe_1' }],
        }),
      },
    }

    vi.doMock('../../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../../env.js', () => ({ env: { STRIPE_SECRET_KEY: 'sk_test_mock' } }))
    mockStripeClient(mockStripe)

    const { recreateMissingPromoCode } = await import('./promoCodes.js')
    const result = await recreateMissingPromoCode('promo_1')

    expect(result?.stripe_coupon_id).toBe('coupon_stripe_1')
    expect(result?.stripe_promotion_code_id).toBe('promo_stripe_1')
    expect(result?.stripe_sync_status).toBe('synced')
    expect(mockStripe.promotionCodes.list).toHaveBeenCalledWith({
      active: true,
      code: 'REGEN25',
      limit: 1,
    })
    expect(mockStripe.coupons.retrieve).toHaveBeenCalledWith('coupon_stripe_1')
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('rejects recreate-if-missing when a same-code Stripe promotion has different settings', async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue(makeSelectLimitChain([makePromoCode()])),
      update: vi.fn(),
    }
    const mockStripe = {
      coupons: {
        retrieve: vi.fn().mockResolvedValue({
          amount_off: null,
          duration: 'once',
          duration_in_months: null,
          id: 'coupon_stripe_1',
          max_redemptions: null,
          percent_off: 50,
          redeem_by: null,
        }),
      },
      promotionCodes: {
        list: vi.fn().mockResolvedValue({
          data: [{ active: true, code: 'REGEN25', coupon: { id: 'coupon_stripe_1' }, id: 'promo_stripe_1' }],
        }),
      },
    }

    vi.doMock('../../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../../env.js', () => ({ env: { STRIPE_SECRET_KEY: 'sk_test_mock' } }))
    mockStripeClient(mockStripe)

    const { recreateMissingPromoCode } = await import('./promoCodes.js')

    await expect(recreateMissingPromoCode('promo_1')).rejects.toThrow(
      'Promo code REGEN25 already exists in Stripe with different settings.',
    )
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})
