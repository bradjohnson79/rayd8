import { UserProfile } from '@clerk/react'
import { useEffect, useMemo, useState } from 'react'
import type { BillingPlan } from '../app/types'
import { useAuthToken } from '../features/dashboard/useAuthToken'
import { useAuthUser } from '../features/dashboard/useAuthUser'
import { createBillingCheckout, getBillingConfig } from '../services/billing'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const streamBaseUrl = import.meta.env.VITE_STREAM_BASE_URL || 'Not configured'

export function SettingsPage() {
  const user = useAuthUser()
  const getAuthToken = useAuthToken()
  const [checkoutAvailability, setCheckoutAvailability] = useState<{
    premium: boolean
    regen: boolean
  }>({
    premium: false,
    regen: false,
  })
  const [statusMessage, setStatusMessage] = useState('Checking billing configuration...')
  const [activeCheckout, setActiveCheckout] = useState<'premium' | 'regen' | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const config = await getBillingConfig()

        if (!cancelled) {
          setCheckoutAvailability({
            premium: config.premiumConfigured,
            regen: config.regenConfigured,
          })
          setStatusMessage(
            config.stripeConfigured
              ? 'Stripe checkout is connected. Individual plans activate once their matching price IDs are configured on the API.'
              : 'Stripe is not configured yet. Add the Stripe secret key and webhook secret to enable checkout.',
          )
        }
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(
            error instanceof Error ? error.message : 'Unable to reach the billing API.',
          )
        }
      }
    }

    void loadConfig()

    return () => {
      cancelled = true
    }
  }, [])

  const planCards = useMemo(
    () => [
      {
        currentPlan: 'premium' as const,
        label: 'Premium',
        value: 'premium' as const,
        description: 'Unlock the Premium content layer while keeping REGEN as a separate higher-tier experience.',
      },
      {
        currentPlan: 'regen' as const,
        label: 'REGEN',
        value: 'regen' as const,
        description: 'Enable the REGEN tier using the same shared dashboard and billing flow.',
      },
    ],
    [],
  )

  async function handleCheckout(plan: BillingPlan) {
    setActiveCheckout(plan)

    try {
      const token = await getAuthToken()

      if (!token) {
        setStatusMessage('Sign in through Clerk before starting a subscription checkout.')
        return
      }

      const response = await createBillingCheckout(plan, token)
      window.location.assign(response.checkoutUrl)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Unable to create checkout.')
    } finally {
      setActiveCheckout(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Account and plan controls</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          Manage your RAYD8® account through Clerk, keep billing decisions on the server-owned flow,
          and leave room here for future usage and plan detail surfaces.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-6">
          {clerkEnabled && user.isAuthenticated ? (
            <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white">
              <UserProfile
                appearance={{
                  elements: {
                    card: 'shadow-none',
                    navbar: 'hidden',
                    pageScrollBox: 'bg-white',
                    rootBox: 'w-full',
                  },
                }}
              />
            </div>
          ) : (
            <div className="rounded-[1.6rem] border border-amber-300/20 bg-amber-300/10 p-6 text-sm leading-7 text-amber-100">
              Sign in with Clerk to manage your profile, email address, and password from this page.
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Environment</p>
            <dl className="mt-6 space-y-4 text-sm text-slate-300">
              <div>
                <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">API URL</dt>
                <dd className="mt-2 break-all rounded-2xl bg-white/[0.06] px-4 py-3 text-slate-100 backdrop-blur-xl">
                  {apiBaseUrl}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.24em] text-slate-500">Stream base URL</dt>
                <dd className="mt-2 break-all rounded-2xl bg-white/[0.06] px-4 py-3 text-slate-100 backdrop-blur-xl">
                  {streamBaseUrl}
                </dd>
              </div>
            </dl>

            <div className="mt-8 rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-4 shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Billing status</p>
              <p className="mt-3 text-sm leading-6 text-slate-200">{statusMessage}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Future-ready</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <p>Usage display and allowance summaries can live here without fragmenting the dashboard.</p>
              <p>Billing and plan management remain server-created and signature-verified.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Plans</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Subscription checkout</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Checkout is still server-created and signature-verified. The client only starts the flow
          and never writes subscription state directly.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {planCards.map((plan) => (
            <div
              className="rounded-[2rem] border border-white/12 bg-white/[0.055] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
              key={plan.value}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-white">{plan.label}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{plan.description}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                  {user.plan === plan.currentPlan ? 'Current' : 'Available'}
                </span>
              </div>

              <button
                className="mt-6 w-full rounded-2xl bg-emerald-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!checkoutAvailability[plan.value] || activeCheckout === plan.value}
                onClick={() => void handleCheckout(plan.value)}
                type="button"
              >
                {activeCheckout === plan.value ? 'Opening checkout...' : `Choose ${plan.label}`}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
