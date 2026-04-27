import {
  summarizeExperienceAccess,
  type AppPlan,
  type Experience,
  type ExperienceAccessSummary,
} from './accessPolicy.js'
import { getUsagePeriodSummary, type UsagePeriodSummary } from './usagePeriods.js'
import { getExperienceMinutesUsed } from './usageTracking.js'

function toLegacyUsageSummary(input: {
  expansionMinutesUsed: number
  premiumMinutesUsed: number
  regenMinutesUsed: number
}): UsagePeriodSummary {
  const expansionUsedSeconds = Math.floor(input.expansionMinutesUsed * 60)
  const premiumUsedSeconds = Math.floor(input.premiumMinutesUsed * 60)
  const regenUsedSeconds = Math.floor(input.regenMinutesUsed * 60)

  return {
    expansionUsedSeconds,
    periodEnd: null,
    periodStart: null,
    periodType: null,
    premiumUsedSeconds,
    regenUsedSeconds,
    totalUsedSeconds: expansionUsedSeconds + premiumUsedSeconds + regenUsedSeconds,
  }
}

function getUsageMinutesForExperience(usage: UsagePeriodSummary, experience: Experience) {
  if (experience === 'expansion') {
    return usage.expansionUsedSeconds / 60
  }

  if (experience === 'premium') {
    return usage.premiumUsedSeconds / 60
  }

  return usage.regenUsedSeconds / 60
}

export async function getUsageSnapshotForUser(input: {
  plan: AppPlan
  role: 'admin' | 'member'
  userId: string
}) {
  if (input.plan === 'free' || input.plan === 'regen') {
    const usage = await getUsagePeriodSummary({
      plan: input.plan,
      userId: input.userId,
    })

    return {
      access: {
        expansion: summarizeExperienceAccess({
          experience: 'expansion',
          isAdmin: input.role === 'admin',
          minutesUsed: getUsageMinutesForExperience(usage, 'expansion'),
          plan: input.plan,
          usage,
        }),
        premium: summarizeExperienceAccess({
          experience: 'premium',
          isAdmin: input.role === 'admin',
          minutesUsed: getUsageMinutesForExperience(usage, 'premium'),
          plan: input.plan,
          usage,
        }),
        regen: summarizeExperienceAccess({
          experience: 'regen',
          isAdmin: input.role === 'admin',
          minutesUsed: getUsageMinutesForExperience(usage, 'regen'),
          plan: input.plan,
          usage,
        }),
      },
      usage,
    }
  }

  const [expansionMinutesUsed, premiumMinutesUsed, regenMinutesUsed] = await Promise.all([
    getExperienceMinutesUsed({
      experience: 'expansion',
      userId: input.userId,
    }),
    getExperienceMinutesUsed({
      experience: 'premium',
      userId: input.userId,
    }),
    getExperienceMinutesUsed({
      experience: 'regen',
      userId: input.userId,
    }),
  ])

  const usage = toLegacyUsageSummary({
    expansionMinutesUsed,
    premiumMinutesUsed,
    regenMinutesUsed,
  })

  return {
    access: {
      expansion: summarizeExperienceAccess({
        experience: 'expansion',
        isAdmin: input.role === 'admin',
        minutesUsed: expansionMinutesUsed,
        plan: input.plan,
        usage,
      }),
      premium: summarizeExperienceAccess({
        experience: 'premium',
        isAdmin: input.role === 'admin',
        minutesUsed: premiumMinutesUsed,
        plan: input.plan,
        usage,
      }),
      regen: summarizeExperienceAccess({
        experience: 'regen',
        isAdmin: input.role === 'admin',
        minutesUsed: regenMinutesUsed,
        plan: input.plan,
        usage,
      }),
    },
    usage,
  }
}

export async function getExperienceAccessForUser(input: {
  experience: Experience
  plan: AppPlan
  role: 'admin' | 'member'
  userId: string
}) {
  const snapshot = await getUsageSnapshotForUser({
    plan: input.plan,
    role: input.role,
    userId: input.userId,
  })

  return snapshot.access[input.experience] as ExperienceAccessSummary
}
