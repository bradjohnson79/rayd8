import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { affiliateCommissions, affiliateTrackingEvents, users } from '../../db/schema.js'
import {
  AFFILIATE_PAYOUT_THRESHOLD_USD,
  getAffiliatePayoutCutoffDate,
  getAffiliateNextPayoutDate,
  getDaysUntilAffiliatePayout,
} from '../affiliates/payoutSchedule.js'

export type AffiliateCommissionFilterStatus = 'all' | 'pending' | 'approved' | 'paid'

export interface AffiliateAdminFilters {
  endAt?: Date | null
  startAt?: Date | null
  status?: AffiliateCommissionFilterStatus
}

function isWithinRange(value: Date, filters: AffiliateAdminFilters) {
  if (filters.startAt && value < filters.startAt) {
    return false
  }

  if (filters.endAt && value > filters.endAt) {
    return false
  }

  return true
}

function matchesStatus(
  status: (typeof affiliateCommissions.$inferSelect)['status'],
  filterStatus: AffiliateCommissionFilterStatus,
) {
  return filterStatus === 'all' ? true : status === filterStatus
}

function escapeCsvValue(value: string | number | null) {
  if (value === null) {
    return ''
  }

  const stringValue = String(value)
  return /[",\n]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue
}

function maskEmail(email: string) {
  const [localPart, domainPart = ''] = email.split('@')

  if (!localPart) {
    return email
  }

  const visiblePrefix = localPart.slice(0, 1)
  return `${visiblePrefix}***@${domainPart}`
}

function getLeaderboardStatus(input: {
  pendingBalanceUsd: number
  rank: number
  totalReferrals: number
}) {
  if (input.rank <= 3) {
    return 'top_performer' as const
  }

  if (input.pendingBalanceUsd > 0 || input.totalReferrals >= 3) {
    return 'rising' as const
  }

  return 'active' as const
}

function getTrackingHealthStatus(
  latestValidation: (typeof affiliateTrackingEvents.$inferSelect) | undefined,
  recentWarnings: number,
) {
  if (!latestValidation) {
    return {
      label: 'Needs verification',
      message: 'No end-to-end affiliate validation has been recorded yet.',
      status: 'red' as const,
    }
  }

  if (latestValidation.result === 'success') {
    return {
      label: 'Healthy',
      message: 'Referral, Stripe, and commission tracking verified on the latest run.',
      status: 'green' as const,
    }
  }

  if (latestValidation.result === 'warning' || recentWarnings > 0) {
    return {
      label: 'Needs attention',
      message: 'Recent affiliate flow activity includes warnings. Review the latest verification details.',
      status: 'yellow' as const,
    }
  }

  return {
    label: 'Action required',
    message: 'Recent affiliate verification failed or Stripe sync errors were recorded.',
    status: 'red' as const,
  }
}

function buildAffiliateUserAggregate(input: {
  commissions: Array<(typeof affiliateCommissions.$inferSelect)>
  referredUsers: Array<(typeof users.$inferSelect)>
  user: typeof users.$inferSelect
}) {
  const aggregate = input.commissions.reduce(
    (summary, commission) => {
      summary.totalEarnedUsd += commission.amountUsd

      if (commission.status === 'pending') {
        summary.pendingBalanceUsd += commission.amountUsd
      } else if (commission.status === 'approved') {
        summary.approvedAmountUsd += commission.amountUsd
        summary.pendingBalanceUsd += commission.amountUsd
      } else if (commission.status === 'paid') {
        summary.totalPaidUsd += commission.amountUsd
        if (!summary.lastPayoutDate || commission.paidAt && commission.paidAt > summary.lastPayoutDate) {
          summary.lastPayoutDate = commission.paidAt
        }
      }

      return summary
    },
    {
      approvedAmountUsd: 0,
      lastPayoutDate: null as Date | null,
      pendingBalanceUsd: 0,
      totalEarnedUsd: 0,
      totalPaidUsd: 0,
    },
  )

  return {
    id: input.user.id,
    createdAt: input.user.createdAt,
    lastPayoutDate: aggregate.lastPayoutDate,
    payoutEligible: aggregate.pendingBalanceUsd >= AFFILIATE_PAYOUT_THRESHOLD_USD,
    pendingBalanceUsd: aggregate.pendingBalanceUsd,
    referralCode: input.user.referralCode,
    totalEarnedUsd: aggregate.totalEarnedUsd,
    totalPaidUsd: aggregate.totalPaidUsd,
    totalReferrals: input.referredUsers.length,
    userEmail: input.user.email,
  }
}

export async function getAdminAffiliateOverview(filters: AffiliateAdminFilters) {
  if (!db) {
    return {
      affiliates: [],
      overview: {
        approvedAmountUsd: 0,
        paidAmountUsd: 0,
        pendingAmountUsd: 0,
        totalAffiliates: 0,
        totalCommissions: 0,
        totalReferrals: 0,
      },
    }
  }

  const [userRows, commissionRows] = await Promise.all([
    db.select().from(users),
    db.select().from(affiliateCommissions).orderBy(desc(affiliateCommissions.createdAt)),
  ])

  const filteredCommissions = commissionRows.filter(
    (commission) =>
      matchesStatus(commission.status, filters.status ?? 'all') &&
      isWithinRange(commission.createdAt, filters),
  )
  const affiliateMap = new Map(
    userRows.map((user) => [
      user.id,
      {
        approvedAmountUsd: 0,
        paidAmountUsd: 0,
        pendingAmountUsd: 0,
        totalEarnedUsd: 0,
      },
    ]),
  )

  for (const commission of filteredCommissions) {
    const aggregate = affiliateMap.get(commission.affiliateUserId)

    if (!aggregate) {
      continue
    }

    aggregate.totalEarnedUsd += commission.amountUsd

    if (commission.status === 'pending') {
      aggregate.pendingAmountUsd += commission.amountUsd
    } else if (commission.status === 'approved') {
      aggregate.approvedAmountUsd += commission.amountUsd
    } else if (commission.status === 'paid') {
      aggregate.paidAmountUsd += commission.amountUsd
    }
  }

  const referralCounts = userRows.reduce(
    (map, user) => {
      if (user.referredByUserId) {
        map.set(user.referredByUserId, (map.get(user.referredByUserId) ?? 0) + 1)
      }

      return map
    },
    new Map<string, number>(),
  )

  const affiliates = userRows
    .map((user) => {
      const aggregate = affiliateMap.get(user.id)

      return {
        approvedAmountUsd: aggregate?.approvedAmountUsd ?? 0,
        createdAt: user.createdAt,
        email: user.email,
        paidAmountUsd: aggregate?.paidAmountUsd ?? 0,
        pendingAmountUsd: aggregate?.pendingAmountUsd ?? 0,
        referralCode: user.referralCode,
        referralCount: referralCounts.get(user.id) ?? 0,
        totalEarnedUsd: aggregate?.totalEarnedUsd ?? 0,
        userId: user.id,
      }
    })
    .filter((affiliate) => affiliate.referralCount > 0 || affiliate.totalEarnedUsd > 0)
    .sort((left, right) => {
      if (right.totalEarnedUsd !== left.totalEarnedUsd) {
        return right.totalEarnedUsd - left.totalEarnedUsd
      }

      return right.referralCount - left.referralCount
    })

  return {
    affiliates,
    overview: {
      approvedAmountUsd: filteredCommissions
        .filter((commission) => commission.status === 'approved')
        .reduce((total, commission) => total + commission.amountUsd, 0),
      paidAmountUsd: filteredCommissions
        .filter((commission) => commission.status === 'paid')
        .reduce((total, commission) => total + commission.amountUsd, 0),
      pendingAmountUsd: filteredCommissions
        .filter((commission) => commission.status === 'pending')
        .reduce((total, commission) => total + commission.amountUsd, 0),
      totalAffiliates: affiliates.length,
      totalCommissions: filteredCommissions.length,
      totalReferrals: userRows.filter((user) => user.referredByUserId).length,
    },
  }
}

export async function getAdminAffiliateSummary() {
  if (!db) {
    return {
      cards: {
        nextPayoutDate: getAffiliateNextPayoutDate().toISOString(),
        totalAffiliateRevenueGeneratedUsd: 0,
        totalCommissionsOwedUsd: 0,
        totalPaidOutUsd: 0,
      },
      payoutSchedule: {
        cutoffDate: getAffiliatePayoutCutoffDate().toISOString(),
        daysUntilNextPayout: getDaysUntilAffiliatePayout(),
        minimumPayoutThresholdUsd: AFFILIATE_PAYOUT_THRESHOLD_USD,
        nextPayoutDate: getAffiliateNextPayoutDate().toISOString(),
        payoutWindowLabel: 'First week of the following month',
      },
      tracking: {
        health: {
          label: 'Needs verification',
          message: 'No affiliate tracking data is available.',
          status: 'red',
        },
        lastVerifiedAffiliateFlow: {
          message: 'No verification run has been recorded yet.',
          result: 'warning',
          verifiedAt: null,
        },
        stripeSyncIntegrity: {
          attributedPayments: 0,
          commissionCreationRate: 0,
          metadataCoverageRate: 0,
          totalTrackedPayments: 0,
        },
      },
    }
  }

  const [commissions, trackingEvents] = await Promise.all([
    db.select().from(affiliateCommissions),
    db.select().from(affiliateTrackingEvents).orderBy(desc(affiliateTrackingEvents.createdAt)),
  ])
  const totals = commissions.reduce(
    (summary, commission) => {
      summary.totalAffiliateRevenueGeneratedUsd += commission.amountUsd

      if (commission.status === 'pending' || commission.status === 'approved') {
        summary.totalCommissionsOwedUsd += commission.amountUsd
      } else if (commission.status === 'paid') {
        summary.totalPaidOutUsd += commission.amountUsd
      }

      return summary
    },
    {
      totalAffiliateRevenueGeneratedUsd: 0,
      totalCommissionsOwedUsd: 0,
      totalPaidOutUsd: 0,
    },
  )
  const nextPayoutDate = getAffiliateNextPayoutDate()
  const paymentEvents = trackingEvents.filter((event) => event.eventType === 'stripe_payment_processed')
  const metadataCoveredPayments = paymentEvents.filter((event) => event.hasReferralMetadata).length
  const commissionCreatedPayments = trackingEvents.filter(
    (event) => event.eventType === 'commission_created',
  ).length
  const latestValidation = trackingEvents.find((event) => event.eventType === 'end_to_end_validation')
  const recentWarnings = trackingEvents.filter((event) => event.result === 'warning').length
  const trackingHealth = getTrackingHealthStatus(latestValidation, recentWarnings)

  const toRate = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0)

  return {
    cards: {
      nextPayoutDate: nextPayoutDate.toISOString(),
      ...totals,
    },
    payoutSchedule: {
      cutoffDate: getAffiliatePayoutCutoffDate().toISOString(),
      daysUntilNextPayout: getDaysUntilAffiliatePayout(),
      minimumPayoutThresholdUsd: AFFILIATE_PAYOUT_THRESHOLD_USD,
      nextPayoutDate: nextPayoutDate.toISOString(),
      payoutWindowLabel: 'First week of the following month',
    },
    tracking: {
      health: trackingHealth,
      lastVerifiedAffiliateFlow: {
        message: latestValidation?.message ?? 'No verification run has been recorded yet.',
        result: latestValidation?.result ?? 'warning',
        verifiedAt: latestValidation?.createdAt.toISOString() ?? null,
      },
      stripeSyncIntegrity: {
        attributedPayments: commissionCreatedPayments,
        commissionCreationRate: toRate(commissionCreatedPayments, paymentEvents.length),
        metadataCoverageRate: toRate(metadataCoveredPayments, paymentEvents.length),
        totalTrackedPayments: paymentEvents.length,
      },
    },
  }
}

export async function getAdminTopAffiliates() {
  if (!db) {
    return []
  }

  const [userRows, commissionRows] = await Promise.all([
    db.select().from(users),
    db.select().from(affiliateCommissions),
  ])
  const referredUsersByAffiliate = userRows.reduce(
    (map, user) => {
      if (!user.referredByUserId) {
        return map
      }

      const current = map.get(user.referredByUserId) ?? []
      current.push(user)
      map.set(user.referredByUserId, current)
      return map
    },
    new Map<string, Array<(typeof users.$inferSelect)>>(),
  )
  const commissionsByAffiliate = commissionRows.reduce(
    (map, commission) => {
      const current = map.get(commission.affiliateUserId) ?? []
      current.push(commission)
      map.set(commission.affiliateUserId, current)
      return map
    },
    new Map<string, Array<(typeof affiliateCommissions.$inferSelect)>>(),
  )

  return userRows
    .map((user) =>
      buildAffiliateUserAggregate({
        commissions: commissionsByAffiliate.get(user.id) ?? [],
        referredUsers: referredUsersByAffiliate.get(user.id) ?? [],
        user,
      }),
    )
    .filter((affiliate) => affiliate.totalReferrals > 0 || affiliate.totalEarnedUsd > 0)
    .sort((left, right) => {
      if (right.totalEarnedUsd !== left.totalEarnedUsd) {
        return right.totalEarnedUsd - left.totalEarnedUsd
      }

      return right.totalReferrals - left.totalReferrals
    })
    .slice(0, 10)
    .map((affiliate, index) => ({
      id: affiliate.id,
      lastPayoutDate: affiliate.lastPayoutDate ? affiliate.lastPayoutDate.toISOString() : null,
      maskedEmail: maskEmail(affiliate.userEmail),
      payoutEligible: affiliate.payoutEligible,
      pendingBalanceUsd: affiliate.pendingBalanceUsd,
      rank: index + 1,
      referralCode: affiliate.referralCode,
      status: getLeaderboardStatus({
        pendingBalanceUsd: affiliate.pendingBalanceUsd,
        rank: index + 1,
        totalReferrals: affiliate.totalReferrals,
      }),
      totalEarnedUsd: affiliate.totalEarnedUsd,
      totalPaidUsd: affiliate.totalPaidUsd,
      totalReferrals: affiliate.totalReferrals,
      userEmail: affiliate.userEmail,
    }))
}

export async function getAdminAffiliateCommissions(filters: AffiliateAdminFilters) {
  if (!db) {
    return []
  }

  const [userRows, commissionRows] = await Promise.all([
    db.select().from(users),
    db.select().from(affiliateCommissions).orderBy(desc(affiliateCommissions.createdAt)),
  ])
  const userMap = new Map(userRows.map((user) => [user.id, user]))

  return commissionRows
    .filter(
      (commission) =>
        matchesStatus(commission.status, filters.status ?? 'all') &&
        isWithinRange(commission.createdAt, filters),
    )
    .map((commission) => ({
      affiliateEmail: userMap.get(commission.affiliateUserId)?.email ?? 'Unknown affiliate',
      affiliateUserId: commission.affiliateUserId,
      amountUsd: commission.amountUsd,
      createdAt: commission.createdAt,
      eventId: commission.eventId,
      id: commission.id,
      paidAt: commission.paidAt,
      referredEmail: userMap.get(commission.referredUserId)?.email ?? 'Unknown member',
      referredUserId: commission.referredUserId,
      source: commission.source,
      status: commission.status,
      stripeCustomerId: commission.stripeCustomerId,
      stripeSubscriptionId: commission.stripeSubscriptionId,
    }))
}

export async function markAffiliateCommissionsPaid(commissionIds: string[]) {
  if (!db || commissionIds.length === 0) {
    return {
      commissions: [],
      totalPayoutAmountUsd: 0,
      updatedIds: [],
    }
  }

  const eligibleCommissions = await db
    .select()
    .from(affiliateCommissions)
    .where(inArray(affiliateCommissions.id, commissionIds))
  const commissionsToUpdate = eligibleCommissions.filter((commission) => commission.status !== 'paid')
  const paidAt = new Date()

  if (commissionsToUpdate.length === 0) {
    return {
      commissions: [],
      totalPayoutAmountUsd: 0,
      updatedIds: [],
    }
  }

  await db
    .update(affiliateCommissions)
    .set({
      paidAt,
      status: 'paid',
    })
    .where(inArray(affiliateCommissions.id, commissionsToUpdate.map((commission) => commission.id)))

  return {
    commissions: await getAdminAffiliateCommissions({ status: 'all' }),
    totalPayoutAmountUsd: commissionsToUpdate.reduce(
      (total, commission) => total + commission.amountUsd,
      0,
    ),
    updatedIds: commissionsToUpdate.map((commission) => commission.id),
  }
}

export async function buildAffiliateCommissionsCsv(filters: AffiliateAdminFilters) {
  const commissions = await getAdminAffiliateCommissions(filters)
  const rows = [
    [
      'Commission ID',
      'Affiliate Email',
      'Referred Email',
      'Amount USD Cents',
      'Status',
      'Source',
      'Event ID',
      'Stripe Customer ID',
      'Stripe Subscription ID',
      'Created At',
      'Paid At',
    ],
    ...commissions.map((commission) => [
      commission.id,
      commission.affiliateEmail,
      commission.referredEmail,
      commission.amountUsd,
      commission.status,
      commission.source,
      commission.eventId,
      commission.stripeCustomerId,
      commission.stripeSubscriptionId,
      commission.createdAt.toISOString(),
      commission.paidAt ? commission.paidAt.toISOString() : '',
    ]),
  ]

  return rows.map((row) => row.map((value) => escapeCsvValue(value ?? null)).join(',')).join('\n')
}

export async function getAffiliateUserEmail(userId: string) {
  if (!db) {
    return null
  }

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return user?.email ?? null
}
