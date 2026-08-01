import type { EffectivePerformanceProfile } from './adaptivePerformanceTypes'

export interface AdaptiveRuntimeController {
  id: string
  applyProfile: (profile: EffectivePerformanceProfile) => void
  dispose?: () => void
  status?: () => Record<string, unknown>
}

const controllers = new Map<string, AdaptiveRuntimeController>()
const failureCounts = new Map<string, { count: number; lastLoggedAt: number }>()

/**
 * Register a controller. Returns unregister.
 * Invariant: at most one active controller per id.
 */
export function registerRuntimeController(controller: AdaptiveRuntimeController): () => void {
  const existing = controllers.get(controller.id)
  if (existing && existing !== controller) {
    try {
      existing.dispose?.()
    } catch {
      /* prior dispose must not block remount */
    }
  }
  controllers.set(controller.id, controller)
  return () => {
    if (controllers.get(controller.id) === controller) {
      controllers.delete(controller.id)
      try {
        controller.dispose?.()
      } catch {
        /* ignore */
      }
    }
  }
}

export function unregisterRuntimeController(id: string) {
  const controller = controllers.get(id)
  if (!controller) {
    return
  }
  controllers.delete(id)
  try {
    controller.dispose?.()
  } catch {
    /* ignore */
  }
}

export function getRuntimeController(id: string) {
  return controllers.get(id) ?? null
}

export function listRuntimeControllers() {
  return Array.from(controllers.values()).map((controller) => ({
    id: controller.id,
    status: controller.status?.() ?? {},
  }))
}

export function getRuntimeControllerCount() {
  return controllers.size
}

export function recordControllerFailure(id: string, error: unknown) {
  const now = Date.now()
  const prior = failureCounts.get(id) ?? { count: 0, lastLoggedAt: 0 }
  prior.count += 1
  // Rate-limit production logs (~1 / 10s per controller).
  if (now - prior.lastLoggedAt > 10_000) {
    prior.lastLoggedAt = now
    const isDev =
      typeof import.meta !== 'undefined' &&
      Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV)
    if (isDev) {
      console.warn(`[adaptive-perf] controller ${id} apply failed`, error)
    }
  }
  failureCounts.set(id, prior)
}

export function getControllerFailureCount(id: string) {
  return failureCounts.get(id)?.count ?? 0
}

/** Dispatch profile to all controllers with failure isolation. */
export function applyProfileToControllers(profile: EffectivePerformanceProfile) {
  for (const controller of controllers.values()) {
    try {
      controller.applyProfile(profile)
    } catch (error) {
      recordControllerFailure(controller.id, error)
    }
  }
}

/** @deprecated Prefer applyProfileToControllers with EffectivePerformanceProfile */
export function applyReducedVisualPerformance() {
  applyProfileToControllers({
    version: 1,
    mode: 'reduced',
    effectiveTier: 'reduced',
    visualEffectsTier: 'reduced',
    targetFps: 20,
    renderScale: 0.75,
    maxDevicePixelRatio: 1.2,
    allowDecorativeMotion: false,
    allowHeavyBlur: false,
    allowAnimatedGradients: false,
    mediaNetworkPolicy: 'conservative',
    pauseOffscreenRendering: true,
    pauseHiddenTabRendering: true,
    reason: 'legacy_apply_reduced',
    lastTierChangeAt: null,
    ordinaryTierChangesThisSession: 0,
    activityState: 'page-active',
  })
}

/** @deprecated Prefer applyProfileToControllers with EffectivePerformanceProfile */
export function applyStandardVisualPerformance() {
  applyProfileToControllers({
    version: 1,
    mode: 'standard',
    effectiveTier: 'standard',
    visualEffectsTier: 'standard',
    targetFps: 30,
    renderScale: 1,
    maxDevicePixelRatio: 1.65,
    allowDecorativeMotion: true,
    allowHeavyBlur: true,
    allowAnimatedGradients: true,
    mediaNetworkPolicy: 'auto',
    pauseOffscreenRendering: true,
    pauseHiddenTabRendering: true,
    reason: 'legacy_apply_standard',
    lastTierChangeAt: null,
    ordinaryTierChangesThisSession: 0,
    activityState: 'page-active',
  })
}

/** Test helper — clear registry between unit tests. */
export function __resetRuntimeControllersForTests() {
  controllers.clear()
  failureCounts.clear()
}
