import { useClerk } from '@clerk/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Rayd8Background } from '../components/Rayd8Background'
import { useAuthToken } from '../features/dashboard/useAuthToken'
import { useAuthUser } from '../features/dashboard/useAuthUser'
import { MarketingButton } from '../features/landing/components/MarketingButton'
import { createBillingCheckout, getBillingConfig } from '../services/billing'

const PLAN_STORAGE_KEY = 'rayd8_plan'
const RESUME_STORAGE_KEY = 'rayd8_subscription_resume'

type SubscriptionPlan = 'free' | 'regen'

const planCards: Array<{
  bullets: string[]
  ctaLabel: string
  name: string
  plan: SubscriptionPlan
  subtext: string
  supportingLine?: string
}> = [
  {
    plan: 'free',
    name: 'Free Trial',
    bullets: [
      '33 hours of RAYD8 Expansion Version',
      '1 hour of RAYD8 Premium Version',
      '1 hour of RAYD8 REGEN Version',
    ],
    supportingLine: 'Instant access after sign-in.',
    ctaLabel: 'Start Free Trial',
    subtext: 'No payment required',
  },
  {
    plan: 'regen',
    name: 'REGEN',
    bullets: [
      'Full access to all 3 RAYD8 REGEN Versions',
      '250 hours of watch time per month',
      'No obligation. Cancel anytime',
    ],
    ctaLabel: 'Continue to Checkout',
    subtext: 'Secure checkout powered by Stripe',
  },
]

function PlanBulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-5 flex flex-col gap-2.5 sm:gap-3">
      {items.map((item) => (
        <li className="flex gap-2.5 sm:gap-3" key={item}>
          <span
            aria-hidden
            className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_35%,#ecfdf5,#34d399)] shadow-[0_0_12px_rgba(52,211,153,0.65),0_0_4px_rgba(167,243,208,0.9)] ring-1 ring-emerald-200/35"
          />
          <span className="text-sm leading-6 text-slate-200 sm:text-[15px] sm:leading-7">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function normalizePlan(value: string | null): SubscriptionPlan {
  return value === 'regen' ? 'regen' : 'free'
}

export function SubscriptionPage() {
  const { openSignIn, openSignUp } = useClerk()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthUser()
  const getAuthToken = useAuthToken()
  const [regenConfigured, setRegenConfigured] = useState(false)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const selectedPlan = normalizePlan(searchParams.get('plan'))
  const canceled = searchParams.get('canceled') === 'true'

  const selectedCard = useMemo(
    () => planCards.find((card) => card.plan === selectedPlan) ?? planCards[0],
    [selectedPlan],
  )

  useEffect(() => {
    let cancelled = false

    async function loadBillingConfig() {
      try {
        const config = await getBillingConfig()

        if (!cancelled) {
          setRegenConfigured(config.regenConfigured)
        }
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(
            error instanceof Error ? error.message : 'Unable to reach the billing API.',
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConfig(false)
        }
      }
    }

    void loadBillingConfig()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user.isAuthenticated) {
      return
    }

    const shouldResume = window.localStorage.getItem(RESUME_STORAGE_KEY)
    const storedPlan = normalizePlan(window.localStorage.getItem(PLAN_STORAGE_KEY))

    if (shouldResume !== 'pending') {
      return
    }

    window.localStorage.removeItem(RESUME_STORAGE_KEY)
    window.localStorage.removeItem(PLAN_STORAGE_KEY)
    void handlePlanAction(storedPlan)
  }, [user.isAuthenticated])

  async function handlePlanAction(plan: SubscriptionPlan) {
    setStatusMessage('')

    if (!user.isAuthenticated) {
      window.localStorage.setItem(PLAN_STORAGE_KEY, plan)
      window.localStorage.setItem(RESUME_STORAGE_KEY, 'pending')

      if (plan === 'free') {
        void openSignUp()
        return
      }

      void openSignIn()
      return
    }

    if (plan === 'free') {
      navigate('/dashboard')
      return
    }

    setIsSubmitting(true)

    try {
      const token = await getAuthToken()

      if (!token) {
        setStatusMessage('Sign in through Clerk before starting checkout.')
        return
      }

      const response = await createBillingCheckout('regen', token)
      window.location.assign(response.checkoutUrl)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to start REGEN checkout right now.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function selectPlan(plan: SubscriptionPlan) {
    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.set('plan', plan)
    nextSearchParams.delete('canceled')
    setSearchParams(nextSearchParams, { replace: true })
  }

  const regenDisabled = isLoadingConfig || !regenConfigured || isSubmitting
  const primaryButtonDisabled = selectedPlan === 'regen' ? regenDisabled : isSubmitting

  return (
    <Rayd8Background intensity="low" variant="landing">
      <div className="relative z-10 min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-4">
            <Link className="text-sm text-white/72 transition hover:text-white" to="/">
              Back to Landing
            </Link>
            <Link className="text-sm text-emerald-200 transition hover:text-emerald-100" to="/dashboard">
              Go to Dashboard
            </Link>
          </div>

          <div className="mt-10 rounded-[2rem] border border-white/12 bg-white/[0.04] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-8 lg:p-10">
            <div className="max-w-3xl">
              <p className="text-[11px] uppercase tracking-[0.34em] text-emerald-200/70">
                Subscription
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Choose the plan you want to start now.
              </h1>
              <p className="mt-4 text-base leading-8 text-slate-300">
                Sign in once, continue cleanly, and enter the RAYD8® experience without extra steps.
              </p>
            </div>

            {canceled ? (
              <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-4 text-sm leading-6 text-amber-100">
                Your checkout was canceled. You can resume anytime.
              </div>
            ) : null}

            {statusMessage ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-sm leading-6 text-slate-200">
                {statusMessage}
              </div>
            ) : null}

            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {planCards.map((card) => {
                const isSelected = card.plan === selectedPlan
                const isRegen = card.plan === 'regen'

                const surfaceClass = (() => {
                  if (isRegen) {
                    if (isSelected) {
                      return 'border-emerald-200/55 bg-[linear-gradient(168deg,rgba(16,185,129,0.26),rgba(5,12,22,0.97))] shadow-[0_26px_85px_rgba(16,185,129,0.22)] ring-1 ring-emerald-200/20'
                    }
                    return 'border-emerald-200/35 bg-[linear-gradient(168deg,rgba(16,185,129,0.14),rgba(7,14,24,0.96))] shadow-[0_22px_72px_rgba(0,0,0,0.35)] hover:border-emerald-200/48'
                  }
                  if (isSelected) {
                    return 'border-emerald-200/45 bg-[linear-gradient(165deg,rgba(16,185,129,0.14),rgba(8,14,22,0.94))]'
                  }
                  return 'border-white/10 bg-white/[0.03] hover:border-white/20'
                })()

                return (
                  <article
                    className={[
                      'rounded-[2rem] border p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl transition',
                      surfaceClass,
                      isRegen ? 'lg:-translate-y-1 lg:scale-[1.01]' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={card.plan}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-2xl font-semibold tracking-tight text-white">{card.name}</h2>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {isRegen ? (
                          <span className="rounded-full border border-emerald-200/35 bg-emerald-200/14 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-emerald-50">
                            Popular
                          </span>
                        ) : null}
                        <span className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-white/72">
                          {isSelected ? 'Selected' : 'Available'}
                        </span>
                      </div>
                    </div>

                    <PlanBulletList items={card.bullets} />

                    {card.supportingLine ? (
                      <p className="mt-4 text-sm leading-6 text-slate-400">{card.supportingLine}</p>
                    ) : null}

                    <p
                      className={[
                        'text-sm font-medium text-emerald-100/85',
                        card.supportingLine ? 'mt-4' : 'mt-5',
                      ].join(' ')}
                    >
                      {card.subtext}
                    </p>

                    <div className="mt-6">
                      <MarketingButton
                        className={[
                          'min-w-[14rem]',
                          isRegen
                            ? '!bg-[linear-gradient(135deg,#34d399,#38bdf8)] !shadow-[0_22px_56px_rgba(45,212,191,0.42),0_0_40px_rgba(56,189,248,0.18)] hover:!shadow-[0_26px_64px_rgba(45,212,191,0.48)]'
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        disabled={card.plan === 'regen' ? regenDisabled : isSubmitting}
                        onClick={() => {
                          selectPlan(card.plan)
                          void handlePlanAction(card.plan)
                        }}
                        variant={card.plan === 'regen' ? 'solid' : 'ghost'}
                      >
                        {isSubmitting && selectedPlan === card.plan ? 'Working...' : card.ctaLabel}
                      </MarketingButton>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/15 px-4 py-4 text-sm leading-6 text-slate-300">
              {selectedPlan === 'free'
                ? 'Free Trial starts immediately after authentication.'
                : regenConfigured
                  ? 'REGEN uses a secure server-created Stripe Checkout session.'
                  : 'Stripe checkout is not configured yet. Once it is available, you can continue to checkout here.'}
            </div>

            <div className="mt-6">
              <MarketingButton
                className="min-w-[15rem]"
                disabled={primaryButtonDisabled}
                onClick={() => void handlePlanAction(selectedPlan)}
              >
                {isSubmitting
                  ? 'Working...'
                  : canceled && selectedPlan === 'regen'
                    ? 'Continue to Checkout'
                    : selectedCard.ctaLabel}
              </MarketingButton>
            </div>
          </div>
        </div>
      </div>
    </Rayd8Background>
  )
}
