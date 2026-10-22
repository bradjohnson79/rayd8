import { describe, expect, it } from 'vitest'
import {
  billingReviewFromCounts,
  subscriptionCountsAsCheckoutOverlap,
} from './billingConflictReview.js'

describe('abandoned checkouts do not block a new purchase', () => {
  it('ignores incomplete and expired rows when counting overlaps', () => {
    const abandoned = ['incomplete', 'incomplete_expired', 'canceled']

    for (const status of abandoned) {
      expect(subscriptionCountsAsCheckoutOverlap(status)).toBe(false)
    }

    expect(subscriptionCountsAsCheckoutOverlap('active')).toBe(true)
    expect(subscriptionCountsAsCheckoutOverlap('trialing')).toBe(true)
    expect(subscriptionCountsAsCheckoutOverlap('past_due')).toBe(true)
    expect(subscriptionCountsAsCheckoutOverlap('unpaid')).toBe(true)
  })

  it('does not require review for two unpaid checkouts on one customer', () => {
    const review = billingReviewFromCounts({
      billingConflictFlag: false,
      distinctCustomerCount: 1,
      overlappingSubscriptionCount: 0,
    })

    expect(review.reviewRequired).toBe(false)
  })

  it('requires review when two live subscriptions overlap', () => {
    const review = billingReviewFromCounts({
      billingConflictFlag: false,
      distinctCustomerCount: 1,
      overlappingSubscriptionCount: 2,
    })

    expect(review.reviewRequired).toBe(true)
    expect(review.reasons).toContain('overlapping_manageable_subscriptions')
  })
})
