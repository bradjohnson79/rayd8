import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import Stripe from 'stripe'
import { env } from '../src/env.js'

const MANAGEABLE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete']
const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as never,
    })
  : null

interface LocalSubscriptionRow {
  cancel_at_period_end: boolean
  created_at: Date
  current_period_end: Date | null
  current_period_start: Date | null
  email: string | null
  plan: string
  status: string
  stripe_customer_id: string
  stripe_subscription_id: string
  user_id: string
}

function getOutputPath() {
  const outputArg = process.argv.find((arg) => arg.startsWith('--output='))
  return resolve(
    process.cwd(),
    outputArg?.split('=')[1] ?? '../private-reports/release-gate/billing-remediation-manifest.raw.json',
  )
}

function getAlias(index: number) {
  return `billing-conflict-user-${String(index + 1).padStart(3, '0')}`
}

function getStripeResourceId(value: string | { id: string } | null | undefined) {
  if (!value) {
    return null
  }

  return typeof value === 'string' ? value : value.id
}

function fromUnix(value?: number | null) {
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : null
}

async function getStripeTruth(stripeSubscriptionId: string) {
  if (!stripe) {
    return {
      available: false,
      reason: 'STRIPE_SECRET_KEY not configured',
    }
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['items.data.price', 'latest_invoice', 'schedule'],
    })
    const latestInvoice = subscription.latest_invoice
    const latestInvoiceRecord =
      typeof latestInvoice === 'object' && latestInvoice !== null ? latestInvoice : null
    const item = subscription.items.data[0]

    return {
      available: true,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: fromUnix(item?.current_period_end),
      currentPeriodStart: fromUnix(item?.current_period_start),
      customerId: String(subscription.customer),
      latestInvoiceId: getStripeResourceId(latestInvoice),
      latestInvoiceStatus: latestInvoiceRecord?.status ?? null,
      priceId: item?.price.id ?? null,
      scheduleId: getStripeResourceId(subscription.schedule),
      status: subscription.status,
      subscriptionId: subscription.id,
    }
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
      subscriptionId: stripeSubscriptionId,
    }
  }
}

function rankCandidateCustomer(rows: LocalSubscriptionRow[]) {
  const groups = new Map<string, LocalSubscriptionRow[]>()

  rows.forEach((row) => {
    const existingRows = groups.get(row.stripe_customer_id) ?? []
    existingRows.push(row)
    groups.set(row.stripe_customer_id, existingRows)
  })

  const ranked = Array.from(groups.entries()).sort(([, leftRows], [, rightRows]) => {
    const leftActive = leftRows.filter((row) => row.status === 'active').length
    const rightActive = rightRows.filter((row) => row.status === 'active').length

    if (leftActive !== rightActive) {
      return rightActive - leftActive
    }

    return (
      Math.max(...rightRows.map((row) => row.created_at.getTime())) -
      Math.max(...leftRows.map((row) => row.created_at.getTime()))
    )
  })

  const [customerId, customerRows] = ranked[0] ?? []

  if (!customerId || !customerRows) {
    return null
  }

  return {
    candidateStripeCustomerId: customerId,
    reason: 'Ranked by active subscription count, then most recent local subscription activity. Manual approval is still required.',
  }
}

function grantsPaidEntitlement(row: LocalSubscriptionRow) {
  return row.plan === 'regen' || row.plan === 'amrita'
    ? row.status === 'active' || row.status === 'trialing' || row.status === 'past_due'
    : false
}

async function buildManifest() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.')
  }

  const sql = postgres(env.DATABASE_URL, { max: 1 })

  try {
    const affectedUserRows = await sql<{ user_id: string }[]>`
      SELECT DISTINCT "user_id"
      FROM (
        SELECT "user_id"
        FROM "subscriptions"
        WHERE "stripe_customer_id" IS NOT NULL
        GROUP BY "user_id"
        HAVING count(DISTINCT "stripe_customer_id") > 1
        UNION
        SELECT "user_id"
        FROM "subscriptions"
        WHERE "plan" IN ('regen', 'amrita')
          AND "status" IN ${sql(MANAGEABLE_STATUSES)}
        GROUP BY "user_id"
        HAVING count(*) > 1
      ) AS "affected_users"
      ORDER BY "user_id"
    `
    const affectedUserIds = affectedUserRows.map((row) => row.user_id)
    const cases = []

    for (const [index, userId] of affectedUserIds.entries()) {
      const rows = await sql<LocalSubscriptionRow[]>`
        SELECT
          s."user_id",
          u."email",
          s."stripe_customer_id",
          s."stripe_subscription_id",
          s."plan",
          s."status",
          s."cancel_at_period_end",
          s."current_period_start",
          s."current_period_end",
          s."created_at"
        FROM "subscriptions" s
        LEFT JOIN "users" u ON u."id" = s."user_id"
        WHERE s."user_id" = ${userId}
        ORDER BY s."current_period_end" DESC NULLS LAST, s."created_at" DESC
      `
      const stripeTruthEntries = await Promise.all(
        rows.map(async (row) => [row.stripe_subscription_id, await getStripeTruth(row.stripe_subscription_id)] as const),
      )
      const stripeTruthBySubscriptionId = Object.fromEntries(stripeTruthEntries)
      const overlappingRows = rows.filter(
        (row) =>
          (row.plan === 'regen' || row.plan === 'amrita') &&
          MANAGEABLE_STATUSES.includes(row.status),
      )
      const entitledRows = rows.filter(grantsPaidEntitlement)
      const sortedEntitledRows = [...entitledRows].sort((left, right) => {
        const planRank = (right.plan === 'amrita' ? 2 : 1) - (left.plan === 'amrita' ? 2 : 1)

        if (planRank !== 0) {
          return planRank
        }

        return (right.current_period_end?.getTime() ?? 0) - (left.current_period_end?.getTime() ?? 0)
      })

      cases.push({
        alias: getAlias(index),
        associatedLocalSubscriptionRows: rows.map((row) => ({
          cancelAtPeriodEnd: row.cancel_at_period_end,
          createdAt: row.created_at.toISOString(),
          currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
          currentPeriodStart: row.current_period_start?.toISOString() ?? null,
          grantsPaidEntitlementUnderCurrentPolicy: grantsPaidEntitlement(row),
          plan: row.plan,
          status: row.status,
          stripeCustomerId: row.stripe_customer_id,
          stripeSubscriptionId: row.stripe_subscription_id,
        })),
        candidateCanonicalCustomer: rankCandidateCustomer(rows),
        clerkUserId: userId,
        currentStripeTruthBySubscriptionId: stripeTruthBySubscriptionId,
        label: 'REQUIRES_MANUAL_APPROVAL',
        localUserId: userId,
        mostRecentActivityTimestamp: rows[0]?.created_at.toISOString() ?? null,
        overlappingSubscriptions: overlappingRows.map((row) => ({
          actuallyBillable: row.status === 'active' || row.status === 'trialing' || row.status === 'past_due',
          cancelAtPeriodEnd: row.cancel_at_period_end,
          currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
          customerId: row.stripe_customer_id,
          grantsPaidEntitlementUnderCurrentPolicy: grantsPaidEntitlement(row),
          localStatus: row.status,
          plan: row.plan,
          recommendedManualRemediationAction:
            'Reviewer must compare Stripe truth and payment history, approve one canonical customer/subscription, then perform explicit local and/or Stripe-side remediation.',
          stripeSubscriptionId: row.stripe_subscription_id,
        })),
        redactedEmailAlias: getAlias(index),
        recommendedFinalEntitlement: sortedEntitledRows[0]?.plan ?? 'free',
        reviewerInstruction:
          'Do not apply any action automatically. This case requires explicit reviewer approval before local or Stripe-side remediation.',
        stripeCustomerIds: Array.from(new Set(rows.map((row) => row.stripe_customer_id))),
      })
    }

    return {
      cases,
      generatedAt: new Date().toISOString(),
      safety: {
        databaseMutations: false,
        stripeMutations: false,
      },
      summary: {
        affectedUsers: affectedUserIds.length,
        casesRequireManualApproval: cases.length,
      },
    }
  } finally {
    await sql.end()
  }
}

async function main() {
  const outputPath = getOutputPath()
  const manifest = await buildManifest()

  mkdirSync(resolve(outputPath, '..'), { recursive: true })
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2))
  console.log(JSON.stringify({ outputPath, summary: manifest.summary }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
