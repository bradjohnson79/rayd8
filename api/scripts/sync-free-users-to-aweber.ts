import { desc, eq } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { users } from '../src/db/schema.js'
import { syncSubscriberToAweber } from '../src/services/aweber.js'

interface ScriptOptions {
  limit: number | null
  live: boolean
}

function parseOptions(argv: string[]): ScriptOptions {
  let limit: number | null = null
  let live = false

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
    }
  }

  return {
    limit,
    live,
  }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))

  if (!db) {
    throw new Error('DATABASE_URL is required to read free users for Aweber sync.')
  }

  const query = db
    .select({
      email: users.email,
      id: users.id,
    })
    .from(users)
    .where(eq(users.plan, 'free'))
    .orderBy(desc(users.createdAt))

  const freeUsers = options.limit ? await query.limit(options.limit) : await query

  console.info(
    `[aweber] ${options.live ? 'live sync' : 'dry run'}: ${freeUsers.length} free users${options.limit ? ` (limit ${options.limit})` : ''}.`,
  )

  if (!options.live) {
    freeUsers.forEach((user) => {
      console.info(`[aweber] dry-run would sync ${user.email} (${user.id}) with tag "Free Trial".`)
    })
    console.info('[aweber] dry run complete. Re-run with --live to call Aweber.')
    return
  }

  const counts = {
    created: 0,
    failed: 0,
    skipped: 0,
    updated: 0,
  }

  for (const user of freeUsers) {
    try {
      const result = await syncSubscriberToAweber({
        email: user.email,
        source: 'free_trial',
      })

      counts[result.status] += 1
      console.info(`[aweber] ${result.status}: ${user.email}${result.reason ? ` (${result.reason})` : ''}`)
    } catch (error) {
      counts.failed += 1
      console.error('[aweber] failed:', {
        email: user.email,
        message: error instanceof Error ? error.message : String(error),
        userId: user.id,
      })
    }
  }

  console.info('[aweber] sync complete:', counts)
}

main().catch((error) => {
  console.error('[aweber] sync failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
