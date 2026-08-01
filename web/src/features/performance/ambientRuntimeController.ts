import type { EffectivePerformanceProfile, EffectiveTier } from './adaptivePerformanceTypes'
import { registerRuntimeController, type AdaptiveRuntimeController } from './runtimeControllers'

export const AMBIENT_PROFILE_CHANGE_EVENT = 'rayd8:ambient-profile-change'

export type AmbientVisualTier = 'cinematic' | 'balanced' | 'minimal'

let currentAmbient: AmbientVisualTier = 'balanced'
let sessionForcesMinimal = false

export function mapEffectiveTierToAmbient(tier: EffectiveTier): AmbientVisualTier {
  if (tier === 'standard') {
    return 'cinematic'
  }
  if (tier === 'balanced') {
    return 'balanced'
  }
  return 'minimal'
}

export function getAmbientVisualTier(): AmbientVisualTier {
  if (sessionForcesMinimal) {
    return 'minimal'
  }
  return currentAmbient
}

function publishAmbient(tier: AmbientVisualTier) {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(
    new CustomEvent(AMBIENT_PROFILE_CHANGE_EVENT, {
      detail: { ambientProfile: tier },
    }),
  )
}

export function createAmbientRuntimeController(): AdaptiveRuntimeController {
  return {
    id: 'ambient',
    applyProfile(profile: EffectivePerformanceProfile) {
      sessionForcesMinimal = profile.activityState === 'session-active'
      currentAmbient = mapEffectiveTierToAmbient(profile.visualEffectsTier)
      if (!profile.allowDecorativeMotion) {
        currentAmbient = 'minimal'
      }
      publishAmbient(getAmbientVisualTier())
    },
    status: () => ({
      ambient: getAmbientVisualTier(),
      sessionForcesMinimal,
    }),
  }
}

export function installAmbientRuntimeController() {
  return registerRuntimeController(createAmbientRuntimeController())
}
