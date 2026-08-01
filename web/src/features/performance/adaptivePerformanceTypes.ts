export type PerformanceMode = 'automatic' | 'standard' | 'reduced'

export type EffectiveTier = 'standard' | 'balanced' | 'reduced'

export type AdaptiveActivityState =
  | 'idle'
  | 'page-active'
  | 'session-active'
  | 'hidden'
  | 'disposed'

export type MediaNetworkPolicy = 'auto' | 'standard' | 'conservative'

export interface EffectivePerformanceProfile {
  version: 1
  mode: PerformanceMode
  effectiveTier: EffectiveTier
  targetFps: number
  renderScale: number
  maxDevicePixelRatio: number
  allowDecorativeMotion: boolean
  allowHeavyBlur: boolean
  allowAnimatedGradients: boolean
  visualEffectsTier: EffectiveTier
  mediaNetworkPolicy: MediaNetworkPolicy
  pauseOffscreenRendering: boolean
  pauseHiddenTabRendering: boolean
  reason: string | null
  lastTierChangeAt: number | null
  ordinaryTierChangesThisSession: number
  activityState: AdaptiveActivityState
}

export interface PerformanceSample {
  at: number
  frameIntervalMs: number | null
  longTaskCountWindow: number
  heapUsedBytes: number | null
  buffering: boolean
  registeredResourceCount: number
  hidden: boolean
}

export interface ObservationWindow {
  samples: PerformanceSample[]
  targetFps: number
}

export type TierDecision =
  | { action: 'hold'; reason: string }
  | { action: 'downgrade'; to: EffectiveTier; reason: string; emergency?: boolean }
  | { action: 'recover'; to: EffectiveTier; reason: string }

export const TIER_ORDER: EffectiveTier[] = ['standard', 'balanced', 'reduced']

export function tierIndex(tier: EffectiveTier): number {
  return TIER_ORDER.indexOf(tier)
}

export function downgradeTier(tier: EffectiveTier): EffectiveTier {
  const index = tierIndex(tier)
  return TIER_ORDER[Math.min(TIER_ORDER.length - 1, index + 1)]!
}

export function recoverTier(tier: EffectiveTier): EffectiveTier {
  const index = tierIndex(tier)
  return TIER_ORDER[Math.max(0, index - 1)]!
}
