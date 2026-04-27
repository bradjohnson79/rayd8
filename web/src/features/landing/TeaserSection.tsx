import { ConversionButton } from './components/ConversionButton'
import { Section } from './components/Section'

interface TeaserSectionProps {
  reducedEffects?: boolean
}

const featureLi =
  'flex items-start gap-3 text-sm leading-7 text-slate-300 sm:text-[15px] sm:leading-8'
const featureBullet = 'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400/45'

export function TeaserSection({ reducedEffects = false }: TeaserSectionProps) {
  return (
    <Section
      childrenClassName="max-w-4xl"
      className="py-20 sm:py-24"
      description="RAYD8® works with the power of imbued scalar waves, organic and environmental frequencies in nature to aid you in physical, emotional, and mental recovery."
      eyebrow="Experience RAYD8® For Yourself"
      eyebrowClassName="text-[12px] font-medium leading-snug tracking-wide text-emerald-200/85 normal-case sm:text-[13px]"
      id="teaser"
      reducedEffects={reducedEffects}
      title="Turn Your Screen Into a Living Field"
    >
      <div className="space-y-8 sm:space-y-10">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-7 py-8 backdrop-blur-xl sm:rounded-3xl sm:px-9 sm:py-10">
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
          <article className="flex flex-col rounded-2xl border border-white/12 bg-white/[0.03] p-7 transition-colors duration-300 hover:border-white/20 sm:rounded-3xl sm:p-8">
            <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Free Trial</h3>
            <ul className="mt-6 flex flex-1 flex-col gap-3.5">
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>
                  <span className="font-semibold text-slate-100">35 hours of watch time per month</span>
                </span>
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
                guestMode="signUp"
                label="Start Free Trial"
                to="/subscription?plan=free"
                variant="ghost"
              />
            </div>
          </article>

          <article className="relative flex flex-col rounded-2xl border border-emerald-200/25 bg-[linear-gradient(165deg,rgba(16,185,129,0.16),rgba(8,14,22,0.94))] p-8 shadow-[0_20px_70px_rgba(16,185,129,0.12)] backdrop-blur-xl transition-[border-color,box-shadow] duration-300 hover:border-emerald-200/40 hover:shadow-[0_24px_80px_rgba(16,185,129,0.2)] sm:rounded-3xl sm:p-9 md:ring-1 md:ring-emerald-200/15">
            <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">REGEN</h3>
            <ul className="mt-6 flex flex-1 flex-col gap-3.5">
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>
                  <span className="font-semibold text-slate-50">250 hours of watch time per month</span>
                </span>
              </li>
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>Full HD experience</span>
              </li>
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>All RAYD8® modes unlocked</span>
              </li>
              <li className={featureLi}>
                <span className={featureBullet} aria-hidden />
                <span>Works on any device</span>
              </li>
            </ul>
            <div className="mt-8 sm:mt-10">
              <ConversionButton
                className="w-full min-h-[3rem] px-7 py-4 text-base sm:w-auto"
                guestMode="signIn"
                label="Experience Full REGEN"
                to="/subscription?plan=regen"
                variant="solid"
              />
            </div>
          </article>
        </div>
      </div>
    </Section>
  )
}
