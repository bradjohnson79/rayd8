import { UserProfile } from '@clerk/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SESSION_EXPIRED_MESSAGE } from '../features/auth/useAuthReadiness'
import { useUpgradeNavigation } from '../features/auth/useUpgradeNavigation'
import { useAuthToken } from '../features/dashboard/useAuthToken'
import { useAuthUser } from '../features/dashboard/useAuthUser'
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  readLanguagePreference,
} from '../lib/languagePreferences'
import {
  cancelBillingSubscription,
  createBillingPortal,
  getBillingSubscriptionStatus,
  pauseBillingSubscription,
  resumeBillingSubscription,
  type BillingAccountStatus,
  type BillingSubscriptionStatus,
  type CancellationReason,
} from '../services/billing'
import { resolveSettingsBillingView } from './settingsBillingView'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

const cancellationReasonOptions: Array<{ id: CancellationReason; label: string }> = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_using_enough', label: 'Not using enough' },
  { id: 'technical_issues', label: 'Technical issues' },
  { id: 'didnt_see_results', label: 'Didn’t see results' },
  { id: 'found_alternative', label: 'Found alternative' },
  { id: 'other', label: 'Other' },
]

type ClerkFocus = 'profile' | 'security'
type CancellationStep = 'reasons' | 'confirm'

function formatPlanLabel(plan: string) {
  if (plan === 'regen') {
    return 'REGEN'
  }

  if (plan === 'premium') {
    return 'PREMIUM'
  }

  if (plan === 'amrita') {
    return 'AMRITA'
  }

  return 'FREE'
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
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getSubscriptionStatusCopy(
  userPlan: string,
  subscription: BillingSubscriptionStatus | null,
  isLoading: boolean,
  onHold = false,
  pauseResumesAt: string | null = null,
) {
  if (isLoading) {
    return {
      detail: 'Checking the latest billing state from Stripe.',
      label: 'Loading subscription status',
    }
  }

  const isSubscribedPlan = userPlan === 'regen' || userPlan === 'amrita'
  const planLabel = formatPlanLabel(userPlan)

  if (onHold) {
    return {
      detail: `Your ${planLabel} access and billing are on hold until ${formatBillingDate(pauseResumesAt)}. Access and billing resume automatically, or you can resume now.`,
      label: 'On hold',
    }
  }

  if (!subscription || !isSubscribedPlan) {
    return {
      detail: 'You are currently using the Free plan. Upgrade to REGEN or AMRITA to unlock billing controls.',
      label: 'Not subscribed',
    }
  }

  if (subscription.cancelAtPeriodEnd) {
    return {
      detail: `Your ${planLabel} access remains active until ${formatBillingDate(subscription.currentPeriodEnd)}.`,
      label: 'Cancels at period end',
    }
  }

  if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    return {
      detail: 'Your billing needs attention. Use Manage Billing to review the Stripe subscription.',
      label: 'Payment issue',
    }
  }

  return {
    detail: `Your ${planLabel} subscription is active through ${formatBillingDate(subscription.currentPeriodEnd)}.`,
    label: 'Active',
  }
}

function createEmptyBillingAccountStatus(): BillingAccountStatus {
  return {
    canPause: false,
    canResume: false,
    entitlementPlan: 'free',
    pauseBlockReason: null,
    pauseResumesAt: null,
    pauseStartedAt: null,
    paused: false,
    paymentRecoveryRequired: false,
    reason: 'free',
    subscription: null,
  }
}

function toBillingEntitlementPlan(plan: string): 'free' | 'regen' | 'amrita' {
  return plan === 'regen' || plan === 'amrita' ? plan : 'free'
}

export function SettingsPage() {
  const user = useAuthUser()
  const getAuthToken = useAuthToken()
  const navigateToUpgrade = useUpgradeNavigation()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [language, setLanguage] = useState(() => readLanguagePreference())
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(user.isAuthenticated)
  const [billingAccount, setBillingAccount] = useState<BillingAccountStatus>(() => ({
    ...createEmptyBillingAccountStatus(),
    entitlementPlan: toBillingEntitlementPlan(user.plan),
  }))
  const [clerkFocus, setClerkFocus] = useState<ClerkFocus>('profile')
  const [activeCheckout, setActiveCheckout] = useState(false)
  const [activePortal, setActivePortal] = useState(false)
  const [activeHold, setActiveHold] = useState(false)
  const [activeCancellation, setActiveCancellation] = useState(false)
  const [pauseModalOpen, setPauseModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelStep, setCancelStep] = useState<CancellationStep>('reasons')
  const [selectedReasons, setSelectedReasons] = useState<CancellationReason[]>([])
  const [customReason, setCustomReason] = useState('')
  const [cancelValidationMessage, setCancelValidationMessage] = useState<string | null>(null)
  const clerkCardRef = useRef<HTMLDivElement | null>(null)

  const billingView = useMemo(
    () => resolveSettingsBillingView(billingAccount, user.plan),
    [billingAccount, user.plan],
  )
  const subscription = billingAccount.subscription
  const paymentRecoveryRequired = billingAccount.paymentRecoveryRequired
  const isSubscribedMember = billingView.isSubscribedMember
  const currentPlanLabel = formatPlanLabel(billingView.displayPlan)
  const subscriptionStatus = useMemo(
    () =>
      getSubscriptionStatusCopy(
        billingView.displayPlan,
        subscription,
        isLoadingSubscription,
        billingView.onHold,
        billingView.pauseResumesAt,
      ),
    [billingView.displayPlan, billingView.onHold, billingView.pauseResumesAt, isLoadingSubscription, subscription],
  )

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, language)
  }, [language])

  useEffect(() => {
    let cancelled = false

    async function loadSubscriptionStatus() {
      if (!user.isAuthenticated) {
        setBillingAccount(createEmptyBillingAccountStatus())
        setIsLoadingSubscription(false)
        return
      }

      setIsLoadingSubscription(true)

      try {
        const token = await getAuthToken()

        if (!token || cancelled) {
          if (!cancelled && !token) {
            setStatusMessage(SESSION_EXPIRED_MESSAGE)
            setBillingAccount(createEmptyBillingAccountStatus())
          }
          return
        }

        const response = await getBillingSubscriptionStatus(token)

        if (!cancelled) {
          setBillingAccount(response)
        }
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(
            error instanceof Error ? error.message : 'Unable to load your current billing status.',
          )
          setBillingAccount(createEmptyBillingAccountStatus())
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSubscription(false)
        }
      }
    }

    void loadSubscriptionStatus()

    return () => {
      cancelled = true
    }
  }, [getAuthToken, user.isAuthenticated])

  function focusClerkPanel(nextFocus: ClerkFocus) {
    setClerkFocus(nextFocus)
    clerkCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggleCancellationReason(reason: CancellationReason) {
    setSelectedReasons((currentValue) =>
      currentValue.includes(reason)
        ? currentValue.filter((value) => value !== reason)
        : [...currentValue, reason],
    )
    setCancelValidationMessage(null)
  }

  function openCancellationFlow() {
    setCancelModalOpen(true)
    setCancelStep('reasons')
    setSelectedReasons([])
    setCustomReason('')
    setCancelValidationMessage(null)
  }

  function closeCancellationFlow(force = false) {
    if (activeCancellation && !force) {
      return
    }

    setCancelModalOpen(false)
    setCancelStep('reasons')
    setSelectedReasons([])
    setCustomReason('')
    setCancelValidationMessage(null)
  }

  function continueCancellationFlow() {
    if (selectedReasons.length === 0) {
      setCancelValidationMessage('Select at least one reason before continuing.')
      return
    }

    if (selectedReasons.includes('other') && !customReason.trim()) {
      setCancelValidationMessage('Add a short note when selecting Other.')
      return
    }

    setCancelValidationMessage(null)
    setCancelStep('confirm')
  }

  async function handleCheckout() {
    setActiveCheckout(true)
    setStatusMessage(null)

    try {
      await navigateToUpgrade({
        onError: setStatusMessage,
        onLoading: setStatusMessage,
      })
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to open the upgrade page.')
    } finally {
      setActiveCheckout(false)
    }
  }

  async function handleManageBilling() {
    setActivePortal(true)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        setStatusMessage(SESSION_EXPIRED_MESSAGE)
        return
      }

      const response = await createBillingPortal(token)
      window.location.assign(response.portalUrl)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to open billing management right now.',
      )
    } finally {
      setActivePortal(false)
    }
  }

  async function handleConfirmCancellation() {
    setActiveCancellation(true)
    setCancelValidationMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        setCancelValidationMessage(SESSION_EXPIRED_MESSAGE)
        return
      }

      const response = await cancelBillingSubscription(
        {
          userId: user.id,
          reasons: selectedReasons,
          customMessage: customReason.trim() || undefined,
        },
        token,
      )

      setBillingAccount((currentValue) =>
        currentValue.subscription
          ? {
              ...currentValue,
              canPause: false,
              pauseBlockReason: 'cancel_scheduled',
              subscription: {
                ...currentValue.subscription,
                cancelAtPeriodEnd: response.cancelAtPeriodEnd,
                currentPeriodEnd: response.currentPeriodEnd,
                status: response.status,
                stripeSubscriptionId: response.stripeSubscriptionId,
              },
            }
          : currentValue,
      )
      setStatusMessage(
        `Cancellation scheduled. Your ${currentPlanLabel} access continues until ${formatBillingDate(response.currentPeriodEnd)}.`,
      )
      closeCancellationFlow(true)
    } catch (error) {
      setCancelValidationMessage(
        error instanceof Error ? error.message : 'Unable to schedule the cancellation right now.',
      )
    } finally {
      setActiveCancellation(false)
    }
  }

  async function handleConfirmPause() {
    setActiveHold(true)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        setStatusMessage(SESSION_EXPIRED_MESSAGE)
        return
      }

      const response = await pauseBillingSubscription(token)
      setBillingAccount(response)
      setPauseModalOpen(false)
      setStatusMessage(
        `Account hold started. Access and billing stay paused until ${formatBillingDate(response.pauseResumesAt)}.`,
      )
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to start a temporary hold right now.')
    } finally {
      setActiveHold(false)
    }
  }

  async function handleResumeAccess() {
    setActiveHold(true)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        setStatusMessage(SESSION_EXPIRED_MESSAGE)
        return
      }

      const response = await resumeBillingSubscription(token)
      setBillingAccount(response)
      setStatusMessage('Access and billing have been resumed.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to resume access right now.')
    } finally {
      setActiveHold(false)
    }
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto overscroll-y-auto px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Account management</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          Manage your RAYD8® profile, preferences, and subscription from one place. Profile and
          security stay powered by Clerk, while billing actions stay on secure Stripe-backed API
          routes.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Account overview</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Your RAYD8 account</h2>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.05] px-4 py-4">
              <dt className="text-[11px] uppercase tracking-[0.28em] text-slate-400">User email</dt>
              <dd className="mt-3 break-all text-sm font-medium text-white">{user.email}</dd>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.05] px-4 py-4">
              <dt className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Current plan</dt>
              <dd className="mt-3 text-sm font-medium text-white">{currentPlanLabel}</dd>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.05] px-4 py-4">
              <dt className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Subscription status</dt>
              <dd className="mt-3 text-sm font-medium text-white">{subscriptionStatus.label}</dd>
            </div>
          </dl>
          <p className="mt-5 text-sm leading-7 text-slate-300">{subscriptionStatus.detail}</p>
          {statusMessage ? (
            <div className="mt-5 rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-4 text-sm leading-6 text-slate-200">
              {statusMessage}
            </div>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Language preferences</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Preferred language</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Language is stored locally for now and structured so it can be persisted to the backend
            later without changing this interface.
          </p>
          <div className="mt-6">
            <label className="text-[11px] uppercase tracking-[0.28em] text-slate-400" htmlFor="language-preference">
              Display language
            </label>
            <select
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/40"
              id="language-preference"
              onChange={(event) => setLanguage(event.target.value)}
              value={language}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option className="bg-slate-950 text-white" key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Selected: {LANGUAGE_OPTIONS.find((option) => option.code === language)?.label ?? 'English'}
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div
          className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl"
          ref={clerkCardRef}
        >
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Profile & security</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Clerk account controls</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Update your account details and password through Clerk. The quick actions below jump you
            into the account-management card on this page.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-2xl bg-emerald-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30"
              onClick={() => focusClerkPanel('profile')}
              type="button"
            >
              Edit Profile
            </button>
            <button
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              onClick={() => focusClerkPanel('security')}
              type="button"
            >
              Change Password
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-slate-300">
            {clerkFocus === 'profile'
              ? 'Use the Clerk account card below to edit your profile and email details.'
              : 'Use the Security area inside Clerk below to update your password and account security.'}
          </div>

          <div className="mt-6">
            {clerkEnabled && user.isAuthenticated ? (
              <div className="max-h-[min(78vh,56rem)] overflow-auto rounded-[1.6rem] border border-white/10 bg-white">
                <div className="min-w-[42rem]">
                  <UserProfile
                    appearance={{
                      elements: {
                        card: 'w-full max-w-none shadow-none',
                        pageScrollBox: 'max-h-[min(72vh,50rem)] overflow-auto bg-white',
                        rootBox: 'w-full',
                      },
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-[1.6rem] border border-amber-300/20 bg-amber-300/10 p-6 text-sm leading-7 text-amber-100">
                Sign in with Clerk to manage your profile and security settings from this page.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Subscription management</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Billing and cancellation</h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            {billingView.onHold
              ? `No REGEN or AMRITA access and no charge until ${formatBillingDate(billingView.pauseResumesAt)}. Access and billing resume automatically, or resume now.`
              : paymentRecoveryRequired
              ? 'Resolve billing in the secure Stripe portal to restore paid access. New checkout is disabled while a payment issue is open.'
              : isSubscribedMember
              ? 'Manage your Stripe billing, pause access for 1 month, or schedule cancellation. Access continues until the end of the current billing period after cancellation is confirmed.'
              : 'Upgrade to REGEN or AMRITA to unlock secure billing management and pooled monthly access across the RAYD8® ecosystem.'}
          </p>

          <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.05] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {isSubscribedMember ? `RAYD8® ${currentPlanLabel}` : 'Upgrade to REGEN'}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {billingView.onHold
                    ? `Your ${currentPlanLabel} membership is on a 30-day hold. There is no access and no charge until ${formatBillingDate(billingView.pauseResumesAt)}.`
                    : paymentRecoveryRequired
                    ? 'Your subscription needs billing attention. Use Manage Billing to update payment details.'
                    : isSubscribedMember
                    ? subscription?.cancelAtPeriodEnd
                      ? `Cancellation is already scheduled. Access remains active until ${formatBillingDate(subscription.currentPeriodEnd)}.`
                      : 'Manage your Stripe billing details, pause for 1 month, or cancel the subscription with required feedback.'
                    : 'Open secure Stripe Checkout to upgrade this account to REGEN.'}
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                {isSubscribedMember ? 'Current' : 'Available'}
              </span>
            </div>

            {!billingView.showUpgradeCheckout ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  className="rounded-2xl bg-emerald-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={activePortal || isLoadingSubscription}
                  onClick={() => void handleManageBilling()}
                  type="button"
                >
                  {activePortal ? 'Opening billing...' : 'Manage Billing'}
                </button>
                {billingView.canResume ? (
                  <button
                    className="rounded-2xl bg-emerald-500/90 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={activeHold || isLoadingSubscription}
                    onClick={() => void handleResumeAccess()}
                    type="button"
                  >
                    {activeHold ? 'Resuming access...' : 'Resume access'}
                  </button>
                ) : null}
                {isSubscribedMember && !billingView.onHold ? (
                  <>
                    <button
                      className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!billingView.canPause || activeHold || isLoadingSubscription}
                      onClick={() => setPauseModalOpen(true)}
                      type="button"
                    >
                      Pause for 1 month
                    </button>
                    <button
                      className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={Boolean(subscription?.cancelAtPeriodEnd) || isLoadingSubscription}
                      onClick={openCancellationFlow}
                      type="button"
                    >
                      {subscription?.cancelAtPeriodEnd ? 'Cancellation Scheduled' : 'Cancel Subscription'}
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <button
                className="mt-6 w-full rounded-2xl bg-emerald-500/90 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-400 hover:shadow-[0_0_28px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={activeCheckout}
                onClick={() => void handleCheckout()}
                type="button"
              >
                {activeCheckout ? 'Opening checkout...' : 'Upgrade to REGEN'}
              </button>
            )}
            {isSubscribedMember && !billingView.onHold && !billingView.canPause && billingView.pauseBlockCopy ? (
              <p className="mt-4 text-sm leading-6 text-slate-400">{billingView.pauseBlockCopy}</p>
            ) : null}
          </div>

          {!user.isAuthenticated ? (
            <p className="mt-4 text-sm leading-6 text-amber-100/90">
              Sign in through Clerk to manage billing and subscription changes from this page.
            </p>
          ) : null}
        </div>
      </section>

      <PauseHoldModal
        onClose={() => {
          if (!activeHold) {
            setPauseModalOpen(false)
          }
        }}
        onConfirm={() => void handleConfirmPause()}
        open={pauseModalOpen}
        resumeAtLabel={formatBillingDate(
          billingView.pauseResumesAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        )}
        submitting={activeHold}
      />

      <CancellationModal
        currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
        customReason={customReason}
        planLabel={currentPlanLabel}
        onBack={() => setCancelStep('reasons')}
        onClose={closeCancellationFlow}
        onConfirm={() => void handleConfirmCancellation()}
        onContinue={continueCancellationFlow}
        onCustomReasonChange={setCustomReason}
        onReasonToggle={toggleCancellationReason}
        open={cancelModalOpen}
        selectedReasons={selectedReasons}
        step={cancelStep}
        submitting={activeCancellation}
        validationMessage={cancelValidationMessage}
      />
    </div>
  )
}

function PauseHoldModal({
  onClose,
  onConfirm,
  open,
  resumeAtLabel,
  submitting,
}: {
  onClose: () => void
  onConfirm: () => void
  open: boolean
  resumeAtLabel: string
  submitting: boolean
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Account hold</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Pause for 1 month?</h2>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Access and billing both stop until{' '}
          <span className="font-medium text-white">{resumeAtLabel}</span>. You can resume anytime.
          Access and billing resume automatically at the end of the hold. This can be used once every
          12 months.
        </p>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            Keep access
          </button>
          <button
            className="rounded-2xl bg-amber-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-amber-300/30 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            onClick={onConfirm}
            type="button"
          >
            {submitting ? 'Starting hold...' : 'Confirm 1-month hold'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CancellationModal({
  currentPeriodEnd,
  customReason,
  onBack,
  onClose,
  onConfirm,
  onContinue,
  onCustomReasonChange,
  onReasonToggle,
  open,
  planLabel,
  selectedReasons,
  step,
  submitting,
  validationMessage,
}: {
  currentPeriodEnd: string | null
  customReason: string
  onBack: () => void
  onClose: () => void
  onConfirm: () => void
  onContinue: () => void
  onCustomReasonChange: (value: string) => void
  onReasonToggle: (reason: CancellationReason) => void
  open: boolean
  planLabel: string
  selectedReasons: CancellationReason[]
  step: CancellationStep
  submitting: boolean
  validationMessage: string | null
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Cancellation flow</p>
        {step === 'reasons' ? (
          <>
            <h2 className="mt-3 text-2xl font-semibold text-white">Why are you cancelling?</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Select at least one reason before continuing. This feedback helps improve the RAYD8®
              subscription experience.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {cancellationReasonOptions.map((option) => {
                const checked = selectedReasons.includes(option.id)

                return (
                  <label
                    className={[
                      'flex items-center gap-3 rounded-2xl border px-4 py-4 text-sm text-white transition',
                      checked
                        ? 'border-emerald-300/30 bg-emerald-300/12'
                        : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
                    ].join(' ')}
                    key={option.id}
                  >
                    <input
                      checked={checked}
                      className="h-4 w-4 accent-emerald-300"
                      onChange={() => onReasonToggle(option.id)}
                      type="checkbox"
                    />
                    <span>{option.label}</span>
                  </label>
                )
              })}
            </div>

            {selectedReasons.includes('other') ? (
              <div className="mt-5">
                <label
                  className="text-[11px] uppercase tracking-[0.28em] text-slate-400"
                  htmlFor="cancellation-other"
                >
                  Other
                </label>
                <textarea
                  className="mt-3 min-h-[8rem] w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/40"
                  id="cancellation-other"
                  onChange={(event) => onCustomReasonChange(event.target.value)}
                  placeholder="Tell us what led to the cancellation."
                  value={customReason}
                />
              </div>
            ) : null}

            {validationMessage ? (
              <p className="mt-4 text-sm leading-6 text-amber-100">{validationMessage}</p>
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
                onClick={onClose}
                type="button"
              >
                Keep Subscription
              </button>
              <button
                className="rounded-2xl bg-emerald-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30"
                onClick={onContinue}
                type="button"
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-2xl font-semibold text-white">Confirm cancellation</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Your {planLabel} access stays active until the current billing period ends on{' '}
              <span className="font-medium text-white">{formatBillingDate(currentPeriodEnd)}</span>.
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-400">Selected reasons</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {selectedReasons.map((reason) => {
                  const label =
                    cancellationReasonOptions.find((option) => option.id === reason)?.label ?? reason

                  return (
                    <li
                      className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200"
                      key={reason}
                    >
                      {label}
                    </li>
                  )
                })}
              </ul>
              {customReason.trim() ? (
                <p className="mt-4 text-sm leading-6 text-slate-300">{customReason.trim()}</p>
              ) : null}
            </div>

            {validationMessage ? (
              <p className="mt-4 text-sm leading-6 text-amber-100">{validationMessage}</p>
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
                onClick={onClose}
                type="button"
              >
                Keep Subscription
              </button>
              <button
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/5"
                onClick={onBack}
                type="button"
              >
                Back
              </button>
              <button
                className="rounded-2xl bg-rose-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-300/30 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting}
                onClick={onConfirm}
                type="button"
              >
                {submitting ? 'Scheduling cancellation...' : 'Confirm Cancellation'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
