import type { PlanTier } from '../app/types'
import type { ExperienceAccessSummary, UsagePeriodSummary } from './player'
import { apiRequest } from './api'

export interface MeResponse {
  access: {
    expansion: ExperienceAccessSummary
    premium: ExperienceAccessSummary
    regen: ExperienceAccessSummary
  }
  usage: UsagePeriodSummary
  user: {
    createdAt: string | Date
    email: string
    id: string
    plan: PlanTier
    role: 'member' | 'admin'
  } | null
}

export function getMe(token: string) {
  return apiRequest<MeResponse>('/v1/me', undefined, token)
}
