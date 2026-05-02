import { Link, useSearchParams } from 'react-router-dom'
import { Rayd8Background } from '../components/Rayd8Background'
import { normalizeReferralCode } from '../services/referrals'

export function Rayd8AffiliatePage() {
  const [searchParams] = useSearchParams()
  const referralCode = normalizeReferralCode(searchParams.get('ref'))
  const signupHref = referralCode ? `/signup?ref=${encodeURIComponent(referralCode)}` : '/signup'

  return (
    <Rayd8Background intensity="low" variant="landing">
      <div className="relative z-10 min-h-screen px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/12 bg-white/[0.04] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-10">
          <p className="text-[11px] uppercase tracking-[0.34em] text-emerald-200/70">RAYD8 affiliate</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Earn with RAYD8.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Earn $6.00 for every successful REGEN signup. Share your link. Get paid.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              'Open to every signed-in user',
              'Instant access to your referral link after signup',
              'Simple payout tracking from your dashboard',
            ].map((item) => (
              <div
                className="rounded-[1.6rem] border border-white/10 bg-white/[0.045] p-5 text-sm leading-7 text-slate-300"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-full border border-emerald-100/40 bg-[linear-gradient(135deg,rgba(167,243,208,0.96),rgba(52,211,153,0.9))] px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_16px_40px_rgba(16,185,129,0.22)] transition hover:brightness-105"
              to={signupHref}
            >
              Create Your Account to Get Started
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-medium text-white transition hover:bg-white/[0.08]"
              to="/subscription?plan=regen"
            >
              Explore REGEN
            </Link>
          </div>
        </div>
      </div>
    </Rayd8Background>
  )
}
