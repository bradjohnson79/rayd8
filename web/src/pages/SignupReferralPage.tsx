import { useClerk } from '@clerk/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Rayd8Background } from '../components/Rayd8Background'
import { useAuthReadiness } from '../features/auth/useAuthReadiness'
import { normalizeReferralCode } from '../services/referrals'

export function SignupReferralPage() {
  const { openSignIn, openSignUp, signOut } = useClerk()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { status } = useAuthReadiness()
  const openedRef = useRef(false)
  const [isResettingSession, setIsResettingSession] = useState(false)
  const referralCode = useMemo(
    () => normalizeReferralCode(searchParams.get('ref')),
    [searchParams],
  )
  const isDevReferralTesting = import.meta.env.DEV && Boolean(referralCode)
  const allowAuthenticatedDevOverride = status === 'signed-in' && isDevReferralTesting

  useEffect(() => {
    if (status === 'signed-in') {
      if (!allowAuthenticatedDevOverride) {
        navigate('/dashboard', { replace: true })
      }
      return
    }

    if (status !== 'signed-out' || openedRef.current) {
      return
    }

    openedRef.current = true
    void openSignUp()
  }, [allowAuthenticatedDevOverride, navigate, openSignUp, status])

  async function handleTestAsNewUser() {
    if (!import.meta.env.DEV) {
      return
    }

    setIsResettingSession(true)

    try {
      window.localStorage.clear()
      await signOut()
      window.location.assign(referralCode ? `/signup?ref=${encodeURIComponent(referralCode)}` : '/signup')
    } finally {
      setIsResettingSession(false)
    }
  }

  return (
    <Rayd8Background intensity="low" variant="landing">
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl rounded-[2rem] border border-white/12 bg-white/[0.04] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-10">
          <p className="text-[11px] uppercase tracking-[0.34em] text-emerald-200/70">Affiliate invite</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Create your RAYD8 account to get started.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
            Start your account, claim your free trial, and unlock your own affiliate link as soon as
            you sign in.
          </p>

          {allowAuthenticatedDevOverride ? (
            <div className="mt-6 rounded-[1.4rem] border border-amber-300/25 bg-amber-300/10 px-4 py-4 text-sm leading-7 text-amber-100">
              <p className="font-semibold uppercase tracking-[0.24em]">DEV MODE: Referral signup testing active</p>
              <p className="mt-2 text-amber-50/90">
                You are signed in, but this referral test route is intentionally staying open so the
                referral capture and attach flow can be exercised on localhost.
              </p>
            </div>
          ) : null}

          {referralCode ? (
            <div className="mt-6 inline-flex rounded-full border border-emerald-200/25 bg-emerald-200/10 px-4 py-2 text-sm font-medium text-emerald-100">
              Referral code: {referralCode}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {allowAuthenticatedDevOverride ? (
              <>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-emerald-100/40 bg-[linear-gradient(135deg,rgba(167,243,208,0.96),rgba(52,211,153,0.9))] px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.22)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isResettingSession}
                  onClick={() => void handleTestAsNewUser()}
                  type="button"
                >
                  {isResettingSession ? 'Resetting test session...' : 'Test as New User'}
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  onClick={() => navigate('/dashboard')}
                  type="button"
                >
                  Return to Dashboard
                </button>
              </>
            ) : (
              <>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-emerald-100/40 bg-[linear-gradient(135deg,rgba(167,243,208,0.96),rgba(52,211,153,0.9))] px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.22)] transition hover:brightness-105"
                  onClick={() => void openSignUp()}
                  type="button"
                >
                  Create Your Account
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                  onClick={() => void openSignIn()}
                  type="button"
                >
                  Already have an account?
                </button>
              </>
            )}
          </div>

          <div className="mt-8 text-sm text-slate-400">
            Prefer to browse first?{' '}
            <Link className="text-emerald-200 transition hover:text-emerald-100" to="/rayd8-affiliate">
              Learn how the affiliate program works.
            </Link>
          </div>
        </div>
      </div>
    </Rayd8Background>
  )
}
