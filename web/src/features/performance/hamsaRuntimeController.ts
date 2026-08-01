import type { EffectivePerformanceProfile } from './adaptivePerformanceTypes'
import { broadcastAdaptivePerfProfile } from './adaptivePerformanceBridge'
import { registerRuntimeController, type AdaptiveRuntimeController } from './runtimeControllers'

let lastProfile: EffectivePerformanceProfile | null = null

function applyToSameOriginProbe(profile: EffectivePerformanceProfile) {
  const probe = (
    window as Window & {
      __HAMSA_PERF__?: {
        setRenderFPS: (fps: number) => void
        setRenderScale: (scale: number) => void
        pauseRendering: () => void
        resumeRendering: () => void
      }
    }
  ).__HAMSA_PERF__

  if (!probe) {
    return
  }

  probe.setRenderFPS(profile.targetFps)
  probe.setRenderScale(profile.renderScale)
  if (profile.pauseHiddenTabRendering && document.hidden) {
    probe.pauseRendering()
  } else {
    probe.resumeRendering()
  }
}

export function createHamsaRuntimeController(): AdaptiveRuntimeController {
  return {
    id: 'hamsa',
    applyProfile(profile) {
      lastProfile = profile
      // Versioned bridge is the production path for iframe Hamsa.
      broadcastAdaptivePerfProfile(profile)
      // Probe remains diagnostics / same-document soak helper.
      applyToSameOriginProbe(profile)
    },
    status: () => ({
      lastTier: lastProfile?.effectiveTier ?? null,
      targetFps: lastProfile?.targetFps ?? null,
      renderScale: lastProfile?.renderScale ?? null,
    }),
  }
}

export function installHamsaRuntimeController() {
  return registerRuntimeController(createHamsaRuntimeController())
}
