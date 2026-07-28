/**
 * Ensures a REGEN-entitled Clerk+DB QA user for authenticated Mux soak tests.
 *
 * Usage (repo root .env required):
 *   npm --prefix api run fixture:mux-soak-auth
 *
 * Writes gitignored: web/e2e/.auth/mux-soak.env
 */

import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/client.js'
import { subscriptions, userSettings, users } from '../src/db/schema.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: resolve(root, '.env') })

const QA_EMAIL = process.env.RAYD8_MUX_SOAK_EMAIL ?? 'qa.mux.soak@example.com'
const QA_USERNAME = process.env.RAYD8_MUX_SOAK_USERNAME ?? 'qa_mux_soak'
const QA_PASSWORD =
  process.env.RAYD8_MUX_SOAK_PASSWORD ??
  `Rayd8Soak!${createHash('sha256').update(randomBytes(16)).digest('hex').slice(0, 12)}`

async function clerkFetch(path: string, init: RequestInit = {}) {
  const secret = process.env.CLERK_SECRET_KEY
  if (!secret) {
    throw new Error('CLERK_SECRET_KEY missing')
  }

  const response = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Clerk ${path} ${response.status}: ${JSON.stringify(body)}`)
  }
  return body
}

async function ensureClerkUser() {
  const existing = await clerkFetch(`/users?email_address=${encodeURIComponent(QA_EMAIL)}&limit=1`)
  const user = Array.isArray(existing) ? existing[0] : null

  if (!user) {
    const created = await clerkFetch('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [QA_EMAIL],
        username: QA_USERNAME,
        password: QA_PASSWORD,
        skip_password_checks: true,
        public_metadata: { plan: 'regen', role: 'member' },
      }),
    })
    console.log(`Created Clerk user ${created.id}`)
    return created.id as string
  }

  await clerkFetch(`/users/${user.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      password: QA_PASSWORD,
      skip_password_checks: true,
      username: user.username || QA_USERNAME,
      public_metadata: {
        ...(user.public_metadata ?? {}),
        plan: 'regen',
        role: 'member',
      },
    }),
  })
  console.log(`Updated Clerk user ${user.id}`)
  return user.id as string
}

async function ensureDbEntitlement(userId: string) {
  if (!db) {
    throw new Error('DATABASE_URL / db client unavailable')
  }

  const normalized = QA_EMAIL.trim().toLowerCase()
  const referral = `MUXSOAK${randomBytes(3).toString('hex').toUpperCase()}`
  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

  if (!existing) {
    await db.insert(users).values({
      id: userId,
      email: QA_EMAIL,
      normalizedEmail: normalized,
      referralCode: referral,
      role: 'member',
      plan: 'regen',
    })
  } else {
    await db.update(users).set({ plan: 'regen', email: QA_EMAIL, normalizedEmail: normalized }).where(eq(users.id, userId))
  }

  const stripeCustomerId = `cus_manual_mux_soak_${userId.slice(-8)}`
  const stripeSubscriptionId = `manual_comp_regen_mux_soak_${userId.slice(-10)}`
  const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

  const [existingSub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1)

  if (!existingSub) {
    await db.insert(subscriptions).values({
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      status: 'active',
      plan: 'regen',
      planType: 'single',
      cancelAtPeriodEnd: false,
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    })
  } else {
    await db
      .update(subscriptions)
      .set({ status: 'active', plan: 'regen', currentPeriodEnd: periodEnd })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
  }

  const [existingSettings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)

  if (!existingSettings) {
    await db.insert(userSettings).values({
      userId,
      hasSeenRayd8GuideAt: new Date(),
    })
  } else if (!existingSettings.hasSeenRayd8GuideAt) {
    await db
      .update(userSettings)
      .set({ hasSeenRayd8GuideAt: new Date() })
      .where(eq(userSettings.userId, userId))
  }

  const [row] = await db
    .select({ id: users.id, email: users.email, plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  console.log('DB entitlement', JSON.stringify(row))
}

async function main() {
  const userId = await ensureClerkUser()
  await ensureDbEntitlement(userId)

  const outDir = resolve(root, 'web/e2e/.auth')
  await mkdir(outDir, { recursive: true })
  const envPath = resolve(outDir, 'mux-soak.env')
  await writeFile(
    envPath,
    [
      '# Generated by api/scripts/mux-soak-auth-fixture.ts — do not commit',
      `RAYD8_QA_EMAIL=${QA_EMAIL}`,
      `RAYD8_QA_PASSWORD=${QA_PASSWORD}`,
      `RAYD8_MUX_SOAK_USER_ID=${userId}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  )

  console.log(`Wrote ${envPath}`)
  console.log('Fixture ready.')
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
