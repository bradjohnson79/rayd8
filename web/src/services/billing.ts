import { apiRequest } from './api'

export async function getBillingConfig() {
  return apiRequest<{
    stripeConfigured: boolean
    regenConfigured: boolean
  }>('/v1/billing/config')
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
