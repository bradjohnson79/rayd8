import { MarketingButton } from '../features/landing/components/MarketingButton'
import { Section } from '../features/landing/components/Section'

interface NewsletterSignupProps {
  reducedEffects?: boolean
}

export default function NewsletterSignup({
  reducedEffects = false,
}: NewsletterSignupProps) {
  return (
    <Section
      childrenClassName="max-w-7xl"
      className="py-12 sm:py-16"
      id="newsletter-signup"
      reducedEffects={reducedEffects}
      showBackToTop
    >
      <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-[linear-gradient(135deg,rgba(12,24,34,0.88),rgba(15,26,42,0.92)_45%,rgba(48,22,66,0.88))] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-8 lg:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.38em] text-emerald-200/70">
              Newsletter
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Stay Connected with RAYD8
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
              Get updates, new features, and exclusive offers. Your privacy is always
              respected.
            </p>
          </div>

          <form
            action="https://www.aweber.com/scripts/addlead.pl"
            className="flex w-full max-w-[34rem] flex-col gap-3 sm:gap-4"
            method="post"
          >
            <input name="listname" type="hidden" value="awlist6953746" />
            <input name="redirect" type="hidden" value="https://rayd8.app" />
            <input name="meta_required" type="hidden" value="name,email" />

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                className="min-h-[3.25rem] w-full rounded-full border border-white/10 bg-white/[0.08] px-5 text-sm text-white outline-none ring-0 placeholder:text-white/55 focus:border-emerald-200/40"
                name="name"
                placeholder="Your Name"
                required
                type="text"
              />
              <input
                className="min-h-[3.25rem] w-full rounded-full border border-white/10 bg-white/[0.08] px-5 text-sm text-white outline-none ring-0 placeholder:text-white/55 focus:border-emerald-200/40"
                name="email"
                placeholder="Your Email"
                required
                type="email"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-6 text-white/55">
                Low-friction updates from RAYD8. No spammy blasts.
              </p>
              <MarketingButton
                className="min-h-[3.25rem] w-full shrink-0 px-7 text-base sm:w-auto"
                type="submit"
              >
                Get Updates
              </MarketingButton>
            </div>
          </form>
        </div>
      </div>
    </Section>
  )
}
