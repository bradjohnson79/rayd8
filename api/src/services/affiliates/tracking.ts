import { db } from '../../db/client.js'
import { affiliateTrackingEvents } from '../../db/schema.js'

interface AffiliateTrackingEventInput {
  affiliateUserId?: string | null
  commissionCreated?: boolean | null
  details?: Record<string, unknown>
  eventType: string
  hasReferralMetadata?: boolean | null
  message: string
  referralCode?: string | null
  referredUserId?: string | null
  result: 'error' | 'success' | 'warning'
  stripeCustomerId?: string | null
  stripeEventId?: string | null
  stripeInvoiceId?: string | null
  stripeSubscriptionId?: string | null
}

export async function recordAffiliateTrackingEvent(input: AffiliateTrackingEventInput) {
  const logPayload = {
    affiliateUserId: input.affiliateUserId ?? null,
    commissionCreated: input.commissionCreated ?? null,
    details: input.details ?? {},
    eventType: input.eventType,
    hasReferralMetadata: input.hasReferralMetadata ?? null,
    message: input.message,
    referralCode: input.referralCode ?? null,
    referredUserId: input.referredUserId ?? null,
    result: input.result,
    stripeCustomerId: input.stripeCustomerId ?? null,
    stripeEventId: input.stripeEventId ?? null,
    stripeInvoiceId: input.stripeInvoiceId ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
  }

  const logMethod = input.result === 'error' ? console.error : input.result === 'warning' ? console.warn : console.info
  logMethod('[AFFILIATE TRACK]', logPayload)

  if (!db) {
    return null
  }

  const [event] = await db
    .insert(affiliateTrackingEvents)
    .values({
      affiliateUserId: input.affiliateUserId ?? null,
      commissionCreated: input.commissionCreated ?? null,
      details: input.details ?? {},
      eventType: input.eventType,
      hasReferralMetadata: input.hasReferralMetadata ?? null,
      message: input.message,
      referralCode: input.referralCode ?? null,
      referredUserId: input.referredUserId ?? null,
      result: input.result,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeEventId: input.stripeEventId ?? null,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    })
    .returning()

  return event
}
