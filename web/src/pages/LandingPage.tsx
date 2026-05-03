import { Suspense, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Rayd8Background } from '../components/Rayd8Background'
import { LandingNavbar } from '../features/landing/LandingNavbar'
import { DeferredRender } from '../features/landing/components/DeferredRender'
import { lazyWithPreload } from '../features/landing/lazyWithPreload'
import { useLandingPerformanceMode } from '../features/landing/useLandingPerformanceMode'

const HeroSection = lazyWithPreload(() =>
  import('../features/landing/HeroSection').then((module) => ({ default: module.HeroSection })),
)
const BenefitsImageSection = lazyWithPreload(() =>
  import('../features/landing/BenefitsImageSection').then((module) => ({
    default: module.BenefitsImageSection,
  })),
)
const TeaserSection = lazyWithPreload(() =>
  import('../features/landing/TeaserSection').then((module) => ({ default: module.TeaserSection })),
)
const NewsletterSignup = lazyWithPreload(() =>
  import('../components/NewsletterSignup').then((module) => ({
    default: module.default,
  })),
)
const AffiliatePromoSection = lazyWithPreload(() =>
  import('../components/sections/AffiliatePromoSection').then((module) => ({
    default: module.AffiliatePromoSection,
  })),
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
  const location = useLocation()
  const { isMobileViewport, reducedEffects } = useLandingPerformanceMode()
  const shouldEagerRenderDeferredSections = Boolean(location.hash)
  const deferredRootMargin = useMemo(
    () => (isMobileViewport ? '160px 0px' : '320px 0px'),
    [isMobileViewport],
  )

  useEffect(() => {
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const preloadNearFoldSections = () => {
      void BenefitsImageSection.preload()
      void NewsletterSignup.preload()
      void TeaserSection.preload()
      void AffiliatePromoSection.preload()
      void AboutSection.preload()
    }

    const preloadLowerPrioritySections = () => {
      void TestimonialsSection.preload()
      void ContactSection.preload()
      void LandingFooter.preload()
    }

    if (windowWithIdle.requestIdleCallback) {
      const nearFoldIdleId = windowWithIdle.requestIdleCallback(preloadNearFoldSections)
      const lowerPriorityTimeoutId = window.setTimeout(() => {
        windowWithIdle.requestIdleCallback?.(preloadLowerPrioritySections)
      }, 2000)

      return () => {
        windowWithIdle.cancelIdleCallback?.(nearFoldIdleId)
        window.clearTimeout(lowerPriorityTimeoutId)
      }
    }

    const nearFoldTimeoutId = window.setTimeout(preloadNearFoldSections, 800)
    const lowerPriorityTimeoutId = window.setTimeout(preloadLowerPrioritySections, 2400)

    return () => {
      window.clearTimeout(nearFoldTimeoutId)
      window.clearTimeout(lowerPriorityTimeoutId)
    }
  }, [])

  useEffect(() => {
    const hashId = location.hash.replace('#', '')

    if (!hashId) {
      return
    }

    if (hashId === 'teaser') {
      void TeaserSection.preload()
    } else if (hashId === 'about') {
      void AboutSection.preload()
    } else if (hashId === 'testimonials') {
      void TestimonialsSection.preload()
    } else if (hashId === 'contact' || hashId === 'contact-form') {
      void ContactSection.preload()
    }

    let timeoutId = 0
    let attempts = 0
    const settleScrollTimeouts: number[] = []

    const scrollToHashTarget = () => {
      const targetElement = document.getElementById(hashId)

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'auto', block: 'start' })
        settleScrollTimeouts.push(
          window.setTimeout(() => {
            targetElement.scrollIntoView({ behavior: 'auto', block: 'start' })
          }, 150),
        )
        settleScrollTimeouts.push(
          window.setTimeout(() => {
            targetElement.scrollIntoView({ behavior: 'auto', block: 'start' })
          }, 500),
        )
        return
      }

      if (attempts >= 30) {
        return
      }

      attempts += 1
      timeoutId = window.setTimeout(scrollToHashTarget, 100)
    }

    scrollToHashTarget()

    return () => {
      window.clearTimeout(timeoutId)
      settleScrollTimeouts.forEach((nextTimeoutId) => window.clearTimeout(nextTimeoutId))
    }
  }, [location.hash])

  return (
    <Rayd8Background intensity="low" reducedEffects={reducedEffects} variant="landing">
      <div className="relative z-10">
        <LandingNavbar />
        <Suspense fallback={<LandingSectionFallback className="pt-4" minHeightClassName="min-h-[100svh]" />}>
          <HeroSection reducedEffects={reducedEffects} />
        </Suspense>
        {shouldEagerRenderDeferredSections ? (
          <>
            <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[30svh]" />}>
              <BenefitsImageSection />
            </Suspense>
            <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[30svh]" />}>
              <NewsletterSignup reducedEffects={reducedEffects} />
            </Suspense>
            <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[30svh]" />}>
              <TeaserSection reducedEffects={reducedEffects} />
            </Suspense>
            <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}>
              <AffiliatePromoSection reducedEffects={reducedEffects} />
            </Suspense>
            <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}>
              <AboutSection reducedEffects={reducedEffects} />
            </Suspense>
            <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[76svh]" />}>
              <TestimonialsSection reducedEffects={reducedEffects} />
            </Suspense>
            <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}>
              <ContactSection reducedEffects={reducedEffects} />
            </Suspense>
            <Suspense fallback={<LandingSectionFallback className="pb-10 pt-0" minHeightClassName="min-h-[14rem]" />}>
              <LandingFooter />
            </Suspense>
          </>
        ) : (
          <>
            <DeferredRender
              fallback={<LandingSectionFallback minHeightClassName="min-h-[30svh]" />}
              rootMargin={deferredRootMargin}
            >
              <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[30svh]" />}>
                <BenefitsImageSection />
              </Suspense>
            </DeferredRender>
            <DeferredRender
              fallback={<LandingSectionFallback minHeightClassName="min-h-[26svh]" />}
              rootMargin={deferredRootMargin}
            >
              <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[26svh]" />}>
                <NewsletterSignup reducedEffects={reducedEffects} />
              </Suspense>
            </DeferredRender>
            <DeferredRender
              fallback={<LandingSectionFallback minHeightClassName="min-h-[30svh]" />}
              rootMargin={deferredRootMargin}
            >
              <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[30svh]" />}>
                <TeaserSection reducedEffects={reducedEffects} />
              </Suspense>
            </DeferredRender>
            <DeferredRender
              fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}
              rootMargin={deferredRootMargin}
            >
              <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[72svh]" />}>
                <AffiliatePromoSection reducedEffects={reducedEffects} />
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
              <Suspense
                fallback={<LandingSectionFallback className="pb-10 pt-0" minHeightClassName="min-h-[14rem]" />}
              >
                <LandingFooter />
              </Suspense>
            </DeferredRender>
          </>
        )}
      </div>
    </Rayd8Background>
  )
}
