import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MarketingButton } from '../../features/landing/components/MarketingButton'
import { Section } from '../../features/landing/components/Section'
import { trackUmamiEvent } from '../../services/umami'

const PROMO_IMAGE = '/affiliate/RAYD8-Affiliate-Promo-1.png'

interface AffiliatePromoSectionProps {
  reducedEffects?: boolean
}

const bulletPoints = [
  'No upfront cost — free to join',
  'Works for all members (Free Trial & REGEN)',
  'Instant access to your personal referral link',
  'Simple tracking inside your dashboard',
]

function AffiliateBullet({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-7 text-slate-200 sm:text-[15px] sm:leading-8">
      <span
        aria-hidden
        className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-200/28 bg-emerald-300/10 shadow-[0_0_24px_rgba(16,185,129,0.18)]"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-200 shadow-[0_0_12px_rgba(167,243,208,0.9)]" />
      </span>
      <span>{children}</span>
    </li>
  )
}

export function AffiliatePromoSection({
  reducedEffects = false,
}: AffiliatePromoSectionProps) {
  const navigate = useNavigate()
  const [imageFailed, setImageFailed] = useState(false)

  function handleCtaClick(target: 'dashboard_affiliate' | 'signup') {
    trackUmamiEvent('affiliate_cta_click', { target })
    navigate(target === 'signup' ? '/signup' : '/dashboard/affiliate')
  }

  return (
    <Section
      childrenClassName="max-w-7xl"
      className="py-10 sm:py-14"
      id="affiliate-program"
      reducedEffects={reducedEffects}
    >
      <div className="group relative overflow-hidden rounded-[2rem] border border-emerald-200/18 bg-[linear-gradient(135deg,rgba(12,22,28,0.9),rgba(14,24,40,0.92)_48%,rgba(36,20,58,0.9))] px-6 py-7 shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition duration-300 hover:-translate-y-1 hover:border-emerald-200/26 hover:shadow-[0_34px_110px_rgba(16,185,129,0.12)] sm:px-8 sm:py-9 lg:px-10 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(96,165,250,0.16),transparent_26%),radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.12),transparent_24%)]" />
        <div className="pointer-events-none absolute inset-y-8 left-0 w-px bg-[linear-gradient(180deg,transparent,rgba(167,243,208,0.7),transparent)] opacity-80 sm:left-6 lg:left-8" />

        <div className="relative grid items-center gap-8 lg:grid-cols-[1.15fr,0.85fr] lg:gap-10">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.38em] text-emerald-200/70">
              AFFILIATE PROGRAM
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Share RAYD8. Earn While You Do.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
              Create a free account and start earning with the RAYD8 Affiliate Program. Receive
              $6.00 USD for every successful REGEN subscription referral.
            </p>

            <ul className="mt-7 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
              {bulletPoints.map((point) => (
                <AffiliateBullet key={point}>{point}</AffiliateBullet>
              ))}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
              <MarketingButton
                className="min-h-[3rem] px-7 py-4 text-base"
                onClick={() => handleCtaClick('signup')}
              >
                Start Earning Now
              </MarketingButton>
              <MarketingButton
                className="min-h-[3rem] px-7 py-4 text-base"
                onClick={() => handleCtaClick('dashboard_affiliate')}
                variant="ghost"
              >
                View Affiliate Dashboard
              </MarketingButton>
            </div>
          </div>

          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[linear-gradient(165deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3 shadow-[0_22px_65px_rgba(0,0,0,0.28)]">
              <div className="relative overflow-hidden rounded-[1.3rem] bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.2),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(96,165,250,0.2),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.22),transparent_36%),linear-gradient(180deg,#081019_0%,#10192a_100%)]">
                {!imageFailed ? (
                  <div className="flex aspect-[16/9] w-full items-center justify-center p-2 sm:p-3">
                    <img
                      alt="RAYD8 affiliate promo"
                      className="h-full w-full object-contain object-center"
                      loading="lazy"
                      onError={() => setImageFailed(true)}
                      src={PROMO_IMAGE}
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[16/9] w-full items-end justify-start p-6 sm:p-8">
                    <div className="max-w-sm">
                      <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/70">
                        Affiliate Program
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
                        Share RAYD8. Earn While You Do.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
