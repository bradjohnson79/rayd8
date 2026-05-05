import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('subscription promo-code discount extraction', () => {
  it('extracts nested source promotion code details from a Stripe discount', async () => {
    vi.doMock('../db/client.js', () => ({ db: null }))
    vi.doMock('../env.js', () => ({ env: {} }))
    vi.doMock('../lib/clerk.js', () => ({ clerkClient: null }))
    vi.doMock('./admin/promoCodes.js', () => ({ recordPromoCodeRedemption: vi.fn() }))

    const { extractDiscountDetails } = await import('./subscriptions.js')
    const details = extractDiscountDetails(
      {
        source: {
          coupon: { id: 'coupon_123' },
          promotion_code: { id: 'promo_123' },
        },
      },
      2500,
    )

    expect(details).toEqual({
      amountDiscounted: 2500,
      couponId: 'coupon_123',
      promotionCodeId: 'promo_123',
    })
  })

  it('finds discount details from checkout total details breakdown first', async () => {
    vi.doMock('../db/client.js', () => ({ db: null }))
    vi.doMock('../env.js', () => ({ env: {} }))
    vi.doMock('../lib/clerk.js', () => ({ clerkClient: null }))
    vi.doMock('./admin/promoCodes.js', () => ({ recordPromoCodeRedemption: vi.fn() }))

    const { getCheckoutDiscountDetails } = await import('./subscriptions.js')
    const details = getCheckoutDiscountDetails({
      id: 'cs_123',
      total_details: {
        amount_discount: 1500,
        breakdown: {
          discounts: [
            {
              amount: 1500,
              discount: {
                source: {
                  coupon: 'coupon_breakdown',
                  promotion_code: 'promo_breakdown',
                },
              },
            },
          ],
        },
      },
    } as never)

    expect(details).toEqual({
      amountDiscounted: 1500,
      couponId: 'coupon_breakdown',
      promotionCodeId: 'promo_breakdown',
    })
  })
})
