import { UserProfile } from '@clerk/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthToken } from '../features/dashboard/useAuthToken'
import { useAuthUser } from '../features/dashboard/useAuthUser'
import {
  LANGUAGE_OPTIONS,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  readLanguagePreference,
} from '../lib/languagePreferences'
import {
  cancelBillingSubscription,
  createBillingCheckout,
  createBillingPortal,
  getBillingSubscriptionStatus,
  type BillingSubscriptionStatus,
  type CancellationReason,
} from '../services/billing'

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
) {
  if (isLoading) {
    return {
      detail: 'Checking the latest billing state from Stripe.',
      label: 'Loading subscription status',
    }
  }

  if (!subscription || userPlan !== 'regen') {
    return {
      detail: 'You are currently using the Free plan. Upgrade to REGEN to unlock billing controls.',
      label: 'Not subscribed',
    }
  }

  if (subscription.cancelAtPeriodEnd) {
    return {
      detail: `Your REGEN access remains active until ${formatBillingDate(subscription.currentPeriodEnd)}.`,
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
    detail: `Your REGEN subscription is active through ${formatBillingDate(subscription.currentPeriodEnd)}.`,
    label: 'Active',
  }
}

export function SettingsPage() {
  const user = useAuthUser()
  const getAuthToken = useAuthToken()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [language, setLanguage] = useState(() => readLanguagePreference())
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(user.isAuthenticated)
  const [subscription, setSubscription] = useState<BillingSubscriptionStatus | null>(null)
  const [clerkFocus, setClerkFocus] = useState<ClerkFocus>('profile')
  const [activeCheckout, setActiveCheckout] = useState(false)
  const [activePortal, setActivePortal] = useState(false)
  const [activeCancellation, setActiveCancellation] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelStep, setCancelStep] = useState<CancellationStep>('reasons')
  const [selectedReasons, setSelectedReasons] = useState<CancellationReason[]>([])
  const [customReason, setCustomReason] = useState('')
  const [cancelValidationMessage, setCancelValidationMessage] = useState<string | null>(null)
  const clerkCardRef = useRef<HTMLDivElement | null>(null)

  const isRegenMember = user.plan === 'regen'
  const subscriptionStatus = useMemo(
    () => getSubscriptionStatusCopy(user.plan, subscription, isLoadingSubscription),
    [isLoadingSubscription, subscription, user.plan],
  )

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, language)
  }, [language])

  useEffect(() => {
    let cancelled = false

    async function loadSubscriptionStatus() {
      if (!user.isAuthenticated) {
        setSubscription(null)
        setIsLoadingSubscription(false)
        return
      }

      setIsLoadingSubscription(true)

      try {
        const token = await getAuthToken()

        if (!token || cancelled) {
          return
        }

        const response = await getBillingSubscriptionStatus(token)

        if (!cancelled) {
          setSubscription(response.subscription)
        }
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(
            error instanceof Error ? error.message : 'Unable to load your current billing status.',
          )
          setSubscription(null)
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
      const token = await getAuthToken()

      if (!token) {
        setStatusMessage('Sign in through Clerk before starting a REGEN upgrade.')
        return
      }

      const response = await createBillingCheckout('regen', token)
      window.location.assign(response.checkoutUrl)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to create checkout.')
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
        setStatusMessage('Sign in through Clerk before opening billing management.')
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
        setCancelValidationMessage('Sign in through Clerk before cancelling the subscription.')
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

      setSubscription((currentValue) =>
        currentValue
          ? {
              ...currentValue,
              cancelAtPeriodEnd: response.cancelAtPeriodEnd,
              currentPeriodEnd: response.currentPeriodEnd,
              status: response.status,
              stripeSubscriptionId: response.stripeSubscriptionId,
            }
          : null,
      )
      setStatusMessage(
        `Cancellation scheduled. Your REGEN access continues until ${formatBillingDate(response.currentPeriodEnd)}.`,
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

  return (
    <div className="space-y-6">
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
              <dd className="mt-3 text-sm font-medium text-white">{formatPlanLabel(user.plan)}</dd>
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
              <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white">
                <UserProfile
                  appearance={{
                    elements: {
                      card: 'shadow-none',
                      pageScrollBox: 'bg-white',
                      rootBox: 'w-full',
                    },
                  }}
                />
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
            {isRegenMember
              ? 'Manage your Stripe billing or schedule cancellation. Access continues until the end of the current billing period after cancellation is confirmed.'
              : 'Upgrade to REGEN to unlock secure billing management and pooled monthly access across all three RAYD8® experiences.'}
          </p>

          <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.05] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {isRegenMember ? 'RAYD8® REGEN' : 'Upgrade to REGEN'}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {isRegenMember
                    ? subscription?.cancelAtPeriodEnd
                      ? `Cancellation is already scheduled. Access remains active until ${formatBillingDate(subscription.currentPeriodEnd)}.`
                      : 'Manage your Stripe billing details or cancel the subscription with required feedback.'
                    : 'Open secure Stripe Checkout to upgrade this account to REGEN.'}
                </p>
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                {isRegenMember ? 'Current' : 'Available'}
              </span>
            </div>

            {isRegenMember ? (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  className="rounded-2xl bg-emerald-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={activePortal || isLoadingSubscription}
                  onClick={() => void handleManageBilling()}
                  type="button"
                >
                  {activePortal ? 'Opening billing...' : 'Manage Billing'}
                </button>
                <button
                  className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={Boolean(subscription?.cancelAtPeriodEnd) || isLoadingSubscription}
                  onClick={openCancellationFlow}
                  type="button"
                >
                  {subscription?.cancelAtPeriodEnd ? 'Cancellation Scheduled' : 'Cancel Subscription'}
                </button>
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
          </div>

          {!user.isAuthenticated ? (
            <p className="mt-4 text-sm leading-6 text-amber-100/90">
              Sign in through Clerk to manage billing and subscription changes from this page.
            </p>
          ) : null}
        </div>
      </section>

      <CancellationModal
        currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
        customReason={customReason}
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
              Your REGEN access stays active until the current billing period ends on{' '}
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
