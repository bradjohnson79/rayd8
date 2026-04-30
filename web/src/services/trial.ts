import { apiRequest } from './api'

export type TrialBlockReason = 'HOURS_EXCEEDED' | 'TRIAL_EXPIRED'
export type TrialNotificationLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface TrialNotification {
  level: TrialNotificationLevel
  message: string
  type: 'WARNING'
}

export interface TrialStatusResponse {
  allowed: boolean
  days_remaining?: number
  hours_remaining?: number
  notification: TrialNotification | null
  plan: 'amrita' | 'free_trial' | 'premium' | 'regen'
  reason: TrialBlockReason | null
}

export function getTrialStatus(token: string) {
  return apiRequest<TrialStatusResponse>('/v1/me/trial-status', undefined, token)
}
