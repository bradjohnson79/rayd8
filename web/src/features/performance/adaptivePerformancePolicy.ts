import type {
  EffectiveTier,
  ObservationWindow,
  PerformanceMode,
  PerformanceSample,
  TierDecision,
} from './adaptivePerformanceTypes'
import { downgradeTier, recoverTier, tierIndex } from './adaptivePerformanceTypes'

/** Thresholds derived from baseline structure; tunable via tests. */
export interface AdaptivePolicyConfig {
  frameStressMultiplier: number
  frameStressSampleCount: number
  longTaskStressCount: number
  ordinaryMinIntervalMs: number
  downgradeResidenceMs: number
  recoveryResidenceMs: number
  maxOrdinaryTierChangesPerSession: number
  criticalFrameMultiplier: number
  criticalLongTaskCount: number
  heapGrowthRatioWithPrimary: number
}

export const DEFAULT_POLICY_CONFIG: AdaptivePolicyConfig = {
  frameStressMultiplier: 1.6,
  frameStressSampleCount: 3,
  longTaskStressCount: 3,
  ordinaryMinIntervalMs: 30_000,
  downgradeResidenceMs: 25_000,
  recoveryResidenceMs: 90_000,
  maxOrdinaryTierChangesPerSession: 4,
  criticalFrameMultiplier: 2.5,
  criticalLongTaskCount: 8,
  heapGrowthRatioWithPrimary: 1.25,
}

export interface PolicyContext {
  mode: PerformanceMode
  currentTier: EffectiveTier
  now: number
  lastTierChangeAt: number | null
  ordinaryTierChangesThisSession: number
  /** First heap sample in window for supporting coincidence check */
  baselineHeapUsedBytes: number | null
}

function recentSamples(window: ObservationWindow, count: number): PerformanceSample[] {
  return window.samples.slice(-count)
}

function hasSustainedFrameStress(
  window: ObservationWindow,
  config: AdaptivePolicyConfig,
  multiplier: number,
): boolean {
  const targetInterval = 1000 / Math.max(1, window.targetFps)
  const recent = recentSamples(window, config.frameStressSampleCount)
  if (recent.length < config.frameStressSampleCount) {
    return false
  }
  return recent.every(
    (sample) =>
      sample.frameIntervalMs != null &&
      sample.frameIntervalMs > targetInterval * multiplier,
  )
}

function hasLongTaskStress(window: ObservationWindow, threshold: number): boolean {
  const last = window.samples[window.samples.length - 1]
  return Boolean(last && last.longTaskCountWindow >= threshold)
}

function hasBuffering(window: ObservationWindow): boolean {
  return window.samples.slice(-3).some((sample) => sample.buffering)
}

function hasResourceGrowth(window: ObservationWindow): boolean {
  if (window.samples.length < 4) {
    return false
  }
  const first = window.samples[0]!.registeredResourceCount
  const last = window.samples[window.samples.length - 1]!.registeredResourceCount
  return last > first + 2
}

function hasPrimaryStress(window: ObservationWindow, config: AdaptivePolicyConfig): boolean {
  return (
    hasSustainedFrameStress(window, config, config.frameStressMultiplier) ||
    hasLongTaskStress(window, config.longTaskStressCount) ||
    hasBuffering(window) ||
    hasResourceGrowth(window)
  )
}

function hasCriticalStress(window: ObservationWindow, config: AdaptivePolicyConfig): boolean {
  return (
    hasSustainedFrameStress(window, config, config.criticalFrameMultiplier) &&
    hasLongTaskStress(window, config.criticalLongTaskCount)
  )
}

/** Heap alone never triggers; only coincident with primary. */
function hasCoincidentHeapPressure(
  window: ObservationWindow,
  context: PolicyContext,
  config: AdaptivePolicyConfig,
): boolean {
  if (context.baselineHeapUsedBytes == null || context.baselineHeapUsedBytes <= 0) {
    return false
  }
  const last = window.samples[window.samples.length - 1]
  if (!last?.heapUsedBytes) {
    return false
  }
  const grown =
    last.heapUsedBytes >= context.baselineHeapUsedBytes * config.heapGrowthRatioWithPrimary
  return grown && hasPrimaryStress(window, config)
}

function residenceOk(
  context: PolicyContext,
  config: AdaptivePolicyConfig,
  recovering: boolean,
): boolean {
  if (context.lastTierChangeAt == null) {
    return true
  }
  const elapsed = context.now - context.lastTierChangeAt
  return recovering
    ? elapsed >= config.recoveryResidenceMs
    : elapsed >= config.downgradeResidenceMs
}

function rateOk(context: PolicyContext, config: AdaptivePolicyConfig): boolean {
  if (context.lastTierChangeAt == null) {
    return true
  }
  return context.now - context.lastTierChangeAt >= config.ordinaryMinIntervalMs
}

function healthyWindow(window: ObservationWindow, config: AdaptivePolicyConfig): boolean {
  if (window.samples.length < config.frameStressSampleCount) {
    return false
  }
  const targetInterval = 1000 / Math.max(1, window.targetFps)
  const recent = recentSamples(window, config.frameStressSampleCount)
  const framesOk = recent.every(
    (sample) =>
      sample.frameIntervalMs == null ||
      sample.frameIntervalMs <= targetInterval * 1.25,
  )
  const tasksOk = !hasLongTaskStress(window, config.longTaskStressCount)
  const bufferOk = !hasBuffering(window)
  return framesOk && tasksOk && bufferOk
}

/**
 * Pure policy: observation window → tier decision.
 * Deterministic for identical inputs.
 */
export function decideTierTransition(
  window: ObservationWindow,
  context: PolicyContext,
  config: AdaptivePolicyConfig = DEFAULT_POLICY_CONFIG,
): TierDecision {
  if (context.mode === 'reduced') {
    return { action: 'hold', reason: 'user_mode_reduced' }
  }

  if (context.mode === 'standard') {
    return { action: 'hold', reason: 'user_mode_standard' }
  }

  // automatic
  if (window.samples.some((sample) => sample.hidden)) {
    return { action: 'hold', reason: 'hidden_freeze_policy' }
  }

  const critical = hasCriticalStress(window, config)
  const primary =
    hasPrimaryStress(window, config) || hasCoincidentHeapPressure(window, context, config)

  if (critical && context.currentTier !== 'reduced') {
    const to = downgradeTier(context.currentTier)
    return {
      action: 'downgrade',
      to,
      reason: 'critical_frame_and_long_task_stress',
      emergency: true,
    }
  }

  if (primary && context.currentTier !== 'reduced') {
    if (context.ordinaryTierChangesThisSession >= config.maxOrdinaryTierChangesPerSession) {
      return { action: 'hold', reason: 'session_ordinary_change_cap' }
    }
    if (!rateOk(context, config) || !residenceOk(context, config, false)) {
      return { action: 'hold', reason: 'downgrade_residence_or_rate' }
    }
    return {
      action: 'downgrade',
      to: downgradeTier(context.currentTier),
      reason: 'sustained_primary_stress',
    }
  }

  if (
    healthyWindow(window, config) &&
    context.currentTier !== 'standard' &&
    residenceOk(context, config, true) &&
    rateOk(context, config)
  ) {
    if (context.ordinaryTierChangesThisSession >= config.maxOrdinaryTierChangesPerSession) {
      return { action: 'hold', reason: 'session_ordinary_change_cap' }
    }
    const to = recoverTier(context.currentTier)
    if (tierIndex(to) < tierIndex(context.currentTier)) {
      return { action: 'recover', to, reason: 'sustained_healthy_window' }
    }
  }

  return { action: 'hold', reason: 'stable' }
}

export function profileForTier(
  mode: PerformanceMode,
  tier: EffectiveTier,
  extras: {
    reason: string | null
    lastTierChangeAt: number | null
    ordinaryTierChangesThisSession: number
    activityState: import('./adaptivePerformanceTypes').AdaptiveActivityState
  },
): import('./adaptivePerformanceTypes').EffectivePerformanceProfile {
  const table = {
    standard: {
      targetFps: 30,
      renderScale: 1,
      maxDevicePixelRatio: 1.65,
      allowDecorativeMotion: true,
      allowHeavyBlur: true,
      allowAnimatedGradients: true,
      mediaNetworkPolicy: 'auto' as const,
    },
    balanced: {
      targetFps: 24,
      renderScale: 0.85,
      maxDevicePixelRatio: 1.35,
      allowDecorativeMotion: true,
      allowHeavyBlur: false,
      allowAnimatedGradients: false,
      mediaNetworkPolicy: 'standard' as const,
    },
    reduced: {
      targetFps: 20,
      renderScale: 0.75,
      maxDevicePixelRatio: 1.2,
      allowDecorativeMotion: false,
      allowHeavyBlur: false,
      allowAnimatedGradients: false,
      mediaNetworkPolicy: 'conservative' as const,
    },
  }[tier]

  return {
    version: 1,
    mode,
    effectiveTier: tier,
    visualEffectsTier: tier,
    targetFps: table.targetFps,
    renderScale: table.renderScale,
    maxDevicePixelRatio: table.maxDevicePixelRatio,
    allowDecorativeMotion: table.allowDecorativeMotion,
    allowHeavyBlur: table.allowHeavyBlur,
    allowAnimatedGradients: table.allowAnimatedGradients,
    mediaNetworkPolicy: table.mediaNetworkPolicy,
    pauseOffscreenRendering: true,
    pauseHiddenTabRendering: true,
    reason: extras.reason,
    lastTierChangeAt: extras.lastTierChangeAt,
    ordinaryTierChangesThisSession: extras.ordinaryTierChangesThisSession,
    activityState: extras.activityState,
  }
}
