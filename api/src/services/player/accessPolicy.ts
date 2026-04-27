import type { InferSelectModel } from 'drizzle-orm'
import { usageSessions } from '../../db/schema.js'
import {
  MAX_HEARTBEAT_SECONDS,
  PLAN_LIMITS,
  type UsagePeriodSummary,
} from './usagePeriods.js'

export type StoredPlan = 'free' | 'premium' | 'regen' | 'amrita'
export type AppPlan = StoredPlan
export type Experience = 'expansion' | 'premium' | 'regen'
export type SessionType = Experience | 'amrita'
export type UsageBlockReason =
  | 'free_expansion_limit_reached'
  | 'free_premium_limit_reached'
  | 'free_regen_limit_reached'
  | 'plan_upgrade_required'
  | 'premium_allowance_reached'
  | 'regen_legacy_allowance_reached'
  | 'regen_total_limit_reached'

export const PREMIUM_ALLOWANCE = {
  free: 60,
  premium: 30000,
  regen: 15000,
  amrita: 30000,
} as const

export const REGEN_ALLOWANCE = {
  regen: 15000,
  amrita: 30000,
} as const

export interface ExperienceAccessSummary {
  allowed: boolean
  blockReason: UsageBlockReason | null
  experience: Experience
  isBlocked: boolean
  limitMinutes: number | null
  limitSeconds: number | null
  minutesRemaining: number | null
  minutesUsed: number
  remainingSeconds: number | null
  state: 'active' | 'blocked' | 'soft_denied'
  usage: UsagePeriodSummary | null
  usagePercent: number | null
  usedSeconds: number
  warningState: 'none' | 'approaching_limit'
}

export function toAppPlan(plan: StoredPlan | null | undefined): AppPlan {
  return plan ?? 'free'
}

export function getExperienceFromSessionType(sessionType: SessionType): Experience {
  if (sessionType === 'premium') {
    return 'premium'
  }

  if (sessionType === 'regen') {
    return 'regen'
  }

  return 'expansion'
}

function toUsageMinutes(seconds: number) {
  return seconds / 60
}

function summarizeUnlimitedAccess(input: {
  experience: Experience
  minutesUsed: number
  usage: UsagePeriodSummary | null
  usedSeconds: number
}) {
  return {
    allowed: true,
    blockReason: null,
    experience: input.experience,
    isBlocked: false,
    limitMinutes: null,
    limitSeconds: null,
    minutesRemaining: null,
    minutesUsed: input.minutesUsed,
    remainingSeconds: null,
    state: 'active',
    usage: input.usage,
    usagePercent: null,
    usedSeconds: input.usedSeconds,
    warningState: 'none',
  } satisfies ExperienceAccessSummary
}

function summarizeLimitedAccess(input: {
  blockReason: UsageBlockReason
  experience: Experience
  limitSeconds: number
  usage: UsagePeriodSummary | null
  usedSeconds: number
}) {
  const remainingSeconds = Math.max(0, input.limitSeconds - input.usedSeconds)
  const allowed = remainingSeconds >= MAX_HEARTBEAT_SECONDS
  const usagePercent = input.limitSeconds
    ? Math.min(100, (input.usedSeconds / input.limitSeconds) * 100)
    : null

  return {
    allowed,
    blockReason: allowed ? null : input.blockReason,
    experience: input.experience,
    isBlocked: !allowed,
    limitMinutes: toUsageMinutes(input.limitSeconds),
    limitSeconds: input.limitSeconds,
    minutesRemaining: toUsageMinutes(remainingSeconds),
    minutesUsed: toUsageMinutes(input.usedSeconds),
    remainingSeconds,
    state: allowed ? 'active' : 'blocked',
    usage: input.usage,
    usagePercent,
    usedSeconds: input.usedSeconds,
    warningState: usagePercent !== null && usagePercent >= 90 && allowed ? 'approaching_limit' : 'none',
  } satisfies ExperienceAccessSummary
}

export function summarizeExperienceAccess(input: {
  experience: Experience
  isAdmin?: boolean
  minutesUsed: number
  plan: AppPlan
  usage?: UsagePeriodSummary | null
}): ExperienceAccessSummary {
  const legacyUsedSeconds = Math.max(0, Math.floor(input.minutesUsed * 60))

  if (input.isAdmin) {
    return summarizeUnlimitedAccess({
      experience: input.experience,
      minutesUsed: input.minutesUsed,
      usage: input.usage ?? null,
      usedSeconds: legacyUsedSeconds,
    })
  }

  if (input.plan === 'free') {
    const usage = input.usage ?? null
    const usedSeconds =
      input.experience === 'expansion'
        ? usage?.expansionUsedSeconds ?? 0
        : input.experience === 'premium'
          ? usage?.premiumUsedSeconds ?? 0
          : usage?.regenUsedSeconds ?? 0
    const blockReason =
      input.experience === 'expansion'
        ? 'free_expansion_limit_reached'
        : input.experience === 'premium'
          ? 'free_premium_limit_reached'
          : 'free_regen_limit_reached'

    return summarizeLimitedAccess({
      blockReason,
      experience: input.experience,
      limitSeconds: PLAN_LIMITS.free[input.experience],
      usage,
      usedSeconds,
    })
  }

  if (input.plan === 'regen') {
    return summarizeLimitedAccess({
      blockReason: 'regen_total_limit_reached',
      experience: input.experience,
      limitSeconds: PLAN_LIMITS.regen.total,
      usage: input.usage ?? null,
      usedSeconds: input.usage?.totalUsedSeconds ?? 0,
    })
  }

  if (input.experience === 'expansion') {
    return summarizeUnlimitedAccess({
      experience: input.experience,
      minutesUsed: input.minutesUsed,
      usage: input.usage ?? null,
      usedSeconds: legacyUsedSeconds,
    })
  }

  if (input.experience === 'regen' && input.plan !== 'amrita') {
    return {
      allowed: false,
      blockReason: 'plan_upgrade_required',
      experience: input.experience,
      isBlocked: true,
      limitMinutes: null,
      limitSeconds: null,
      minutesRemaining: 0,
      minutesUsed: input.minutesUsed,
      remainingSeconds: 0,
      state: 'blocked',
      usage: input.usage ?? null,
      usagePercent: null,
      usedSeconds: legacyUsedSeconds,
      warningState: 'none',
    }
  }

  const limitMinutes =
    input.experience === 'premium'
      ? PREMIUM_ALLOWANCE[input.plan]
      : REGEN_ALLOWANCE[input.plan as keyof typeof REGEN_ALLOWANCE]

  return summarizeLimitedAccess({
    blockReason:
      input.experience === 'premium' ? 'premium_allowance_reached' : 'regen_legacy_allowance_reached',
    experience: input.experience,
    limitSeconds: limitMinutes * 60,
    usage: input.usage ?? null,
    usedSeconds: legacyUsedSeconds,
  })
}

export function toEffectiveMinutes(
  record: Pick<
    InferSelectModel<typeof usageSessions>,
    'endedAt' | 'lastHeartbeat' | 'minutesWatched' | 'secondsWatched' | 'startedAt'
  >,
) {
  if (record.secondsWatched > 0) {
    return record.secondsWatched / 60
  }

  if (record.minutesWatched > 0) {
    return record.minutesWatched
  }

  const effectiveEnd = record.endedAt ?? record.lastHeartbeat

  return Math.max(0, Math.floor((effectiveEnd.getTime() - record.startedAt.getTime()) / 60000))
}
