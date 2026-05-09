import { useLandingPerformanceProfile } from './useLandingPerformanceProfile'

/** Strong card/footer shells (was ~backdrop-blur-2xl). */
export function useLandingBackdropStrong(): string {
  const { profile } = useLandingPerformanceProfile()
  if (profile === 'minimal') {
    return 'backdrop-blur-md'
  }
  if (profile === 'balanced') {
    return 'backdrop-blur-lg'
  }
  return 'backdrop-blur-2xl'
}

/** Medium surfaces (was ~backdrop-blur-xl). */
export function useLandingBackdropMedium(): string {
  const { profile } = useLandingPerformanceProfile()
  if (profile === 'minimal') {
    return 'backdrop-blur-sm'
  }
  if (profile === 'balanced') {
    return 'backdrop-blur-md'
  }
  return 'backdrop-blur-xl'
}

/** Large marketing panels (was ~shadow 24px / 90px spreads). */
export function useLandingPromoShadow(): string {
  const { profile } = useLandingPerformanceProfile()
  if (profile === 'minimal') {
    return 'shadow-[0_14px_48px_rgba(0,0,0,0.15)]'
  }
  if (profile === 'balanced') {
    return 'shadow-[0_18px_72px_rgba(0,0,0,0.2)]'
  }
  return 'shadow-[0_24px_90px_rgba(0,0,0,0.24)]'
}

/** Card stacks (was ~shadow-[0_24px_70px...]). */
export function useLandingCardShadow(): string {
  const { profile } = useLandingPerformanceProfile()
  if (profile === 'minimal') {
    return 'shadow-[0_14px_44px_rgba(0,0,0,0.14)]'
  }
  if (profile === 'balanced') {
    return 'shadow-[0_20px_58px_rgba(0,0,0,0.16)]'
  }
  return 'shadow-[0_24px_70px_rgba(0,0,0,0.18)]'
}

/** Footer / wide shells (was ~shadow-[0_20px_60px...]). */
export function useLandingFooterShadow(): string {
  const { profile } = useLandingPerformanceProfile()
  if (profile === 'minimal') {
    return 'shadow-[0_12px_40px_rgba(0,0,0,0.14)]'
  }
  if (profile === 'balanced') {
    return 'shadow-[0_16px_50px_rgba(0,0,0,0.17)]'
  }
  return 'shadow-[0_20px_60px_rgba(0,0,0,0.2)]'
}
