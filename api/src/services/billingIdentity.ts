import { and, eq, isNull, sql } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../db/client.js'
import { subscriptions, users } from '../db/schema.js'
import { normalizeEmail } from '../lib/normalizeEmail.js'

export class BillingIdentityConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BillingIdentityConflictError'
  }
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

export async function resolveStripeCustomerForUser(input: {
  email: string
  stripeClient: Stripe
  userId: string
}) {
  if (!db) {
    throw new Error('Database is not configured for billing identity resolution.')
  }

  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)

  if (!user) {
    throw new Error('Billing identity could not find the authenticated user.')
  }

  if (user.stripeCustomerId) {
    return user.stripeCustomerId
  }

  const localSubscriptionCustomers = await db
    .selectDistinct({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, input.userId))
  const candidateCustomerIds = uniqueValues(localSubscriptionCustomers.map((record) => record.stripeCustomerId))

  if (candidateCustomerIds.length > 1) {
    throw new BillingIdentityConflictError(
      'Multiple Stripe customers are linked to this RAYD8 account. Manual billing review is required.',
    )
  }

  const existingCustomerId = candidateCustomerIds[0]

  if (existingCustomerId) {
    const updatedRows = await db
      .update(users)
      .set({ stripeCustomerId: existingCustomerId })
      .where(and(eq(users.id, input.userId), isNull(users.stripeCustomerId)))
      .returning({ stripeCustomerId: users.stripeCustomerId })

    if (updatedRows[0]?.stripeCustomerId) {
      return updatedRows[0].stripeCustomerId
    }

    const [updatedUser] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)

    if (updatedUser?.stripeCustomerId === existingCustomerId) {
      return existingCustomerId
    }

    throw new BillingIdentityConflictError(
      'Stripe customer mapping changed during billing identity resolution. Manual review is required.',
    )
  }

  const normalizedEmail = normalizeEmail(input.email)
  const customer = await input.stripeClient.customers.create(
    {
      email: input.email,
      metadata: {
        normalizedEmail,
        rayd8UserId: input.userId,
        userId: input.userId,
      },
    },
    {
      idempotencyKey: `rayd8-customer:${input.userId}`,
    },
  )

  const updatedRows = await db
    .update(users)
    .set({ stripeCustomerId: customer.id })
    .where(and(eq(users.id, input.userId), isNull(users.stripeCustomerId)))
    .returning({ stripeCustomerId: users.stripeCustomerId })

  if (updatedRows[0]?.stripeCustomerId) {
    return updatedRows[0].stripeCustomerId
  }

  const [updatedUser] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)

  if (updatedUser?.stripeCustomerId === customer.id) {
    return customer.id
  }

  throw new BillingIdentityConflictError(
    'A Stripe customer was created but the local mapping could not be claimed. Manual review is required.',
  )
}

export async function assertStripeCustomerBelongsToUser(input: {
  stripeCustomerId: string
  userId: string
}) {
  if (!db) {
    return
  }

  const [mappedUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, input.stripeCustomerId))
    .limit(1)

  if (mappedUser && mappedUser.id !== input.userId) {
    throw new BillingIdentityConflictError(
      'Stripe customer is already mapped to a different RAYD8 user. Manual review is required.',
    )
  }

  await db
    .update(users)
    .set({ stripeCustomerId: input.stripeCustomerId })
    .where(
      and(
        eq(users.id, input.userId),
        sql`(${users.stripeCustomerId} IS NULL OR ${users.stripeCustomerId} = ${input.stripeCustomerId})`,
      ),
    )
}
