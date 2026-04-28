import { apiRequest } from './api'

export type CancellationReason =
  | 'too_expensive'
  | 'not_using_enough'
  | 'technical_issues'
  | 'didnt_see_results'
  | 'found_alternative'
  | 'other'

export interface BillingSubscriptionStatus {
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  currentPeriodStart: string | null
  plan: 'regen'
  status: string
  stripeSubscriptionId: string
}

export async function getBillingConfig() {
  return apiRequest<{
    stripeConfigured: boolean
    regenConfigured: boolean
  }>('/v1/billing/config')
}

export async function getBillingSubscriptionStatus(token: string) {
  return apiRequest<{
    subscription: BillingSubscriptionStatus | null
  }>('/v1/billing/subscription', undefined, token)
}

export async function createBillingPortal(token: string) {
  return apiRequest<{ portalUrl: string }>(
    '/v1/billing/portal',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    token,
  )
}

export async function createBillingCheckout(
  plan: 'regen',
  token: string,
) {
  return apiRequest<{ checkoutUrl: string }>(
    '/v1/billing/checkout',
    {
      method: 'POST',
      body: JSON.stringify({ plan }),
    },
    token,
  )
}

export async function verifyBillingSession(sessionId: string, token: string) {
  return apiRequest<{
    alreadyProcessed: boolean
    plan: 'regen'
    status: 'active'
  }>(
    '/v1/billing/verify-session',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    },
    token,
  )
}

export async function cancelBillingSubscription(
  input: {
    customMessage?: string
    reasons: CancellationReason[]
    userId: string
  },
  token: string,
) {
  return apiRequest<{
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
    status: string
    stripeSubscriptionId: string
  }>(
    '/v1/billing/cancel',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    token,
  )
}
