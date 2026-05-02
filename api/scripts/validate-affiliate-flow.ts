import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../src/db/client.js'
import { affiliateCommissions, users } from '../src/db/schema.js'
import { env } from '../src/env.js'
import { clerkClient } from '../src/lib/clerk.js'
import { getAdminAffiliateSummary, getAdminTopAffiliates } from '../src/services/admin/affiliatesAdmin.js'
import { recordAffiliateTrackingEvent } from '../src/services/affiliates/tracking.js'
import {
  createCheckoutSession,
  getCheckoutAffiliateMetadata,
  processStripeEvent,
} from '../src/services/subscriptions.js'
import {
  attachReferralToUser,
  createReferralSession,
  getReferralSummaryForUser,
} from '../src/services/referrals.js'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function main() {
  assert(db, 'Database is not configured for affiliate validation.')
  assert(env.STRIPE_SECRET_KEY, 'Stripe secret key is missing.')

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
  })
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const affiliateUserId = `aff_e2e_${suffix}`
  const referredUserId = `ref_e2e_${suffix}`
  const referralCode = `AFF${suffix.replace(/[^0-9a-z]/gi, '').slice(-10).toUpperCase()}`
  const affiliateEmail = `affiliate_${suffix}@example.com`
  const referredEmail = `referred_${suffix}@example.com`

  const validationContext = {
    affiliateEmail,
    affiliateUserId,
    referralCode,
    referredEmail,
    referredUserId,
  }

  let customerId: string | null = null
  let originalClerkGetUser: ((userId: string) => Promise<unknown>) | null = null
  let originalClerkUpdateUser: ((userId: string, params: unknown) => Promise<unknown>) | null = null
  let priceId: string | null = null
  let productId: string | null = null
  let subscriptionId: string | null = null

  try {
    if (clerkClient) {
      originalClerkGetUser = clerkClient.users.getUser.bind(clerkClient.users)
      originalClerkUpdateUser = clerkClient.users.updateUser.bind(clerkClient.users)

      clerkClient.users.getUser = (async (userId: string) => ({
        id: userId,
        publicMetadata: {},
      })) as typeof clerkClient.users.getUser
      clerkClient.users.updateUser = (async (userId: string) => ({
        id: userId,
        publicMetadata: { plan: 'regen' },
      })) as typeof clerkClient.users.updateUser
    }

    const product = await stripe.products.create({
      name: `RAYD8 Affiliate Validation ${suffix}`,
    })
    productId = product.id

    const price = await stripe.prices.create({
      currency: 'usd',
      product: product.id,
      recurring: { interval: 'month' },
      unit_amount: 9900,
    })
    priceId = price.id
    env.STRIPE_REGEN_PRICE_ID = price.id

    await db.insert(users).values([
      {
        email: affiliateEmail,
        id: affiliateUserId,
        plan: 'free',
        referralCode,
        role: 'member',
      },
      {
        email: referredEmail,
        id: referredUserId,
        plan: 'free',
        referralCode: `NEW${suffix.replace(/[^0-9a-z]/gi, '').slice(-10).toUpperCase()}`,
        role: 'member',
      },
    ])

    await createReferralSession({
      ip: '127.0.0.1',
      referralCode,
      userAgent: 'affiliate-validation-script',
    })

    const attachResult = await attachReferralToUser({
      referralCode,
      userId: referredUserId,
    })
    assert(attachResult.status === 'attached', `Referral attach failed with status "${attachResult.status}".`)

    const checkoutAffiliateMetadata = await getCheckoutAffiliateMetadata(referredUserId)
    assert(checkoutAffiliateMetadata, 'Checkout affiliate metadata was not found for the referred user.')
    assert(
      checkoutAffiliateMetadata.referralCode === referralCode,
      'Checkout affiliate metadata does not include the expected referral code.',
    )
    assert(
      checkoutAffiliateMetadata.referrerUserId === affiliateUserId,
      'Checkout affiliate metadata does not include the expected referrer user.',
    )

    const checkoutSession = await createCheckoutSession({
      email: referredEmail,
      plan: 'regen',
      referralCode: checkoutAffiliateMetadata.referralCode,
      referrerUserId: checkoutAffiliateMetadata.referrerUserId,
      userId: referredUserId,
    })
    assert(checkoutSession, 'Stripe checkout session was not created.')
    assert(
      checkoutSession.metadata?.referral_code === referralCode,
      'Checkout session metadata is missing referral_code.',
    )
    assert(
      checkoutSession.metadata?.referrer_user_id === affiliateUserId,
      'Checkout session metadata is missing referrer_user_id.',
    )

    const paymentMethod = await stripe.paymentMethods.create({
      card: { token: 'tok_visa' },
      type: 'card',
    })
    const customer = await stripe.customers.create({
      email: referredEmail,
      metadata: {
        plan: 'regen',
        referral_code: referralCode,
        referrer_user_id: affiliateUserId,
        userId: referredUserId,
      },
      payment_method: paymentMethod.id,
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    })
    customerId = customer.id

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      default_payment_method: paymentMethod.id,
      items: [{ price: price.id }],
      metadata: {
        plan: 'regen',
        planType: 'single',
        referral_code: referralCode,
        referrer_user_id: affiliateUserId,
        userId: referredUserId,
      },
    })
    subscriptionId = subscription.id

    await processStripeEvent({
      data: { object: subscription },
      id: `evt_affiliate_subscription_${suffix}`,
      object: 'event',
      type: 'customer.subscription.created',
    } as Stripe.Event)

    const invoiceId =
      typeof subscription.latest_invoice === 'string'
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id
    assert(invoiceId, 'Stripe subscription does not have a latest invoice.')

    let invoice = await stripe.invoices.retrieve(invoiceId)
    if (invoice.status !== 'paid') {
      invoice = await stripe.invoices.pay(invoiceId)
    }

    await processStripeEvent({
      data: { object: invoice },
      id: `evt_affiliate_invoice_${suffix}`,
      object: 'event',
      type: 'invoice.payment_succeeded',
    } as Stripe.Event)

    const [commission] = await db
      .select()
      .from(affiliateCommissions)
      .where(eq(affiliateCommissions.stripeSubscriptionId, subscription.id))
      .limit(1)

    assert(commission, 'Affiliate commission was not recorded.')
    assert(commission.affiliateUserId === affiliateUserId, 'Commission linked to the wrong affiliate user.')
    assert(commission.referredUserId === referredUserId, 'Commission linked to the wrong referred user.')
    assert(commission.amountUsd === 600, 'Commission amount should be $6.00 (600 cents).')
    assert(commission.status === 'pending', 'Commission should remain pending until payout.')

    const referralSummary = await getReferralSummaryForUser(affiliateUserId)
    assert(referralSummary.referralCount >= 1, 'Affiliate referral count did not update.')
    assert(referralSummary.pendingBalanceUsd >= 600, 'Affiliate pending balance did not update.')

    const adminSummary = await getAdminAffiliateSummary()
    assert(
      adminSummary.tracking.stripeSyncIntegrity.totalTrackedPayments >= 1,
      'Admin tracking summary did not record the Stripe payment.',
    )
    const topAffiliates = await getAdminTopAffiliates()
    assert(
      topAffiliates.some((affiliate) => affiliate.id === affiliateUserId),
      'Admin leaderboard did not include the validated affiliate.',
    )

    const successMessage = `Validated affiliate flow for ${referredUserId}: referral persisted, Stripe metadata attached, and pending commission recorded.`

    await recordAffiliateTrackingEvent({
      affiliateUserId,
      commissionCreated: true,
      details: {
        adminMetadataCoverageRate: adminSummary.tracking.stripeSyncIntegrity.metadataCoverageRate,
        adminTrackedPayments: adminSummary.tracking.stripeSyncIntegrity.totalTrackedPayments,
        commissionAmountUsd: commission.amountUsd,
        stripeCustomerId: customer.id,
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscription.id,
      },
      eventType: 'end_to_end_validation',
      hasReferralMetadata: true,
      message: successMessage,
      referralCode,
      referredUserId,
      result: 'success',
      stripeCustomerId: customer.id,
      stripeEventId: `validation_${suffix}`,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscription.id,
    })

    console.log(
      JSON.stringify(
        {
          ok: true,
          summary: {
            adminMetadataCoverageRate: adminSummary.tracking.stripeSyncIntegrity.metadataCoverageRate,
            attributedPayments: adminSummary.tracking.stripeSyncIntegrity.attributedPayments,
            commissionAmountUsd: commission.amountUsd,
            commissionStatus: commission.status,
            referralCode,
            referralCount: referralSummary.referralCount,
          },
          validationContext,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await recordAffiliateTrackingEvent({
      affiliateUserId,
      commissionCreated: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown affiliate validation error',
        ...validationContext,
      },
      eventType: 'end_to_end_validation',
      hasReferralMetadata: false,
      message:
        error instanceof Error ? error.message : 'Affiliate end-to-end validation failed unexpectedly.',
      referralCode,
      referredUserId,
      result: 'error',
      stripeCustomerId: customerId,
      stripeEventId: `validation_${suffix}`,
      stripeSubscriptionId: subscriptionId,
    })

    throw error
  } finally {
    if (subscriptionId) {
      await stripe.subscriptions.cancel(subscriptionId).catch(() => null)
    }

    if (customerId) {
      await stripe.customers.del(customerId).catch(() => null)
    }

    if (clerkClient && originalClerkGetUser && originalClerkUpdateUser) {
      clerkClient.users.getUser = originalClerkGetUser as typeof clerkClient.users.getUser
      clerkClient.users.updateUser = originalClerkUpdateUser as typeof clerkClient.users.updateUser
    }

    if (priceId) {
      await stripe.prices.update(priceId, { active: false }).catch(() => null)
    }

    if (productId) {
      await stripe.products.update(productId, { active: false }).catch(() => null)
    }
  }
}

void main()
