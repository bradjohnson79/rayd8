import { desc } from 'drizzle-orm'
import { pathToFileURL } from 'node:url'
import { db } from '../src/db/client.js'
import { users } from '../src/db/schema.js'
import {
  getAweberTagsForPlan,
  syncUserToAweber,
  type AweberSyncPlan,
  type AweberSyncStatus,
} from '../src/services/aweber.js'

interface ScriptOptions {
  limit: number | null
  live: boolean
  plan: AweberSyncPlan | null
  since: Date | null
}

type UserPlan = typeof users.$inferSelect.plan

const aweberPlans = new Set<UserPlan>(['free', 'regen', 'amrita'])

function parsePlan(value: string): AweberSyncPlan {
  if (value === 'free' || value === 'regen' || value === 'amrita') {
    return value
  }

  throw new Error('--plan must be one of: free, regen, amrita.')
}

function parseSince(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error('--since must be a valid date, for example --since=2026-06-01.')
  }

  return date
}

function parseOptions(argv: string[]): ScriptOptions {
  let limit: number | null = null
  let live = false
  let plan: AweberSyncPlan | null = null
  let since: Date | null = null

  for (const arg of argv) {
    if (arg === '--live') {
      live = true
      continue
    }

    if (arg.startsWith('--limit=')) {
      const nextLimit = Number(arg.slice('--limit='.length))

      if (!Number.isInteger(nextLimit) || nextLimit <= 0) {
        throw new Error('--limit must be a positive integer.')
      }

      limit = nextLimit
      continue
    }

    if (arg.startsWith('--plan=')) {
      plan = parsePlan(arg.slice('--plan='.length))
      continue
    }

    if (arg.startsWith('--since=')) {
      since = parseSince(arg.slice('--since='.length))
      continue
    }

    throw new Error(`Unknown option: ${arg}`)
  }

  return {
    limit,
    live,
    plan,
    since,
  }
}

function toAweberPlan(plan: UserPlan): AweberSyncPlan | null {
  return aweberPlans.has(plan) ? (plan as AweberSyncPlan) : null
}

function createCountMap() {
  return {
    amrita: 0,
    free: 0,
    regen: 0,
  } satisfies Record<AweberSyncPlan, number>
}

function createStatusCounts() {
  return {
    already_exists: 0,
    failed: 0,
    skipped: 0,
    synced: 0,
  } satisfies Record<AweberSyncStatus, number>
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseOptions(argv)

  if (!db) {
    throw new Error('DATABASE_URL is required to read users for Aweber sync.')
  }

  const rows = await db
    .select({
      createdAt: users.createdAt,
      email: users.email,
      id: users.id,
      plan: users.plan,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  const allPlanCounts = createCountMap()
  let unsupportedPlanUsers = 0

  for (const user of rows) {
    const plan = toAweberPlan(user.plan)

    if (!plan) {
      unsupportedPlanUsers += 1
      continue
    }

    allPlanCounts[plan] += 1
  }

  const filteredUsers = rows.filter((user) => {
    const plan = toAweberPlan(user.plan)

    if (!plan) {
      return false
    }

    if (options.plan && plan !== options.plan) {
      return false
    }

    if (options.since && user.createdAt < options.since) {
      return false
    }

    return true
  })
  const selectedUsers = options.limit ? filteredUsers.slice(0, options.limit) : filteredUsers
  const selectedPlanCounts = createCountMap()

  for (const user of selectedUsers) {
    const plan = toAweberPlan(user.plan)

    if (plan) {
      selectedPlanCounts[plan] += 1
    }
  }

  console.info(`[aweber] ${options.live ? 'live sync' : 'dry run'} selected ${selectedUsers.length} user${selectedUsers.length === 1 ? '' : 's'}.`)
  console.info('[aweber] database plan counts:', {
    ...allPlanCounts,
    total: rows.length,
    unsupportedPlanUsers,
  })
  console.info('[aweber] selected plan counts:', selectedPlanCounts)

  if (!options.live) {
    for (const user of selectedUsers) {
      const plan = toAweberPlan(user.plan)

      if (!plan) {
        continue
      }

      console.info('[aweber] dry-run would sync:', {
        email: user.email,
        plan,
        tags: getAweberTagsForPlan(plan),
        userId: user.id,
      })
    }

    console.info('[aweber] dry run complete. Re-run with --live to call Aweber.')
    return
  }

  const statusCounts = createStatusCounts()

  for (const user of selectedUsers) {
    const plan = toAweberPlan(user.plan)

    if (!plan) {
      continue
    }

    const result = await syncUserToAweber({
      email: user.email,
      plan,
      userId: user.id,
    })

    statusCounts[result.status] += 1
    console.info('[aweber] live result:', {
      email: user.email,
      plan,
      reason: result.reason,
      status: result.status,
      userId: user.id,
    })
  }

  console.info('[aweber] live sync complete:', statusCounts)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      console.error('[aweber] sync failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}
