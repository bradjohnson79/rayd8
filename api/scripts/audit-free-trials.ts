import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { usagePeriods, users } from '../src/db/schema.js'

const TRIAL_DAYS = 30
const TRIAL_HOURS = 35
const HOUR_IN_SECONDS = 60 * 60
const DAY_MS = 24 * 60 * 60 * 1000
const START_DRIFT_MS = 5 * 60 * 1000
const HOURS_EPSILON = 0.001
const FAR_FUTURE_PERIOD_END = new Date('9999-12-31T23:59:59.999Z')

type FreeUser = typeof users.$inferSelect
type UsagePeriod = typeof usagePeriods.$inferSelect

interface UserAudit {
  canonicalUsageHours: number
  createdAt: Date
  displayedRemainingHours: number
  email: string
  enforcedRemainingHours: number
  id: string
  issues: string[]
  periodCount: number
  plan: 'free'
  trialEndsAt: Date | null
  trialHoursUsed: number
  trialStartedAt: Date | null
  totalUsageHours: number
}

interface RepairPlan {
  canonicalUsage?: {
    expansionSeconds: number
    premiumSeconds: number
    regenSeconds: number
    totalHours: number
  }
  trialDates?: {
    trialEndsAt: string
    trialStartedAt: string
  }
  trialHoursUsed?: number
  userId: string
}

function parseArgs() {
  const args = new Set(process.argv.slice(2))

  return {
    fix: args.has('--fix'),
  }
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

function roundHours(value: number) {
  return Math.round(value * 1000) / 1000
}

function hoursFromSeconds(seconds: number) {
  return roundHours(seconds / HOUR_IN_SECONDS)
}

function getTotalSeconds(period: Pick<UsagePeriod, 'expansionSeconds' | 'premiumSeconds' | 'regenSeconds'>) {
  return period.expansionSeconds + period.premiumSeconds + period.regenSeconds
}

function isSameTimestamp(left: Date, right: Date) {
  return left.getTime() === right.getTime()
}

function isCanonicalPeriod(user: FreeUser, period: UsagePeriod) {
  return period.periodType === 'lifetime' && isSameTimestamp(period.periodStart, user.createdAt)
}

function getIssueSummary(audits: UserAudit[]) {
  const summary = new Map<string, number>()

  for (const audit of audits) {
    for (const issue of audit.issues) {
      summary.set(issue, (summary.get(issue) ?? 0) + 1)
    }
  }

  return Object.fromEntries([...summary.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

function buildAuditForUser(input: {
  now: Date
  periods: UsagePeriod[]
  user: FreeUser
}): UserAudit {
  const issues: string[] = []
  const canonicalPeriod = input.periods.find((period) => isCanonicalPeriod(input.user, period))
  const totalUsageSeconds = input.periods.reduce((total, period) => total + getTotalSeconds(period), 0)
  const canonicalUsageSeconds = canonicalPeriod ? getTotalSeconds(canonicalPeriod) : 0
  const totalUsageHours = hoursFromSeconds(totalUsageSeconds)
  const canonicalUsageHours = hoursFromSeconds(canonicalUsageSeconds)
  const enforcedUsageHours = Math.max(input.user.trialHoursUsed, totalUsageHours)
  const displayedRemainingHours = roundHours(Math.max(0, TRIAL_HOURS - canonicalUsageHours))
  const enforcedRemainingHours = roundHours(Math.max(0, TRIAL_HOURS - enforcedUsageHours))

  if (!input.user.trialStartedAt) {
    issues.push('missing_trial_started_at')
  }

  if (!input.user.trialEndsAt) {
    issues.push('missing_trial_ends_at')
  }

  if (input.user.trialStartedAt && input.user.trialEndsAt) {
    const expectedTrialEnd = addDays(input.user.trialStartedAt, TRIAL_DAYS)

    if (input.user.trialEndsAt.getTime() > expectedTrialEnd.getTime()) {
      issues.push('trial_window_longer_than_30_days')
    }

    if (input.user.trialStartedAt.getTime() > input.user.createdAt.getTime() + START_DRIFT_MS) {
      issues.push('trial_started_after_account_creation')
    }
  }

  if (input.user.createdAt.getTime() <= input.now.getTime() - TRIAL_DAYS * DAY_MS) {
    const hasActiveWindow = !input.user.trialEndsAt || input.user.trialEndsAt.getTime() > input.now.getTime()

    if (hasActiveWindow) {
      issues.push('free_user_older_than_30_days_with_active_looking_access')
    }
  }

  if (input.periods.length > 1) {
    issues.push('multiple_usage_periods')
  }

  if (input.periods.some((period) => period.periodType === 'billing_cycle')) {
    issues.push('free_user_has_billing_cycle_usage_period')
  }

  if (!canonicalPeriod && input.periods.length > 0) {
    issues.push('missing_canonical_lifetime_usage_period')
  }

  if (canonicalUsageSeconds < totalUsageSeconds) {
    issues.push('usage_split_outside_canonical_lifetime_period')
  }

  if (displayedRemainingHours !== enforcedRemainingHours) {
    issues.push('displayed_remaining_differs_from_enforced_remaining')
  }

  if (input.user.trialHoursUsed + HOURS_EPSILON < totalUsageHours) {
    issues.push('trial_hours_less_than_total_usage')
  }

  return {
    canonicalUsageHours,
    createdAt: input.user.createdAt,
    displayedRemainingHours,
    email: input.user.email,
    enforcedRemainingHours,
    id: input.user.id,
    issues,
    periodCount: input.periods.length,
    plan: 'free',
    trialEndsAt: input.user.trialEndsAt,
    trialHoursUsed: roundHours(input.user.trialHoursUsed),
    trialStartedAt: input.user.trialStartedAt,
    totalUsageHours,
  }
}

function buildRepairPlanForUser(input: {
  audit: UserAudit
  periods: UsagePeriod[]
  user: FreeUser
}): RepairPlan | null {
  const repair: RepairPlan = {
    userId: input.user.id,
  }
  const issues = new Set(input.audit.issues)

  if (
    issues.has('missing_trial_started_at') ||
    issues.has('missing_trial_ends_at') ||
    issues.has('trial_started_after_account_creation')
  ) {
    repair.trialDates = {
      trialEndsAt: addDays(input.user.createdAt, TRIAL_DAYS).toISOString(),
      trialStartedAt: input.user.createdAt.toISOString(),
    }
  } else if (issues.has('trial_window_longer_than_30_days') && input.user.trialStartedAt) {
    repair.trialDates = {
      trialEndsAt: addDays(input.user.trialStartedAt, TRIAL_DAYS).toISOString(),
      trialStartedAt: input.user.trialStartedAt.toISOString(),
    }
  }

  if (
    issues.has('multiple_usage_periods') ||
    issues.has('free_user_has_billing_cycle_usage_period') ||
    issues.has('missing_canonical_lifetime_usage_period') ||
    issues.has('usage_split_outside_canonical_lifetime_period')
  ) {
    repair.canonicalUsage = input.periods.reduce(
      (total, period) => ({
        expansionSeconds: total.expansionSeconds + period.expansionSeconds,
        premiumSeconds: total.premiumSeconds + period.premiumSeconds,
        regenSeconds: total.regenSeconds + period.regenSeconds,
        totalHours: hoursFromSeconds(
          total.expansionSeconds +
            period.expansionSeconds +
            total.premiumSeconds +
            period.premiumSeconds +
            total.regenSeconds +
            period.regenSeconds,
        ),
      }),
      {
        expansionSeconds: 0,
        premiumSeconds: 0,
        regenSeconds: 0,
        totalHours: 0,
      },
    )
  }

  if (issues.has('trial_hours_less_than_total_usage')) {
    repair.trialHoursUsed = Math.min(TRIAL_HOURS, input.audit.totalUsageHours)
  } else if (repair.canonicalUsage && input.user.trialHoursUsed < repair.canonicalUsage.totalHours) {
    repair.trialHoursUsed = Math.min(TRIAL_HOURS, repair.canonicalUsage.totalHours)
  }

  return repair.trialDates || repair.canonicalUsage || typeof repair.trialHoursUsed === 'number'
    ? repair
    : null
}

async function applyRepairPlan(input: {
  repairs: RepairPlan[]
  usersById: Map<string, FreeUser>
}) {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  for (const repair of input.repairs) {
    const user = input.usersById.get(repair.userId)

    if (!user) {
      continue
    }

    if (repair.trialDates || typeof repair.trialHoursUsed === 'number') {
      await db
        .update(users)
        .set({
          ...(repair.trialDates
            ? {
                trialEndsAt: new Date(repair.trialDates.trialEndsAt),
                trialStartedAt: new Date(repair.trialDates.trialStartedAt),
              }
            : {}),
          ...(typeof repair.trialHoursUsed === 'number'
            ? {
                trialHoursUsed: repair.trialHoursUsed,
              }
            : {}),
        })
        .where(and(eq(users.id, repair.userId), eq(users.plan, 'free')))
    }

    if (repair.canonicalUsage) {
      await db
        .insert(usagePeriods)
        .values({
          expansionSeconds: repair.canonicalUsage.expansionSeconds,
          periodEnd: FAR_FUTURE_PERIOD_END,
          periodStart: user.createdAt,
          periodType: 'lifetime',
          premiumSeconds: repair.canonicalUsage.premiumSeconds,
          regenSeconds: repair.canonicalUsage.regenSeconds,
          userId: repair.userId,
        })
        .onConflictDoUpdate({
          target: [usagePeriods.userId, usagePeriods.periodType, usagePeriods.periodStart],
          set: {
            expansionSeconds: repair.canonicalUsage.expansionSeconds,
            periodEnd: FAR_FUTURE_PERIOD_END,
            premiumSeconds: repair.canonicalUsage.premiumSeconds,
            regenSeconds: repair.canonicalUsage.regenSeconds,
          },
        })

      await db
        .delete(usagePeriods)
        .where(
          and(
            eq(usagePeriods.userId, repair.userId),
            sql`NOT (${usagePeriods.periodType} = 'lifetime' AND ${usagePeriods.periodStart} = ${user.createdAt})`,
          ),
        )
    }
  }
}

function printReport(input: {
  audits: UserAudit[]
  fix: boolean
  repairs: RepairPlan[]
}) {
  const invalidAudits = input.audits.filter((audit) => audit.issues.length > 0)
  const validTrialTimers = input.audits.filter((audit) => {
    const issues = new Set(audit.issues)

    return (
      !issues.has('missing_trial_started_at') &&
      !issues.has('missing_trial_ends_at') &&
      !issues.has('trial_window_longer_than_30_days') &&
      !issues.has('trial_started_after_account_creation')
    )
  }).length

  const summary = {
    expiredTrialUsersStillShowingAccess: input.audits.filter((audit) =>
      audit.issues.includes('free_user_older_than_30_days_with_active_looking_access'),
    ).length,
    fixMode: input.fix,
    freeUsersAudited: input.audits.length,
    missingTrialTimers: input.audits.filter((audit) =>
      audit.issues.some((issue) => issue === 'missing_trial_started_at' || issue === 'missing_trial_ends_at'),
    ).length,
    repairCandidates: input.repairs.length,
    suspiciousResetPatterns: invalidAudits.filter((audit) =>
      audit.issues.some((issue) =>
        [
          'displayed_remaining_differs_from_enforced_remaining',
          'free_user_has_billing_cycle_usage_period',
          'multiple_usage_periods',
          'trial_started_after_account_creation',
          'usage_split_outside_canonical_lifetime_period',
        ].includes(issue),
      ),
    ).length,
    usersWithIssues: invalidAudits.length,
    validTrialTimers,
  }

  console.log(JSON.stringify({ issueSummary: getIssueSummary(input.audits), summary }, null, 2))

  if (invalidAudits.length > 0) {
    console.log(
      JSON.stringify(
        {
          usersNeedingReview: invalidAudits.map((audit) => ({
            canonicalUsageHours: audit.canonicalUsageHours,
            createdAt: audit.createdAt,
            displayedRemainingHours: audit.displayedRemainingHours,
            email: audit.email,
            enforcedRemainingHours: audit.enforcedRemainingHours,
            id: audit.id,
            issues: audit.issues,
            periodCount: audit.periodCount,
            totalUsageHours: audit.totalUsageHours,
            trialEndsAt: audit.trialEndsAt,
            trialHoursUsed: audit.trialHoursUsed,
            trialStartedAt: audit.trialStartedAt,
          })),
        },
        null,
        2,
      ),
    )
  }

  if (input.fix) {
    console.log(JSON.stringify({ repairPlan: input.repairs }, null, 2))
  }
}

async function main() {
  const { fix } = parseArgs()

  if (!db) {
    throw new Error('Database is not configured. Set DATABASE_URL before running the free-trial audit.')
  }

  const freeUsers = await db.select().from(users).where(eq(users.plan, 'free'))
  const userIds = freeUsers.map((user) => user.id)
  const periodRecords = userIds.length
    ? await db.select().from(usagePeriods).where(inArray(usagePeriods.userId, userIds))
    : []
  const periodsByUserId = new Map<string, UsagePeriod[]>()
  const usersById = new Map(freeUsers.map((user) => [user.id, user]))
  const now = new Date()

  for (const period of periodRecords) {
    periodsByUserId.set(period.userId, [...(periodsByUserId.get(period.userId) ?? []), period])
  }

  const audits = freeUsers.map((user) =>
    buildAuditForUser({
      now,
      periods: periodsByUserId.get(user.id) ?? [],
      user,
    }),
  )
  const repairs = audits
    .map((audit) => {
      const user = usersById.get(audit.id)

      return user
        ? buildRepairPlanForUser({
            audit,
            periods: periodsByUserId.get(audit.id) ?? [],
            user,
          })
        : null
    })
    .filter((repair): repair is RepairPlan => Boolean(repair))

  printReport({ audits, fix, repairs })

  if (!fix) {
    console.log('Read-only audit complete. Re-run with --fix to apply the printed repair plan.')
    return
  }

  await applyRepairPlan({ repairs, usersById })
  console.log(`Applied ${repairs.length} free-trial repair${repairs.length === 1 ? '' : 's'}.`)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[free-trial-audit]', error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
