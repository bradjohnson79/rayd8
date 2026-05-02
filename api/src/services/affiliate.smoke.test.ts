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

function makeSelectOrderChain<T>(result: T) {
  return {
    from: vi.fn(() => ({
      orderBy: vi.fn().mockResolvedValue(result),
    })),
  }
}

function makeSelectFromChain<T>(result: T) {
  return {
    from: vi.fn().mockResolvedValue(result),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('affiliate smoke suite', () => {
  it('attaches a referral for an eligible new user and summarizes earnings totals', async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce(
          makeSelectLimitChain([
            {
              createdAt: new Date(),
              id: 'member_1',
              referredByUserId: null,
            },
          ]),
        )
        .mockReturnValueOnce(
          makeSelectLimitChain([
            {
              id: 'affiliate_1',
              referralCode: 'AFFCODE1',
            },
          ]),
        )
        .mockReturnValueOnce(
          makeSelectLimitChain([
            {
              id: 'affiliate_1',
              referralCode: 'AFFCODE1',
            },
          ]),
        )
        .mockReturnValueOnce(makeSelectWhereChain([{ id: 'referred_a' }, { id: 'referred_b' }]))
        .mockReturnValueOnce(
          makeSelectWhereChain([
            { amountUsd: 600, status: 'approved' },
            { amountUsd: 600, status: 'paid' },
          ]),
        ),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: updateWhere,
        })),
      })),
    }

    vi.doMock('../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../env.js', () => ({ env: { APP_URL: 'https://rayd8.app' } }))

    const { attachReferralToUser, getReferralSummaryForUser } = await import('./referrals.js')

    const attachResult = await attachReferralToUser({
      referralCode: 'affcode1',
      userId: 'member_1',
    })

    expect(attachResult.status).toBe('attached')
    expect(updateWhere).toHaveBeenCalledTimes(1)

    const summary = await getReferralSummaryForUser('affiliate_1')
    expect(summary.referralCode).toBe('AFFCODE1')
    expect(summary.referralCount).toBe(2)
    expect(summary.totalEarnedUsd).toBe(1200)
    expect(summary.referralLink).toBe('https://rayd8.app/signup?ref=AFFCODE1')
  })

  it('marks only approved commissions as paid and returns the payout total', async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const mockDb = {
      select: vi
        .fn()
        .mockReturnValueOnce(
          makeSelectWhereChain([
            { amountUsd: 600, id: 'c1', status: 'approved' },
            { amountUsd: 600, id: 'c2', status: 'paid' },
          ]),
        )
        .mockReturnValueOnce(
          makeSelectFromChain([
            { email: 'affiliate@rayd8.app', id: 'affiliate_1' },
            { email: 'member@rayd8.app', id: 'member_1' },
          ]),
        )
        .mockReturnValueOnce(
          makeSelectOrderChain([
            {
              affiliateUserId: 'affiliate_1',
              amountUsd: 600,
              createdAt: new Date('2026-05-02T12:00:00.000Z'),
              eventId: 'evt_1',
              id: 'c1',
              paidAt: new Date('2026-05-02T13:00:00.000Z'),
              referredUserId: 'member_1',
              source: 'stripe_invoice',
              status: 'paid',
              stripeCustomerId: 'cus_1',
              stripeSubscriptionId: 'sub_1',
            },
          ]),
        ),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: updateWhere,
        })),
      })),
    }

    vi.doMock('../db/client.js', () => ({ db: mockDb }))

    const { markAffiliateCommissionsPaid } = await import('./admin/affiliatesAdmin.js')
    const result = await markAffiliateCommissionsPaid(['c1', 'c2'])

    expect(result.totalPayoutAmountUsd).toBe(600)
    expect(result.updatedIds).toEqual(['c1'])
    expect(updateWhere).toHaveBeenCalledTimes(1)
    expect(result.commissions[0]?.status).toBe('paid')
  })

  it('creates a commission only for the first successful subscription payment', async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined)
    const insertValues = vi.fn(() => ({
      onConflictDoNothing,
    }))
    const mockDb = {
      insert: vi.fn(() => ({
        values: insertValues,
      })),
      select: vi.fn().mockReturnValue(
        makeSelectLimitChain([
          {
            id: 'member_1',
            referredByUserId: 'affiliate_1',
          },
        ]),
      ),
    }

    vi.doMock('../db/client.js', () => ({ db: mockDb }))
    vi.doMock('../env.js', () => ({ env: {} }))
    vi.doMock('../lib/clerk.js', () => ({ clerkClient: null }))

    const { createAffiliateCommissionForSubscriptionCreate } = await import('./subscriptions.js')

    const skipped = await createAffiliateCommissionForSubscriptionCreate({
      billingReason: 'subscription_cycle',
      eventId: 'evt_skip',
      invoiceId: 'in_skip',
      plan: 'regen',
      stripeCustomerId: 'cus_skip',
      stripeSubscriptionId: 'sub_skip',
      userId: 'member_1',
    })
    const created = await createAffiliateCommissionForSubscriptionCreate({
      billingReason: 'subscription_create',
      eventId: 'evt_create',
      invoiceId: 'in_create',
      plan: 'regen',
      stripeCustomerId: 'cus_create',
      stripeSubscriptionId: 'sub_create',
      userId: 'member_1',
    })

    expect(skipped.created).toBe(false)
    expect(created.created).toBe(true)
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        affiliateUserId: 'affiliate_1',
        amountUsd: 600,
        eventId: 'evt_create',
        referredUserId: 'member_1',
        stripeSubscriptionId: 'sub_create',
      }),
    )
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1)
  })
})
