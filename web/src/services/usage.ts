import type { Experience, PlanTier } from '../app/types'
import type { ExperienceAccessSummary, UsagePeriodSummary } from './player'
import { apiRequest } from './api'

export interface UsageResponse {
  access: {
    expansion: ExperienceAccessSummary
    premium: ExperienceAccessSummary
    regen: ExperienceAccessSummary
  }
  plan: PlanTier
  usage: UsagePeriodSummary
}

export function getUsage(token: string) {
  return apiRequest<UsageResponse>('/v1/usage', undefined, token)
}

export function trackUsage(version: Experience, seconds: number, token: string) {
  return apiRequest<UsageResponse>(
    '/v1/usage/track',
    {
      body: JSON.stringify({ seconds, version }),
      method: 'POST',
    },
    token,
  )
}
