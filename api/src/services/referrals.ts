import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { env } from '../env.js'
import { affiliateCommissions, referralSessions, users } from '../db/schema.js'
import {
  AFFILIATE_PAYOUT_THRESHOLD_USD,
  getAffiliateNextPayoutDate,
  getDaysUntilAffiliatePayout,
} from './affiliates/payoutSchedule.js'
import { recordAffiliateTrackingEvent } from './affiliates/tracking.js'

const REFERRAL_ATTACH_WINDOW_MS = 10 * 60 * 1000

export type ReferralAttachStatus =
  | 'attached'
  | 'already_attached'
  | 'already_referred'
  | 'invalid_code'
  | 'self_referral'
  | 'too_old'

export interface AttachReferralResult {
  referrerUserId: string | null
  status: ReferralAttachStatus
}

export function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase()
}

export async function createReferralSession(input: {
  ip?: string | null
  referralCode: string
  userAgent?: string | null
}) {
  if (!db) {
    return null
  }

  const referralCode = normalizeReferralCode(input.referralCode)

  if (!referralCode) {
    return null
  }

  const [session] = await db
    .insert(referralSessions)
    .values({
      ip: input.ip?.trim() || null,
      referralCode,
      userAgent: input.userAgent?.trim() || null,
    })
    .returning()

  return session
}

export async function attachReferralToUser(input: {
  referralCode: string
  userId: string
}): Promise<AttachReferralResult> {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  const referralCode = normalizeReferralCode(input.referralCode)
  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)

  if (!user) {
    throw new Error('User not found for referral attachment.')
  }

  const [referrer] = await db.select().from(users).where(eq(users.referralCode, referralCode)).limit(1)

  await recordAffiliateTrackingEvent({
    eventType: 'referral_detected',
    message: `Referral detected -> ${referralCode}`,
    referralCode,
    referredUserId: input.userId,
    result: referrer ? 'success' : 'warning',
  })

  if (!referrer) {
    return {
      referrerUserId: null,
      status: 'invalid_code',
    }
  }

  if (referrer.id === user.id) {
    return {
      referrerUserId: referrer.id,
      status: 'self_referral',
    }
  }

  if (user.referredByUserId) {
    return {
      referrerUserId: user.referredByUserId,
      status: user.referredByUserId === referrer.id ? 'already_attached' : 'already_referred',
    }
  }

  if (Date.now() - user.createdAt.getTime() > REFERRAL_ATTACH_WINDOW_MS) {
    return {
      referrerUserId: null,
      status: 'too_old',
    }
  }

  await db
    .update(users)
    .set({ referredByUserId: referrer.id })
    .where(eq(users.id, user.id))

  await recordAffiliateTrackingEvent({
    affiliateUserId: referrer.id,
    eventType: 'user_linked',
    message: 'User linked to referral',
    referralCode,
    referredUserId: user.id,
    result: 'success',
  })

  return {
    referrerUserId: referrer.id,
    status: 'attached',
  }
}

export async function getAffiliateAttributionForUser(userId: string) {
  if (!db) {
    return null
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!user?.referredByUserId) {
    return null
  }

  const [referrer] = await db.select().from(users).where(eq(users.id, user.referredByUserId)).limit(1)

  if (!referrer) {
    return null
  }

  return {
    referralCode: referrer.referralCode,
    referrerUserId: referrer.id,
    referredUserId: user.id,
  }
}

export async function getReferralSummaryForUser(userId: string) {
  if (!db) {
    return {
      amountUntilPayoutThresholdUsd: AFFILIATE_PAYOUT_THRESHOLD_USD,
      approvedAmountUsd: 0,
      approvedCount: 0,
      daysUntilNextPayout: getDaysUntilAffiliatePayout(),
      lastPayoutDate: null,
      paidAmountUsd: 0,
      paidCount: 0,
      payoutEligible: false,
      payoutThresholdUsd: AFFILIATE_PAYOUT_THRESHOLD_USD,
      pendingBalanceUsd: 0,
      pendingAmountUsd: 0,
      pendingCount: 0,
      nextPayoutDate: getAffiliateNextPayoutDate().toISOString(),
      referralCode: '',
      referralCount: 0,
      referralLink: `${env.APP_URL}/signup`,
      totalEarnedUsd: 0,
    }
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!user) {
    throw new Error('User not found for referral summary.')
  }

  const referredUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referredByUserId, userId))
  const commissions = await db
    .select()
    .from(affiliateCommissions)
    .where(eq(affiliateCommissions.affiliateUserId, userId))

  const totals = commissions.reduce(
    (summary, commission) => {
      summary.totalEarnedUsd += commission.amountUsd

      if (commission.status === 'pending') {
        summary.pendingAmountUsd += commission.amountUsd
        summary.pendingCount += 1
      } else if (commission.status === 'approved') {
        summary.approvedAmountUsd += commission.amountUsd
        summary.approvedCount += 1
      } else if (commission.status === 'paid') {
        summary.paidAmountUsd += commission.amountUsd
        summary.paidCount += 1
        if (!summary.lastPayoutDate || commission.paidAt && commission.paidAt > summary.lastPayoutDate) {
          summary.lastPayoutDate = commission.paidAt
        }
      }

      return summary
    },
    {
      lastPayoutDate: null as Date | null,
      approvedAmountUsd: 0,
      approvedCount: 0,
      paidAmountUsd: 0,
      paidCount: 0,
      pendingAmountUsd: 0,
      pendingCount: 0,
      totalEarnedUsd: 0,
    },
  )

  const pendingBalanceUsd = totals.pendingAmountUsd + totals.approvedAmountUsd
  const payoutEligible = pendingBalanceUsd >= AFFILIATE_PAYOUT_THRESHOLD_USD
  const nextPayoutDate = getAffiliateNextPayoutDate()

  return {
    ...totals,
    amountUntilPayoutThresholdUsd: Math.max(AFFILIATE_PAYOUT_THRESHOLD_USD - pendingBalanceUsd, 0),
    daysUntilNextPayout: getDaysUntilAffiliatePayout(),
    lastPayoutDate: totals.lastPayoutDate ? totals.lastPayoutDate.toISOString() : null,
    nextPayoutDate: nextPayoutDate.toISOString(),
    payoutEligible,
    payoutThresholdUsd: AFFILIATE_PAYOUT_THRESHOLD_USD,
    pendingBalanceUsd,
    referralCode: user.referralCode,
    referralCount: referredUsers.length,
    referralLink: `${env.APP_URL}/signup?ref=${encodeURIComponent(user.referralCode)}`,
  }
}
