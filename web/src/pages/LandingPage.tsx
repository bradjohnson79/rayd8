import { Suspense, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Rayd8Background } from '../components/Rayd8Background'
import { useAuthReadiness } from '../features/auth/useAuthReadiness'
import { LandingNavbar } from '../features/landing/LandingNavbar'
import { LandingPerformanceProfileProvider } from '../features/landing/LandingPerformanceProfileProvider'
import { DeferredRender } from '../features/landing/components/DeferredRender'
import { lazyWithPreload } from '../features/landing/lazyWithPreload'
import { useLandingPerformanceMode } from '../features/landing/useLandingPerformanceMode'
import { useStandaloneMode } from '../features/pwa/useStandaloneMode'

const HeroSection = lazyWithPreload(() =>
  import('../features/landing/HeroSection').then((module) => ({ default: module.HeroSection })),
)
const Rayd8ExpressPromoSection = lazyWithPreload(() =>
  import('../features/landing/Rayd8ExpressPromoSection').then((module) => ({
    default: module.Rayd8ExpressPromoSection,
  })),
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
        className={`mx-auto max-w-7xl rounded-[2rem] border border-white/8 bg-white/[0.03] ${minHeightClassName} backdrop-blur-xl`}
      />
    </div>
  )
}

export function LandingPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const standalone = useStandaloneMode()
  const { status } = useAuthReadiness()
  const { isMobileViewport, reducedEffects, profile } = useLandingPerformanceMode()
  const shouldEagerRenderDeferredSections = Boolean(location.hash)

  const deferredRootMargin = useMemo(() => {
    if (profile === 'cinematic') {
      return isMobileViewport ? '160px 0px' : '320px 0px'
    }
    if (profile === 'balanced') {
      return isMobileViewport ? '80px 0px' : '160px 0px'
    }
    return isMobileViewport ? '48px 0px' : '96px 0px'
  }, [isMobileViewport, profile])

  useEffect(() => {
    if (!standalone || status === 'loading') {
      return
    }

    navigate(status === 'signed-in' ? '/dashboard?source=express' : '/signup?source=express', {
      replace: true,
    })
  }, [navigate, standalone, status])

  useEffect(() => {
    if (shouldEagerRenderDeferredSections) {
      return undefined
    }

    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const preloadNearFoldSections = () => {
      void Rayd8ExpressPromoSection.preload()
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

    const nearFoldFallbackMs = profile === 'minimal' ? 1400 : profile === 'balanced' ? 1000 : 800
    const lowerIdleDelayMs = profile === 'minimal' ? 4200 : profile === 'balanced' ? 2800 : 2000

    if (windowWithIdle.requestIdleCallback) {
      const nearFoldIdleId = windowWithIdle.requestIdleCallback(preloadNearFoldSections)
      const lowerPriorityTimeoutId = window.setTimeout(() => {
        windowWithIdle.requestIdleCallback?.(preloadLowerPrioritySections, {
          timeout: profile === 'minimal' ? 8000 : 4000,
        })
      }, lowerIdleDelayMs)

      return () => {
        windowWithIdle.cancelIdleCallback?.(nearFoldIdleId)
        window.clearTimeout(lowerPriorityTimeoutId)
      }
    }

    const nearFoldTimeoutId = window.setTimeout(preloadNearFoldSections, nearFoldFallbackMs)
    const lowerPriorityTimeoutId = window.setTimeout(
      preloadLowerPrioritySections,
      lowerIdleDelayMs + (profile === 'minimal' ? 2200 : profile === 'balanced' ? 1200 : 800),
    )

    return () => {
      window.clearTimeout(nearFoldTimeoutId)
      window.clearTimeout(lowerPriorityTimeoutId)
    }
  }, [profile, shouldEagerRenderDeferredSections])

  useEffect(() => {
    const hashId = location.hash.replace('#', '')

    if (!hashId) {
      return
    }

    if (hashId === 'teaser') {
      void TeaserSection.preload()
    } else if (hashId === 'affiliate-program') {
      void AffiliatePromoSection.preload()
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
    <Rayd8Background
      ambientProfile={profile}
      intensity="low"
      reducedEffects={reducedEffects}
      variant="landing"
    >
      <LandingPerformanceProfileProvider profile={profile}>
        <div className="relative z-10">
          <LandingNavbar />
          <Suspense
            fallback={<LandingSectionFallback className="pt-4" minHeightClassName="min-h-[100svh]" />}
          >
            <HeroSection reducedEffects={reducedEffects} />
          </Suspense>
          <Suspense fallback={<LandingSectionFallback minHeightClassName="min-h-[34svh]" />}>
            <Rayd8ExpressPromoSection reducedEffects={reducedEffects} />
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
              <Suspense
                fallback={<LandingSectionFallback className="pb-10 pt-0" minHeightClassName="min-h-[14rem]" />}
              >
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
                  fallback={
                    <LandingSectionFallback className="pb-10 pt-0" minHeightClassName="min-h-[14rem]" />
                  }
                >
                  <LandingFooter />
                </Suspense>
              </DeferredRender>
            </>
          )}
        </div>
      </LandingPerformanceProfileProvider>
    </Rayd8Background>
  )
}
