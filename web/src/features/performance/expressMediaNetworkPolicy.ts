import type { EffectivePerformanceProfile, MediaNetworkPolicy } from './adaptivePerformanceTypes'
import { registerRuntimeController, type AdaptiveRuntimeController } from './runtimeControllers'

export const EXPRESS_MEDIA_POLICY_EVENT = 'rayd8:express-media-network-policy'

export interface ExpressMediaNetworkState {
  policy: MediaNetworkPolicy
  lastChangeAt: number | null
  reason: string | null
  /** Minimum residence before another ordinary media quality change */
  minResidenceMs: number
  allowQualityChange: boolean
}

const MIN_RENDITION_RESIDENCE_MS = 45_000
const RECOVERY_RESIDENCE_MS = 120_000

let state: ExpressMediaNetworkState = {
  policy: 'auto',
  lastChangeAt: null,
  reason: null,
  minResidenceMs: MIN_RENDITION_RESIDENCE_MS,
  allowQualityChange: true,
}

let fragileOperation = false

export function getExpressMediaNetworkState() {
  return { ...state }
}

export function setExpressMediaFragileOperation(active: boolean) {
  fragileOperation = active
  state = {
    ...state,
    allowQualityChange: !active && state.policy !== 'conservative',
  }
}

/**
 * Conservative media rules separate from GPU visual tier.
 * Buffering/network stress may tighten policy; healthy decoder avoids forced changes.
 */
export function recommendMediaPolicyFromBuffering(input: {
  buffering: boolean
  decoderHealthy: boolean
  now?: number
}): MediaNetworkPolicy | null {
  const now = input.now ?? Date.now()
  if (fragileOperation) {
    return null
  }
  if (input.buffering) {
    if (
      state.lastChangeAt != null &&
      now - state.lastChangeAt < MIN_RENDITION_RESIDENCE_MS &&
      state.policy === 'conservative'
    ) {
      return null
    }
    return 'conservative'
  }
  if (input.decoderHealthy && state.policy === 'conservative') {
    if (state.lastChangeAt != null && now - state.lastChangeAt < RECOVERY_RESIDENCE_MS) {
      return null
    }
    return 'standard'
  }
  return null
}

export function applyExpressMediaNetworkPolicy(
  policy: MediaNetworkPolicy,
  reason: string,
  now = Date.now(),
) {
  if (state.policy === policy) {
    return
  }
  state = {
    policy,
    lastChangeAt: now,
    reason,
    minResidenceMs:
      policy === 'conservative' ? MIN_RENDITION_RESIDENCE_MS : RECOVERY_RESIDENCE_MS,
    allowQualityChange: !fragileOperation,
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(EXPRESS_MEDIA_POLICY_EVENT, {
        detail: getExpressMediaNetworkState(),
      }),
    )
  }
}

export function mediaStabilityBiasForPolicy(policy: MediaNetworkPolicy): {
  startLevel: number
  maxMaxBufferLength: number
  capLevelToPlayerSize: boolean
} {
  if (policy === 'conservative') {
    return {
      startLevel: 0,
      maxMaxBufferLength: 48,
      capLevelToPlayerSize: true,
    }
  }
  if (policy === 'standard') {
    return {
      startLevel: 1,
      maxMaxBufferLength: 60,
      capLevelToPlayerSize: true,
    }
  }
  return {
    startLevel: -1,
    maxMaxBufferLength: 72,
    capLevelToPlayerSize: true,
  }
}

export function createExpressMediaRuntimeController(): AdaptiveRuntimeController {
  return {
    id: 'express-media',
    applyProfile(profile: EffectivePerformanceProfile) {
      // Visual GPU tier must not forcibly oscillate media quality.
      // Only adopt profile media policy when not in a fragile seek/reconnect.
      if (fragileOperation) {
        return
      }
      applyExpressMediaNetworkPolicy(
        profile.mediaNetworkPolicy,
        `profile_${profile.effectiveTier}`,
      )
    },
    status: () => getExpressMediaNetworkState(),
  }
}

export function installExpressMediaRuntimeController() {
  return registerRuntimeController(createExpressMediaRuntimeController())
}
