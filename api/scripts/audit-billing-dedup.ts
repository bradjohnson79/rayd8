import postgres from 'postgres'
import { env } from '../src/env.js'

type AuditMode = 'post-migration' | 'pre-migration'

interface Issue {
  classification: string
  details: Record<string, unknown>
  type: string
}

function parseArgs() {
  const args = process.argv.slice(2)
  const modeArg = args.find((arg) => arg.startsWith('--mode='))
  const mode = modeArg?.split('=')[1] ?? 'post-migration'

  if (mode !== 'pre-migration' && mode !== 'post-migration') {
    throw new Error('Use --mode=pre-migration or --mode=post-migration.')
  }

  return { mode: mode as AuditMode }
}

function redactId(value: string | null | undefined) {
  if (!value) {
    return null
  }

  if (value.length <= 10) {
    return `${value.slice(0, 2)}...`
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function pushIssues<T extends Record<string, unknown>>(
  issues: Issue[],
  rows: T[],
  type: string,
  classification: string,
  redactedKeys: string[] = [],
) {
  rows.forEach((row) => {
    issues.push({
      classification,
      details: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          redactedKeys.includes(key) && typeof value === 'string' ? redactId(value) : value,
        ]),
      ),
      type,
    })
  })
}

async function collectPreMigrationIssues(sql: postgres.Sql) {
  const issues: Issue[] = []

  pushIssues(
    issues,
    await sql<{ normalized_email: string; user_count: string }[]>`
      SELECT lower(trim("email")) AS "normalized_email", count(*)::text AS "user_count"
      FROM "users"
      GROUP BY lower(trim("email"))
      HAVING count(*) > 1
    `,
    'duplicate_normalized_email',
    'duplicate local account',
  )

  pushIssues(
    issues,
    await sql<{ customer_count: string; user_id: string }[]>`
      SELECT "user_id", count(DISTINCT "stripe_customer_id")::text AS "customer_count"
      FROM "subscriptions"
      WHERE "stripe_customer_id" IS NOT NULL
      GROUP BY "user_id"
      HAVING count(DISTINCT "stripe_customer_id") > 1
    `,
    'multiple_stripe_customers_for_user',
    'multiple Stripe customers for one local user',
    ['user_id'],
  )

  pushIssues(
    issues,
    await sql<{ stripe_customer_id: string; user_count: string }[]>`
      SELECT "stripe_customer_id", count(DISTINCT "user_id")::text AS "user_count"
      FROM "subscriptions"
      WHERE "stripe_customer_id" IS NOT NULL
      GROUP BY "stripe_customer_id"
      HAVING count(DISTINCT "user_id") > 1
    `,
    'stripe_customer_shared_by_users',
    'multiple local users for one Stripe customer',
    ['stripe_customer_id'],
  )

  pushIssues(
    issues,
    await sql<{ active_count: string; user_id: string }[]>`
      SELECT "user_id", count(*)::text AS "active_count"
      FROM "subscriptions"
      WHERE "plan" IN ('regen', 'amrita')
        AND "status" IN ('active', 'trialing', 'past_due', 'unpaid', 'incomplete')
      GROUP BY "user_id"
      HAVING count(*) > 1
    `,
    'overlapping_manageable_subscriptions',
    'subscription/entitlement mismatch',
    ['user_id'],
  )

  pushIssues(
    issues,
    await sql<{ plan: string; status: string; subscription_count: string }[]>`
      SELECT "plan", "status", count(*)::text AS "subscription_count"
      FROM "subscriptions"
      WHERE "plan" IN ('regen', 'amrita')
        AND "status" NOT IN ('active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'canceled', 'paused')
      GROUP BY "plan", "status"
    `,
    'unknown_subscription_status',
    'subscription/entitlement mismatch',
  )

  pushIssues(
    issues,
    await sql<{ inferred_customer_count: string; user_id: string }[]>`
      SELECT "user_id", count(DISTINCT "stripe_customer_id")::text AS "inferred_customer_count"
      FROM "subscriptions"
      WHERE "stripe_customer_id" IS NOT NULL
      GROUP BY "user_id"
      HAVING count(DISTINCT "stripe_customer_id") = 1
    `,
    'customer_mapping_inferable_from_history',
    'historical canceled subscription',
    ['user_id'],
  )

  return issues
}

async function collectPostMigrationIssues(sql: postgres.Sql) {
  const issues = await collectPreMigrationIssues(sql)

  pushIssues(
    issues,
    await sql<{ issue_count: string }[]>`
      SELECT count(*)::text AS "issue_count"
      FROM "users"
      WHERE "normalized_email" IS NULL OR "normalized_email" <> lower(trim("email"))
      HAVING count(*) > 0
    `,
    'normalized_email_integrity_failure',
    'duplicate local account',
  )

  pushIssues(
    issues,
    await sql<{ stripe_customer_id: string; user_count: string }[]>`
      SELECT "stripe_customer_id", count(*)::text AS "user_count"
      FROM "users"
      WHERE "stripe_customer_id" IS NOT NULL
      GROUP BY "stripe_customer_id"
      HAVING count(*) > 1
    `,
    'persistent_customer_mapping_not_unique',
    'multiple local users for one Stripe customer',
    ['stripe_customer_id'],
  )

  pushIssues(
    issues,
    await sql<{ attempt_count: string; idempotency_key: string }[]>`
      SELECT "idempotency_key", count(*)::text AS "attempt_count"
      FROM "billing_checkout_attempts"
      GROUP BY "idempotency_key"
      HAVING count(*) > 1
    `,
    'checkout_attempt_idempotency_conflict',
    'subscription/entitlement mismatch',
    ['idempotency_key'],
  )

  pushIssues(
    issues,
    await sql<{ event_count: string; stripe_event_id: string }[]>`
      SELECT "stripe_event_id", count(*)::text AS "event_count"
      FROM "stripe_events"
      GROUP BY "stripe_event_id"
      HAVING count(*) > 1
    `,
    'webhook_event_idempotency_conflict',
    'subscription/entitlement mismatch',
    ['stripe_event_id'],
  )

  pushIssues(
    issues,
    await sql<{ unresolved_count: string }[]>`
      SELECT count(*)::text AS "unresolved_count"
      FROM "users"
      WHERE "billing_conflict_review_required" = true
      HAVING count(*) > 0
    `,
    'unresolved_billing_conflict_flags',
    'manual remediation required',
  )

  return issues
}

function summarize(issues: Issue[]) {
  return issues.reduce<Record<string, number>>((summary, issue) => {
    summary[issue.type] = (summary[issue.type] ?? 0) + 1
    return summary
  }, {})
}

async function main() {
  const { mode } = parseArgs()

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.')
  }

  const sql = postgres(env.DATABASE_URL, { max: 1 })

  try {
    const issues =
      mode === 'pre-migration'
        ? await collectPreMigrationIssues(sql)
        : await collectPostMigrationIssues(sql)

    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          issueCount: issues.length,
          issues,
          mode,
          summary: summarize(issues),
        },
        null,
        2,
      ),
    )
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
