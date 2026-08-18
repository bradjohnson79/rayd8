import type { AccountHoldBlockReason, BillingAccountStatus } from '../services/billing'

export function isAccountHoldBilling(status: Pick<BillingAccountStatus, 'paused' | 'reason'>) {
  return status.reason === 'paused' || status.paused
}

export function getAccountHoldBlockCopy(reason: AccountHoldBlockReason | null) {
  if (reason === 'cooldown') {
    return 'A temporary hold can be used once every 12 months.'
  }

  if (reason === 'cancel_scheduled') {
    return 'A hold is not available while cancellation is already scheduled.'
  }

  if (reason === 'payment_recovery') {
    return 'Resolve billing before starting a hold.'
  }

  if (reason === 'already_paused') {
    return 'This account is already on a temporary hold.'
  }

  if (reason === 'no_subscription') {
    return 'A temporary hold is available after a paid subscription is active.'
  }

  return null
}

export function resolveSettingsBillingView(
  status: BillingAccountStatus,
  userPlan: string,
) {
  const onHold = isAccountHoldBilling(status)
  const subscriptionPlan = status.subscription?.plan
  const displayPlan =
    subscriptionPlan === 'regen' || subscriptionPlan === 'amrita'
      ? subscriptionPlan
      : status.entitlementPlan === 'regen' || status.entitlementPlan === 'amrita'
        ? status.entitlementPlan
        : userPlan === 'regen' || userPlan === 'amrita'
          ? userPlan
          : 'free'
  const isSubscribedMember =
    onHold || status.entitlementPlan === 'regen' || status.entitlementPlan === 'amrita'
  const showUpgradeCheckout =
    !onHold && !status.paymentRecoveryRequired && !isSubscribedMember

  return {
    canPause: status.canPause,
    canResume: status.canResume,
    displayPlan,
    isSubscribedMember,
    onHold,
    pauseBlockCopy: getAccountHoldBlockCopy(status.pauseBlockReason),
    pauseResumesAt: status.pauseResumesAt,
    showUpgradeCheckout,
  }
}
