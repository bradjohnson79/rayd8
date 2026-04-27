import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthToken } from '../features/dashboard/useAuthToken'
import { useAuthUser } from '../features/dashboard/useAuthUser'
import { createBillingCheckout, getBillingConfig } from '../services/billing'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

export function RegenUpgradePage() {
  const user = useAuthUser()
  const getAuthToken = useAuthToken()
  const [regenConfigured, setRegenConfigured] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Checking billing configuration...')
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  const isFreeMember = user.plan === 'free'

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const config = await getBillingConfig()

        if (!cancelled) {
          setRegenConfigured(config.regenConfigured)
          setStatusMessage(
            config.regenConfigured
              ? 'Stripe checkout is available. Continue to the secure payment flow to upgrade to REGEN.'
              : 'REGEN checkout is not fully configured yet. The upgrade button will activate once the Stripe gateway and REGEN price are set on the API.',
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

  async function startRegenUpgrade() {
    if (!isFreeMember) {
      return
    }

    setIsCheckingOut(true)

    try {
      const token = await getAuthToken()

      if (!token) {
        setStatusMessage('Sign in through Clerk before starting a subscription checkout.')
        return
      }

      const response = await createBillingCheckout('regen', token)
      window.location.assign(response.checkoutUrl)
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Unable to start REGEN upgrade checkout right now.',
      )
    } finally {
      setIsCheckingOut(false)
    }
  }

  return (
    <div className="space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="max-w-3xl space-y-3">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">REGEN upgrade</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Upgrade to RAYD8® REGEN</h1>
        <p className="text-sm leading-7 text-slate-300">
          The REGEN tier is purchased through a secure, server-created Stripe Checkout session. No card
          details are handled in this app shell.
        </p>
        {!isFreeMember ? (
          <p className="text-sm leading-6 text-amber-100/90">
            This upgrade flow is for Free accounts. You are currently on the{' '}
            <span className="font-medium text-white">{user.plan}</span> plan. Plan changes and billing
            are managed in{' '}
            <Link className="text-emerald-200 underline-offset-2 hover:underline" to="/dashboard/settings">
              Settings
            </Link>
            .
          </p>
        ) : !clerkEnabled && !user.isAuthenticated ? (
          <p className="text-sm leading-6 text-amber-100/90">
            Sign in to start checkout. In demo mode without Clerk, the billing flow cannot be started
            from the browser.
          </p>
        ) : null}
        <p className="text-sm leading-6 text-slate-300/90">{statusMessage}</p>
      </section>

      {isFreeMember ? (
        <div className="max-w-sm">
          <button
            className="w-full rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-medium text-white transition hover:bg-emerald-400 hover:shadow-[0_0_28px_rgba(16,185,129,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!regenConfigured || isCheckingOut}
            onClick={() => void startRegenUpgrade()}
            type="button"
          >
            {isCheckingOut ? 'Opening checkout...' : 'UPGRADE TO REGEN'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
