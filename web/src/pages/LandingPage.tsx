import { Suspense, useEffect, useMemo } from 'react'
import { Rayd8Background } from '../components/Rayd8Background'
import { BenefitsImageSection } from '../features/landing/BenefitsImageSection'
import { LandingNavbar } from '../features/landing/LandingNavbar'
import { DeferredRender } from '../features/landing/components/DeferredRender'
import { lazyWithPreload } from '../features/landing/lazyWithPreload'
import { useLandingPerformanceMode } from '../features/landing/useLandingPerformanceMode'

const HeroSection = lazyWithPreload(() =>
  import('../features/landing/HeroSection').then((module) => ({ default: module.HeroSection })),
)
const TeaserSection = lazyWithPreload(() =>
  import('../features/landing/TeaserSection').then((module) => ({ default: module.TeaserSection })),
)
const AboutSection = lazyWithPreload(() =>
  import('../features/landing/AboutSection').then((module) => ({ default: module.AboutSection })),
)
const TestimonialsSection = lazyWithPreload(() =>
  import('../features/landing/TestimonialsSection').then((module) => ({
    default: module.TestimonialsSection,
  })),
)
const ContactSection = lazyWithPreload(() =>
  import('../features/landing/ContactSection').then((module) => ({ default: module.ContactSection })),
)
const LandingFooter = lazyWithPreload(() =>
  import('../features/landing/LandingFooter').then((module) => ({ default: module.LandingFooter })),
)

function LandingSectionFallback({
  className = '',
  minHeightClassName = 'min-h-[44svh]',
}: {
  className?: string
  minHeightClassName?: string
}) {
  return (
    <div className={`px-4 py-12 sm:px-6 lg:px-8 ${className}`.trim()}>
      <div
        className={`mx-auto max-w-7xl rounded-[2rem] border border-white/8 bg-white/[0.03] ${minHeightClassName} animate-pulse backdrop-blur-xl`}
      />
    </div>
  )
}

export function LandingPage() {
  const { isMobileViewport, reducedEffects } = useLandingPerformanceMode()
  const deferredRootMargin = useMemo(
    () => (isMobileViewport ? '160px 0px' : '320px 0px'),
    [isMobileViewport],
  )

  useEffect(() => {
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const preloadNonCritical = () => {
      void TestimonialsSection.preload()
      void ContactSection.preload()
      void LandingFooter.preload()
    }

    if (windowWithIdle.requestIdleCallback) {
      const idleId = windowWithIdle.requestIdleCallback(preloadNonCritical)
      return () => windowWithIdle.cancelIdleCallback?.(idleId)
    }

    const timeoutId = window.setTimeout(preloadNonCritical, 450)
    return () => window.clearTimeout(timeoutId)
  }, [])

  return (
    <Rayd8Background intensity="low" reducedEffects={reducedEffects} variant="landing">
      <div className="relative z-10">
        <LandingNavbar />
        <Suspense fallback={<LandingSectionFallback className="pt-4" minHeightClassName="min-h-[100svh]" />}>
          <HeroSection reducedEffects={reducedEffects} />
        </Suspense>
        <BenefitsImageSection />
        <DeferredRender
          fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}
          rootMargin={deferredRootMargin}
        >
          <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}>
            <TeaserSection reducedEffects={reducedEffects} />
          </Suspense>
        </DeferredRender>
        <DeferredRender
          fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}
          rootMargin={deferredRootMargin}
        >
          <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}>
            <AboutSection reducedEffects={reducedEffects} />
          </Suspense>
        </DeferredRender>
        <DeferredRender
          fallback={<LandingSectionFallback minHeightClassName="min-h-[76svh]" />}
          rootMargin={deferredRootMargin}
        >
          <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[76svh]" />}>
            <TestimonialsSection reducedEffects={reducedEffects} />
          </Suspense>
        </DeferredRender>
        <DeferredRender
          fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}
          rootMargin={deferredRootMargin}
        >
          <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}>
            <ContactSection reducedEffects={reducedEffects} />
          </Suspense>
        </DeferredRender>
        <DeferredRender
          fallback={<LandingSectionFallback className="pb-10 pt-0" minHeightClassName="min-h-[14rem]" />}
          rootMargin={deferredRootMargin}
        >
          <Suspense fallback={<LandingSectionFallback className="pb-10 pt-0" minHeightClassName="min-h-[14rem]" />}>
            <LandingFooter />
          </Suspense>
        </DeferredRender>
      </div>
    </Rayd8Background>
  )
}
