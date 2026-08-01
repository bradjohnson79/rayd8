import { useEffect, useState } from 'react'
import { getAdaptivePerformanceManager } from './adaptivePerformanceManager'
import type { EffectivePerformanceProfile } from './adaptivePerformanceTypes'

/**
 * Quiet Automatic status when downgraded — no popups.
 */
export function AdaptiveQuietStatus() {
  const [profile, setProfile] = useState<EffectivePerformanceProfile | null>(null)

  useEffect(() => {
    const manager = getAdaptivePerformanceManager()
    if (!manager) {
      return
    }
    return manager.subscribe(setProfile)
  }, [])

  if (
    !profile ||
    profile.mode !== 'automatic' ||
    profile.effectiveTier === 'standard' ||
    profile.activityState === 'idle' ||
    profile.activityState === 'disposed'
  ) {
    return null
  }

  return (
    <p
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-[70] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/55 px-4 py-2 text-center text-[11px] leading-5 text-slate-200 backdrop-blur-md"
    >
      RAYD8 is optimizing visual performance for this device.
    </p>
  )
}
