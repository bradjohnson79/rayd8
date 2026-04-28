import { UserProfile } from '@clerk/react'
import { useState } from 'react'
import { useAuthToken } from '../features/dashboard/useAuthToken'
import { useAuthUser } from '../features/dashboard/useAuthUser'
import { createBillingCheckout } from '../services/billing'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const streamBaseUrl = import.meta.env.VITE_STREAM_BASE_URL || 'Not configured'

export function SettingsPage() {
  const user = useAuthUser()
  const getAuthToken = useAuthToken()
  const [statusMessage, setStatusMessage] = useState(
    'REGEN billing opens in a secure Stripe Checkout session and updates your access automatically after payment.',
  )
  const [activeCheckout, setActiveCheckout] = useState(false)

  async function handleCheckout() {
    setActiveCheckout(true)

    try {
      const token = await getAuthToken()

      if (!token) {
        setStatusMessage('Sign in through Clerk before starting a subscription checkout.')
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

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Account and plan controls</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          Manage your RAYD8® account through Clerk and keep subscription changes on the secure
          server-created billing flow.
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
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Plans</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Subscription checkout</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Start or renew REGEN from here. Checkout is created on the API, verified after payment,
          and your dashboard access updates automatically.
        </p>

        <div className="mt-6 rounded-[2rem] border border-emerald-200/25 bg-[linear-gradient(165deg,rgba(16,185,129,0.14),rgba(7,14,24,0.94))] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-white">REGEN</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Full access to all three RAYD8® experiences with pooled monthly usage on a secure
                Stripe subscription.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
              {user.plan === 'regen' ? 'Current' : 'Available'}
            </span>
          </div>

          <button
            className="mt-6 w-full rounded-2xl bg-emerald-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-300/30 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={activeCheckout}
            onClick={() => void handleCheckout()}
            type="button"
          >
            {activeCheckout ? 'Opening checkout...' : user.plan === 'regen' ? 'Manage REGEN Access' : 'Choose REGEN'}
          </button>
        </div>
      </section>
    </div>
  )
}
