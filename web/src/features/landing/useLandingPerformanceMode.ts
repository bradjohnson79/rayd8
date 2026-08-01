import { useEffect, useMemo, useState } from 'react'
import { useVisualPerformanceMode } from '../performance/useVisualPerformanceMode'
import { resolveVisualPerformanceProfile } from '../performance/visualPerformancePreference'
import type { LandingAmbientProfile } from './landingAmbientProfile'

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isFirefoxBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  return /firefox/i.test(navigator.userAgent)
}

function readSaveData(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean }
    }
  ).connection
  return Boolean(connection?.saveData)
}

function readDeviceMemoryLessThanFour(): boolean {
  const navigatorWithMemory = navigator as Navigator & {
    deviceMemory?: number
  }
  return (
    typeof navigatorWithMemory.deviceMemory === 'number' && navigatorWithMemory.deviceMemory < 4
  )
}

function computeProfile(signals: {
  reducedMotion: boolean
  saveData: boolean
  deviceMemoryLow: boolean
  mobileViewport: boolean
  firefox: boolean
  batteryLow: boolean
}): LandingAmbientProfile {
  if (signals.reducedMotion || signals.saveData) {
    return 'minimal'
  }

  if (signals.deviceMemoryLow && signals.mobileViewport) {
    return 'minimal'
  }

  if (signals.batteryLow) {
    return 'minimal'
  }

  if (signals.firefox || signals.mobileViewport || signals.deviceMemoryLow) {
    return 'balanced'
  }

  return 'cinematic'
}

export function useLandingPerformanceMode() {
  const { mode: visualPerformanceMode } = useVisualPerformanceMode()
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => readReducedMotion())
  const [saveData, setSaveData] = useState(() => readSaveData())
  const [batteryLow, setBatteryLow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onMq = () => setPrefersReducedMotion(mq.matches)
    mq.addEventListener('change', onMq)

    const syncCapabilities = () => {
      setIsMobileViewport(window.innerWidth < 640)
      setSaveData(readSaveData())
    }

    syncCapabilities()
    window.addEventListener('resize', syncCapabilities, { passive: true })

    let cancelled = false
    let removeBatteryListeners: (() => void) | undefined
    const batteryApi = (
      navigator as Navigator & {
        getBattery?: () => Promise<{
          addEventListener: (type: string, fn: () => void) => void
          removeEventListener: (type: string, fn: () => void) => void
          charging: boolean
          level: number
        }>
      }
    ).getBattery

    if (typeof batteryApi === 'function') {
      void batteryApi()
        .then((battery) => {
          if (cancelled) {
            return
          }
          const applyBattery = () => {
            setBatteryLow(!battery.charging && battery.level <= 0.22)
          }
          applyBattery()
          battery.addEventListener('chargingchange', applyBattery)
          battery.addEventListener('levelchange', applyBattery)
          removeBatteryListeners = () => {
            battery.removeEventListener('chargingchange', applyBattery)
            battery.removeEventListener('levelchange', applyBattery)
          }
        })
        .catch(() => {
          /* battery API unsupported */
        })
    }

    return () => {
      cancelled = true
      removeBatteryListeners?.()
      mq.removeEventListener('change', onMq)
      window.removeEventListener('resize', syncCapabilities)
    }
  }, [])

  const deviceMemoryLow = typeof navigator !== 'undefined' && readDeviceMemoryLessThanFour()

  const automaticProfile = useMemo(
    () =>
      computeProfile({
        batteryLow,
        deviceMemoryLow,
        firefox: isFirefoxBrowser(),
        mobileViewport: isMobileViewport,
        reducedMotion: prefersReducedMotion,
        saveData,
      }),
    [batteryLow, deviceMemoryLow, isMobileViewport, prefersReducedMotion, saveData],
  )

  const profile = useMemo(
    () => resolveVisualPerformanceProfile(visualPerformanceMode, automaticProfile),
    [automaticProfile, visualPerformanceMode],
  )

  const isLowCapabilityDevice = deviceMemoryLow || isMobileViewport

  const reducedEffects = profile !== 'cinematic' || prefersReducedMotion

  useEffect(() => {
    void import('../performance/runtimeControllers').then((mod) => {
      if (visualPerformanceMode === 'reduced' || profile === 'minimal') {
        mod.applyReducedVisualPerformance()
      } else {
        mod.applyStandardVisualPerformance()
      }
    })
    void import('../performance/runtimeResourceRegistry').then((mod) => {
      mod.setRuntimePerformanceMode(visualPerformanceMode)
    })
  }, [profile, visualPerformanceMode])

  return useMemo(
    () => ({
      isLowCapabilityDevice,
      isMobileViewport,
      prefersReducedMotion,
      profile,
      reducedEffects,
      visualPerformanceMode,
    }),
    [
      isLowCapabilityDevice,
      isMobileViewport,
      prefersReducedMotion,
      profile,
      reducedEffects,
      visualPerformanceMode,
    ],
  )
}
