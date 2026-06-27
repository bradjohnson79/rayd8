import { apiRequest } from './api'

export type TrialBlockReason = 'HOURS_EXCEEDED' | 'TRIAL_EXPIRED'
export type TrialNotificationLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type FreeExperiencePreviewBlockReason =
  | 'free_expansion_limit_reached'
  | 'free_premium_limit_reached'
  | 'free_regen_limit_reached'

export const TRIAL_TOTAL_DAYS = 30
export const TRIAL_TOTAL_HOURS = 35

export const TRIAL_EXPIRED_MESSAGE =
  'Your 30-day free trial has ended. Upgrade to continue accessing RAYD8 sessions.'
export const TRIAL_HOURS_EXCEEDED_MESSAGE =
  'You have used all 35 trial hours included with your free trial. Upgrade to continue using RAYD8.'
export const EXPERIENCE_PREVIEW_LIMIT_MESSAGE =
  'You have reached the preview limit for this experience. Upgrade to unlock unlimited access.'

export interface RestrictionContent {
  description: string
  title: string
}

export interface UpgradeAction {
  label: string
  targetPath: string
}

export const RESTRICTION_UPGRADE_ACTIONS: UpgradeAction[] = [
  { label: 'Upgrade to REGEN', targetPath: '/subscription?plan=regen' },
  { label: 'Upgrade to AMRITA', targetPath: '/subscription?plan=amrita' },
]

export function isTrialBlockReason(value: string | null | undefined): value is TrialBlockReason {
  return value === 'TRIAL_EXPIRED' || value === 'HOURS_EXCEEDED'
}

export function isFreeExperiencePreviewBlockReason(
  value: string | null | undefined,
): value is FreeExperiencePreviewBlockReason {
  return (
    value === 'free_expansion_limit_reached' ||
    value === 'free_premium_limit_reached' ||
    value === 'free_regen_limit_reached'
  )
}

export function getTrialBlockContent(reason: TrialBlockReason): RestrictionContent {
  if (reason === 'HOURS_EXCEEDED') {
    return {
      description: TRIAL_HOURS_EXCEEDED_MESSAGE,
      title: 'Trial hours used',
    }
  }

  return {
    description: TRIAL_EXPIRED_MESSAGE,
    title: 'Your free trial has ended',
  }
}

export function getExperiencePreviewLimitContent(): RestrictionContent {
  return {
    description: EXPERIENCE_PREVIEW_LIMIT_MESSAGE,
    title: 'Preview limit reached',
  }
}

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
