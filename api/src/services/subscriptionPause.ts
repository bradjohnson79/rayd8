export const ACCOUNT_HOLD_DAYS = 30
export const ACCOUNT_HOLD_COOLDOWN_DAYS = 365
const DAY_MS = 24 * 60 * 60 * 1000

export type PauseHoldRecord = {
  cancelAtPeriodEnd: boolean
  pauseResumesAt: Date | null
  pauseStartedAt: Date | null
  status?: string
}

export function isStripeManagedSubscriptionId(stripeSubscriptionId: string) {
  return stripeSubscriptionId.startsWith('sub_')
}

export function isAccountHoldActive(subscription: Pick<PauseHoldRecord, 'pauseResumesAt'>, now = new Date()) {
  return Boolean(subscription.pauseResumesAt && subscription.pauseResumesAt.getTime() > now.getTime())
}

export function isAccountHoldCooldownActive(
  subscription: Pick<PauseHoldRecord, 'pauseStartedAt' | 'pauseResumesAt'>,
  now = new Date(),
) {
  if (isAccountHoldActive(subscription, now)) {
    return false
  }

  if (!subscription.pauseStartedAt) {
    return false
  }

  return now.getTime() - subscription.pauseStartedAt.getTime() < ACCOUNT_HOLD_COOLDOWN_DAYS * DAY_MS
}

export function getAccountHoldResumeAt(now = new Date()) {
  return new Date(now.getTime() + ACCOUNT_HOLD_DAYS * DAY_MS)
}

export function getAccountHoldBlockReason(
  subscription: PauseHoldRecord | null,
  options: { paymentRecoveryRequired?: boolean } = {},
  now = new Date(),
): 'already_paused' | 'cooldown' | 'cancel_scheduled' | 'payment_recovery' | 'no_subscription' | null {
  if (!subscription) {
    return 'no_subscription'
  }

  if (options.paymentRecoveryRequired) {
    return 'payment_recovery'
  }

  if (subscription.cancelAtPeriodEnd) {
    return 'cancel_scheduled'
  }

  if (isAccountHoldActive(subscription, now)) {
    return 'already_paused'
  }

  if (subscription.status && subscription.status !== 'active' && subscription.status !== 'trialing') {
    return 'no_subscription'
  }

  if (isAccountHoldCooldownActive(subscription, now)) {
    return 'cooldown'
  }

  return null
}

export function resolveBillingPauseFlags(
  subscription: PauseHoldRecord | null,
  options: { paymentRecoveryRequired?: boolean } = {},
  now = new Date(),
) {
  const paused = subscription ? isAccountHoldActive(subscription, now) : false
  const pauseBlockReason = getAccountHoldBlockReason(subscription, options, now)

  return {
    canPause: pauseBlockReason === null,
    canResume: paused,
    pauseBlockReason,
    paused,
  }
}

export function canStartAccountHold(
  subscription: PauseHoldRecord | null,
  options: { paymentRecoveryRequired?: boolean } = {},
  now = new Date(),
) {
  return getAccountHoldBlockReason(subscription, options, now) === null
}
