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

function formatBillingDate(value: string | null) {
  if (!value) {
    return 'Unavailable'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Unavailable'
  }

  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function paidPlan(plan: string | null | undefined) {
  return plan === 'regen' || plan === 'amrita' ? plan : null
}

export function resolveSettingsBillingView(
  status: BillingAccountStatus,
  userPlan: string,
) {
  const onHold = isAccountHoldBilling(status)
  const subscription = status.subscription
  const subscriptionPlan = paidPlan(subscription?.plan)
  const entitlementPlan = paidPlan(status.entitlementPlan)
  const entitled = entitlementPlan !== null
  const displayPlan =
    entitlementPlan ??
    ((onHold || status.paymentRecoveryRequired) && subscriptionPlan ? subscriptionPlan : null) ??
    (!subscription ? paidPlan(userPlan) : null) ??
    'free'
  const isSubscribedMember = onHold || entitled
  const showUpgradeCheckout =
    !onHold && !status.paymentRecoveryRequired && !isSubscribedMember
  const planLabel = displayPlan === 'regen' ? 'REGEN' : displayPlan === 'amrita' ? 'AMRITA' : 'FREE'
  const accountStatus = resolveAccountStatusCopy({
    entitled,
    onHold,
    pauseResumesAt: status.pauseResumesAt,
    paymentRecoveryRequired: status.paymentRecoveryRequired,
    planLabel,
    subscription,
  })

  return {
    canPause: status.canPause,
    canResume: status.canResume,
    displayPlan,
    isSubscribedMember,
    onHold,
    pauseBlockCopy: getAccountHoldBlockCopy(status.pauseBlockReason),
    pauseResumesAt: status.pauseResumesAt,
    showUpgradeCheckout,
    statusDetail: accountStatus.detail,
    statusLabel: accountStatus.label,
  }
}

function resolveAccountStatusCopy(input: {
  entitled: boolean
  onHold: boolean
  pauseResumesAt: string | null
  paymentRecoveryRequired: boolean
  planLabel: string
  subscription: BillingAccountStatus['subscription']
}) {
  if (input.onHold) {
    return {
      detail: `Your ${input.planLabel} access and billing are on hold until ${formatBillingDate(input.pauseResumesAt)}. Access and billing resume automatically, or you can resume now.`,
      label: 'On hold',
    }
  }

  if (input.subscription?.status === 'incomplete') {
    return {
      detail: 'The last checkout did not collect payment, so access stays on the Free plan. You can start a new checkout.',
      label: 'Payment not completed',
    }
  }

  if (
    input.paymentRecoveryRequired ||
    input.subscription?.status === 'past_due' ||
    input.subscription?.status === 'unpaid'
  ) {
    return {
      detail: 'Your billing needs attention. Use Manage Billing to review the Stripe subscription.',
      label: 'Payment issue',
    }
  }

  if (!input.entitled) {
    return {
      detail: 'You are currently using the Free plan. Upgrade to REGEN or AMRITA to unlock billing controls.',
      label: 'Not subscribed',
    }
  }

  if (input.subscription?.cancelAtPeriodEnd) {
    return {
      detail: `Your ${input.planLabel} access remains active until ${formatBillingDate(input.subscription.currentPeriodEnd)}.`,
      label: 'Cancels at period end',
    }
  }

  return {
    detail: `Your ${input.planLabel} subscription is active through ${formatBillingDate(input.subscription?.currentPeriodEnd ?? null)}.`,
    label: 'Active',
  }
}
