import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

export function useLandingPerformanceMode() {
  const prefersReducedMotion = useReducedMotion()
  const [isLowCapabilityDevice, setIsLowCapabilityDevice] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const navigatorWithMemory = navigator as Navigator & {
      deviceMemory?: number
    }

    const syncCapabilities = () => {
      const lowMemory =
        typeof navigatorWithMemory.deviceMemory === 'number'
          ? navigatorWithMemory.deviceMemory < 4
          : false
      const compactViewport = window.innerWidth < 640

      setIsLowCapabilityDevice(lowMemory || compactViewport)
      setIsMobileViewport(compactViewport)
    }

    syncCapabilities()
    window.addEventListener('resize', syncCapabilities, { passive: true })
    return () => window.removeEventListener('resize', syncCapabilities)
  }, [])

  return useMemo(
    () => ({
      isLowCapabilityDevice,
      isMobileViewport,
      reducedEffects: Boolean(prefersReducedMotion || isLowCapabilityDevice),
    }),
    [isLowCapabilityDevice, isMobileViewport, prefersReducedMotion],
  )
}
