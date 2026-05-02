import { apiRequest } from './api'

const REFERRAL_STORAGE_KEY = 'rayd8_ref'
const REFERRAL_CAPTURED_STORAGE_KEY = 'rayd8_ref_captured'

export type ReferralAttachStatus =
  | 'attached'
  | 'already_attached'
  | 'already_referred'
  | 'invalid_code'
  | 'self_referral'
  | 'too_old'

export interface ReferralAttachResponse {
  referralCode: string
  referrerUserId: string | null
  status: ReferralAttachStatus
}

export interface ReferralSummary {
  amountUntilPayoutThresholdUsd: number
  approvedAmountUsd: number
  approvedCount: number
  daysUntilNextPayout: number
  lastPayoutDate: string | null
  paidAmountUsd: number
  paidCount: number
  payoutEligible: boolean
  payoutThresholdUsd: number
  pendingBalanceUsd: number
  pendingAmountUsd: number
  pendingCount: number
  nextPayoutDate: string
  referralCode: string
  referralCount: number
  referralLink: string
  totalEarnedUsd: number
}

export function normalizeReferralCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? ''
}

export function getStoredReferralCode() {
  if (typeof window === 'undefined') {
    return ''
  }

  return normalizeReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY))
}

export function storeReferralCode(value: string) {
  if (typeof window === 'undefined') {
    return
  }

  const normalizedCode = normalizeReferralCode(value)

  if (!normalizedCode) {
    return
  }

  const previousCode = getStoredReferralCode()
  window.localStorage.setItem(REFERRAL_STORAGE_KEY, normalizedCode)

  if (previousCode !== normalizedCode) {
    window.localStorage.removeItem(REFERRAL_CAPTURED_STORAGE_KEY)
  }
}

export function clearStoredReferralCode() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(REFERRAL_STORAGE_KEY)
  window.localStorage.removeItem(REFERRAL_CAPTURED_STORAGE_KEY)
}

export function shouldCaptureReferralSession(referralCode: string) {
  if (typeof window === 'undefined') {
    return false
  }

  return normalizeReferralCode(window.localStorage.getItem(REFERRAL_CAPTURED_STORAGE_KEY)) !== referralCode
}

export function markReferralSessionCaptured(referralCode: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(REFERRAL_CAPTURED_STORAGE_KEY, normalizeReferralCode(referralCode))
}

export function isTerminalReferralAttachStatus(status: ReferralAttachStatus) {
  return (
    status === 'attached' ||
    status === 'already_attached' ||
    status === 'already_referred' ||
    status === 'invalid_code' ||
    status === 'self_referral' ||
    status === 'too_old'
  )
}

export async function captureReferralSession(referralCode: string) {
  return apiRequest<{ captured: boolean; referralCode: string }>('/v1/referrals/session', {
    method: 'POST',
    body: JSON.stringify({
      referralCode: normalizeReferralCode(referralCode),
    }),
  })
}

export async function attachReferralCode(referralCode: string, token: string) {
  return apiRequest<ReferralAttachResponse>(
    '/v1/referrals/attach',
    {
      method: 'POST',
      body: JSON.stringify({
        referralCode: normalizeReferralCode(referralCode),
      }),
    },
    token,
  )
}

export async function flushStoredReferralCode(token: string) {
  const referralCode = getStoredReferralCode()

  if (!referralCode) {
    return null
  }

  const response = await attachReferralCode(referralCode, token)

  if (isTerminalReferralAttachStatus(response.status)) {
    clearStoredReferralCode()
  }

  return response
}

export async function getReferralSummary(token: string) {
  return apiRequest<{ summary: ReferralSummary }>('/v1/referrals/me', undefined, token)
}
