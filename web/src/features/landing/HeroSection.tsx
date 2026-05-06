import { memo } from 'react'
import { ConversionButton } from './components/ConversionButton'
import { LandingBackToTop } from './components/LandingBackToTop'

const HERO_STILL = '/hero/RAYD8-Premium.png'

interface HeroSectionProps {
  reducedEffects?: boolean
}

export const HeroSection = memo(function HeroSection({ reducedEffects = false }: HeroSectionProps) {
  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden" id="hero">
      <img
        alt=""
        aria-hidden
        className="absolute inset-0 z-0 h-full w-full object-cover"
        decoding="async"
        draggable={false}
        fetchPriority="high"
        height={1080}
        src={HERO_STILL}
        width={1920}
      />

      <div
        className={[
          'absolute inset-0 z-[1] bg-black/65',
          reducedEffects ? '' : 'backdrop-blur-[2px]',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-3 z-[2] rounded-[1.5rem] border border-white/12 shadow-[0_0_50px_rgba(0,0,0,0.35)] sm:inset-5 sm:rounded-[1.75rem] md:inset-8"
      />

      <div className="relative z-[3] mx-auto flex w-full max-w-7xl flex-col px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-14 lg:px-8 lg:pt-16">
        <div className="max-w-3xl rounded-[2rem] border border-black/45 bg-[linear-gradient(180deg,rgba(14,20,30,0.48),rgba(7,10,16,0.3))] px-5 py-6 shadow-[0_20px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:px-7 sm:py-8">
          <p className="text-[10px] font-medium uppercase leading-relaxed tracking-[0.36em] text-emerald-200/80 sm:text-[11px] sm:tracking-[0.4em]">
            Next Level Digital Wellness System
          </p>
          <h1
            className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:mt-6 sm:text-5xl md:text-6xl lg:text-7xl"
            style={{
              textShadow:
                '-1px 0 0 rgba(0,0,0,0.7), 1px 0 0 rgba(0,0,0,0.7), 0 -1px 0 rgba(0,0,0,0.7), 0 1px 0 rgba(0,0,0,0.7), 0 10px 30px rgba(0,0,0,0.28)',
            }}
          >
            The Med Bed Alternative for Your Home
          </h1>
          <p
            className="mt-5 max-w-2xl text-base leading-8 text-slate-200/90 sm:mt-6 sm:text-lg"
            style={{
              textShadow:
                '-1px 0 0 rgba(0,0,0,0.68), 1px 0 0 rgba(0,0,0,0.68), 0 -1px 0 rgba(0,0,0,0.68), 0 1px 0 rgba(0,0,0,0.68), 0 8px 24px rgba(0,0,0,0.24)',
            }}
          >
            A living visual resonance system designed to influence your state within minutes.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-10">
            <ConversionButton
              guestMode="signUp"
              label="Start Free Trial"
              to="/subscription?plan=free"
              variant="ghost"
            />
            <ConversionButton
              guestMode="signIn"
              label="Experience REGEN"
              to="/subscription?plan=regen"
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-2.5 text-xs text-white/75 sm:mt-10 sm:gap-3 sm:text-sm">
            {['No equipment required', 'Works on any screen', 'Results felt within minutes'].map((item) => (
              <div
                className="rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-1.5 backdrop-blur-sm sm:px-4 sm:py-2"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>

          <p className="mt-6 max-w-2xl text-xs leading-relaxed text-white/75 sm:mt-7 sm:text-sm">
            Designed for everyday use—no setup required
          </p>
        </div>
        <LandingBackToTop className="mt-10 sm:mt-12" />
      </div>
    </section>
  )
})
