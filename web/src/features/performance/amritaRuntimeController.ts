import type { EffectivePerformanceProfile } from './adaptivePerformanceTypes'
import { broadcastAdaptivePerfProfile } from './adaptivePerformanceBridge'
import { registerRuntimeController, type AdaptiveRuntimeController } from './runtimeControllers'

let lastProfile: EffectivePerformanceProfile | null = null

/**
 * Production Amrita path uses the versioned postMessage adapter.
 * `__AMRITA_SOAK__` remains a soak/test helper only.
 */
function applyToSoakProbe(profile: EffectivePerformanceProfile) {
  const probe = (
    window as Window & {
      __AMRITA_SOAK__?: {
        setRenderFPS?: (fps: number) => void
        setRenderScale?: (scale: number) => void
        pauseRendering?: () => void
        resumeRendering?: () => void
      }
    }
  ).__AMRITA_SOAK__

  if (!probe) {
    return
  }

  probe.setRenderFPS?.(profile.targetFps)
  probe.setRenderScale?.(profile.renderScale)
  if (profile.pauseHiddenTabRendering && document.hidden) {
    probe.pauseRendering?.()
  } else {
    probe.resumeRendering?.()
  }
}

export function createAmritaRuntimeController(): AdaptiveRuntimeController {
  return {
    id: 'amrita',
    applyProfile(profile) {
      lastProfile = profile
      broadcastAdaptivePerfProfile(profile)
      applyToSoakProbe(profile)
    },
    status: () => ({
      lastTier: lastProfile?.effectiveTier ?? null,
      targetFps: lastProfile?.targetFps ?? null,
      renderScale: lastProfile?.renderScale ?? null,
      adapter: 'rayd8:adaptive-performance:v1',
    }),
  }
}

export function installAmritaRuntimeController() {
  return registerRuntimeController(createAmritaRuntimeController())
}
