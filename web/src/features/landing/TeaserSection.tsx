import { useLandingPerformanceProfile } from './useLandingPerformanceProfile'
import { useLandingBackdropMedium } from './landingBackdropHooks'
import { ConversionButton } from './components/ConversionButton'
import { Section } from './components/Section'
import { AMRITA_PRICE_LINE, amritaTierFeatures, regenTierFeatures } from '../amrita/amritaContent'
import { useSubscriptionPlanAction, type SubscriptionPlan } from '../subscription/useSubscriptionPlanAction'
import { useLandingMembership } from './useLandingMembership'

interface TeaserSectionProps {
  reducedEffects?: boolean
}

const featureLi =
  'flex items-start gap-3 text-sm leading-7 text-slate-300 sm:text-[15px] sm:leading-8'
const featureBullet = 'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/45'

export function TeaserSection({ reducedEffects = false }: TeaserSectionProps) {
  const backdropMedium = useLandingBackdropMedium()
  const { profile } = useLandingPerformanceProfile()
  const { activePlan, isSubmitting, startPlanAction, statusMessage } = useSubscriptionPlanAction({
    location: 'landing_teaser',
  })
  const membership = useLandingMembership()

  function getCtaLabel(plan: SubscriptionPlan, label: string) {
    if (!isSubmitting || activePlan !== plan) {
      return label
    }

    return plan === 'free' ? 'Opening dashboard...' : 'Opening checkout...'
  }

  const regenShellShadow =
    profile === 'minimal'
      ? 'shadow-[0_14px_44px_rgba(16,185,129,0.09)] hover:shadow-[0_18px_52px_rgba(16,185,129,0.12)]'
      : profile === 'balanced'
        ? 'shadow-[0_17px_58px_rgba(16,185,129,0.1)] hover:shadow-[0_21px_68px_rgba(16,185,129,0.16)]'
        : 'shadow-[0_20px_70px_rgba(16,185,129,0.12)] hover:shadow-[0_24px_80px_rgba(16,185,129,0.2)]'
  const amritaShellShadow =
    profile === 'minimal'
      ? 'shadow-[0_14px_44px_rgba(8,145,178,0.1)] hover:shadow-[0_18px_52px_rgba(8,145,178,0.14)]'
      : profile === 'balanced'
        ? 'shadow-[0_17px_58px_rgba(8,145,178,0.12)] hover:shadow-[0_21px_68px_rgba(8,145,178,0.18)]'
        : 'shadow-[0_20px_70px_rgba(8,145,178,0.16)] hover:shadow-[0_24px_80px_rgba(8,145,178,0.24)]'

  return (
    <Section
      childrenClassName="max-w-4xl"
      className="py-20 sm:py-24"
      description="RAYD8® works with the power of imbued scalar waves, organic and environmental frequencies in nature to aid you in physical, emotional, and mental recovery."
      eyebrow="Experience RAYD8® For Yourself"
      eyebrowClassName="text-[12px] font-medium leading-snug tracking-wide text-emerald-200/85 normal-case sm:text-[13px]"
      id="teaser"
      reducedEffects={reducedEffects}
      showBackToTop
      title="Turn Your Screen Into a Living Field"
    >
      <div className="space-y-8 sm:space-y-10">
        <div
          className={`rounded-2xl border border-white/10 bg-white/[0.04] px-7 py-8 sm:rounded-3xl sm:px-9 sm:py-10 ${backdropMedium}`}
        >
          <p className="text-lg font-medium leading-8 text-slate-100 sm:text-xl sm:leading-9">
            <strong className="font-semibold text-white">
              RAYD8® transforms your space into a living regeneration center.
            </strong>
          </p>
          <p className="mt-5 text-sm leading-7 text-slate-300 sm:mt-6 sm:text-base sm:leading-8">
            Experience three different versions of the RAYD8® visual system designed to support
            calmness, focus, and charged cellular recovery—right where you are.
          </p>
        </div>

        <p className="text-center text-sm font-medium leading-relaxed text-emerald-200/90 sm:text-base">
          Access RAYD8® on any device—mobile, desktop, or Smart TV.
        </p>

        {membership.isAuthenticated ? (
          <div
            className={`rounded-2xl border border-emerald-200/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(59,130,246,0.1),rgba(8,14,22,0.94))] px-7 py-8 text-center sm:rounded-3xl sm:px-9 sm:py-10 ${backdropMedium}`}
          >
            <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-200/70">
              {membership.isLoading ? 'Checking Membership' : `${membership.plan?.toUpperCase() ?? 'RAYD8'} Account`}
            </p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Continue from your member dashboard
            </h3>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
              Your account access and plan options are managed from the dashboard, so purchase cards stay out of your way after sign-in.
            </p>
            <div className="mt-7">
              <ConversionButton
                className="w-full min-h-[3rem] px-7 py-4 text-base sm:w-auto"
                guestMode="signIn"
                label="Go to Dashboard"
                to="/dashboard"
                variant="solid"
              />
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-7">
          <article className="flex flex-col rounded-2xl border border-white/12 bg-white/[0.03] p-7 transition-colors duration-300 hover:border-white/20 sm:rounded-3xl sm:p-8">
            <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Free Trial</h3>
            <ul className="mt-6 flex flex-1 flex-col gap-3.5">
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>
                  <span className="font-semibold text-slate-100">
                    35 total hours during your 30-day trial
                  </span>
                </span>
              </li>
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>One-time free trial with no monthly reset</span>
              </li>
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>720p quality</span>
              </li>
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>Expansion version + 1 hour access of Premium & REGEN versions each</span>
              </li>
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>Works on any device</span>
              </li>
            </ul>
            <div className="mt-8 sm:mt-10">
              <ConversionButton
                className="w-full min-h-[3rem] px-7 py-4 text-base sm:w-auto"
                disabled={isSubmitting}
                guestMode="signUp"
                label={getCtaLabel('free', 'Start Free Trial')}
                onClick={() => void startPlanAction('free')}
                variant="ghost"
              />
            </div>
          </article>

          <article
            className={`relative flex flex-col rounded-2xl border border-emerald-200/25 bg-[linear-gradient(165deg,rgba(16,185,129,0.16),rgba(8,14,22,0.94))] p-8 transition-[border-color,box-shadow] duration-300 hover:border-emerald-200/40 sm:rounded-3xl sm:p-9 md:ring-1 md:ring-emerald-200/15 ${regenShellShadow} ${backdropMedium}`}
          >
            <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">REGEN</h3>
            <ul className="mt-6 flex flex-1 flex-col gap-3.5">
              {regenTierFeatures.map((feature) => (
                <li className={featureLi} key={feature}>
                  <span className={featureBullet} aria-hidden />
                  <span>{feature === '250 Hours' ? <span className="font-semibold text-slate-50">{feature}</span> : feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 sm:mt-10">
              <p className="mb-3 text-sm font-bold text-white sm:text-base">Only $19.99 USD Per Month</p>
              <ConversionButton
                className="w-full min-h-[3rem] px-7 py-4 text-base sm:w-auto"
                disabled={isSubmitting}
                guestMode="signIn"
                label={getCtaLabel('regen', 'Experience Full REGEN')}
                onClick={() => void startPlanAction('regen')}
                variant="solid"
              />
            </div>
          </article>

          <article
            className={`relative flex flex-col rounded-2xl border border-cyan-100/30 bg-[linear-gradient(165deg,rgba(8,145,178,0.2),rgba(88,28,135,0.16),rgba(8,14,22,0.96))] p-8 transition-[border-color,box-shadow] duration-300 hover:border-cyan-100/45 sm:rounded-3xl sm:p-9 md:ring-1 md:ring-cyan-100/15 ${amritaShellShadow} ${backdropMedium}`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">RAYD8 Amrita</h3>
              <span className="rounded-full border border-cyan-100/35 bg-cyan-100/14 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-cyan-50">
                Highest Tier
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-cyan-100/85">Everything in REGEN, plus flagship access.</p>
            <ul className="mt-6 flex flex-1 flex-col gap-3.5">
              {amritaTierFeatures.map((feature) => (
                <li className={featureLi} key={feature}>
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/60" aria-hidden />
                  <span>{feature === '500 Hours' ? <span className="font-semibold text-slate-50">{feature}</span> : feature}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 sm:mt-10">
              <p className="mb-3 text-sm font-bold text-white sm:text-base">{AMRITA_PRICE_LINE}</p>
              <ConversionButton
                className="w-full min-h-[3rem] px-7 py-4 text-base sm:w-auto"
                disabled={isSubmitting}
                guestMode="signIn"
                label={getCtaLabel('amrita', 'Start Amrita Membership')}
                onClick={() => void startPlanAction('amrita')}
                variant="solid"
              />
            </div>
          </article>
        </div>
        )}
        {statusMessage ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm leading-6 text-slate-200">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </Section>
  )
}
