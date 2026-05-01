import { useAuth, useClerk, useUser } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Rayd8Background } from '../components/Rayd8Background'
import { verifyBillingSession } from '../services/billing'
import { trackUmamiEvent } from '../services/umami'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

export function SuccessPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const { user } = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [statusMessage, setStatusMessage] = useState('Finalizing your subscription...')
  const [verificationState, setVerificationState] = useState<'idle' | 'verifying' | 'done' | 'error'>(
    'idle',
  )
  const [authPromptOpened, setAuthPromptOpened] = useState(false)
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (!sessionId) {
      setStatusMessage('Missing session ID. Return to subscription and try checkout again.')
      return
    }

    if (verificationState === 'done' || verificationState === 'verifying' || verificationState === 'error') {
      return
    }

    if (clerkEnabled && !isLoaded) {
      setStatusMessage('Restoring your sign-in so we can finalize your subscription...')
      return
    }

    let cancelled = false

    async function finalizeSubscription() {
      if (!sessionId) {
        return
      }

      const verifiedSessionId = sessionId
      setVerificationState('verifying')
      const token = await getToken()

      if (!token) {
        if (!cancelled) {
          setVerificationState('idle')
        }

        if (clerkEnabled && !isSignedIn && !authPromptOpened) {
          setAuthPromptOpened(true)
          setStatusMessage('Sign in to finish activating your subscription.')
          void openSignIn()
          return
        }

        setStatusMessage('Authentication is required to verify this checkout session.')
        return
      }

      try {
        await verifyBillingSession(verifiedSessionId, token)
        await user?.reload()
        trackUmamiEvent('subscription_started', {
          location: 'success_page',
          plan: 'regen',
        })

        if (!cancelled) {
          setVerificationState('done')
          setStatusMessage('Subscription verified. Redirecting to your dashboard...')
          window.setTimeout(() => navigate('/dashboard', { replace: true }), 300)
        }
      } catch (error) {
        if (!cancelled) {
          setVerificationState('error')
          setStatusMessage(
            error instanceof Error
              ? error.message
              : 'Unable to verify the checkout session right now.',
          )
        }
      }
    }

    void finalizeSubscription()

    return () => {
      cancelled = true
    }
  }, [authPromptOpened, getToken, isLoaded, isSignedIn, navigate, openSignIn, sessionId, user, verificationState])

  return (
    <Rayd8Background intensity="low" variant="landing">
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-2xl rounded-[2rem] border border-white/12 bg-white/[0.04] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.34em] text-emerald-200/70">Checkout Success</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Completing your subscription access
          </h1>
          <p className="mt-5 text-base leading-8 text-slate-300">{statusMessage}</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
              to="/subscription?plan=regen"
            >
              Back to Subscription
            </Link>
            <Link
              className="rounded-full border border-emerald-100/40 bg-[linear-gradient(135deg,rgba(167,243,208,0.96),rgba(52,211,153,0.9))] px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.22)] transition hover:brightness-105"
              to="/dashboard"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </Rayd8Background>
  )
}
