import type { EffectivePerformanceProfile } from './adaptivePerformanceTypes'

export const ADAPTIVE_PERF_MESSAGE_TYPE = 'rayd8:adaptive-performance:v1' as const

export type AdaptivePerfApplyMessage = {
  type: typeof ADAPTIVE_PERF_MESSAGE_TYPE
  action: 'applyProfile'
  profile: EffectivePerformanceProfile
}

export function isAdaptivePerfApplyMessage(data: unknown): data is AdaptivePerfApplyMessage {
  if (!data || typeof data !== 'object') {
    return false
  }
  const message = data as Partial<AdaptivePerfApplyMessage>
  return (
    message.type === ADAPTIVE_PERF_MESSAGE_TYPE &&
    message.action === 'applyProfile' &&
    Boolean(message.profile) &&
    (message.profile as EffectivePerformanceProfile).version === 1
  )
}

export function createAdaptivePerfApplyMessage(
  profile: EffectivePerformanceProfile,
): AdaptivePerfApplyMessage {
  return {
    type: ADAPTIVE_PERF_MESSAGE_TYPE,
    action: 'applyProfile',
    profile,
  }
}

/** Broadcast to same-origin iframe windows registered by session hosts. */
const iframeTargets = new Set<Window>()

export function registerAdaptivePerfIframeTarget(win: Window | null | undefined) {
  if (!win || win === window) {
    return () => undefined
  }
  iframeTargets.add(win)
  return () => {
    iframeTargets.delete(win)
  }
}

export function broadcastAdaptivePerfProfile(profile: EffectivePerformanceProfile) {
  const message = createAdaptivePerfApplyMessage(profile)
  for (const target of iframeTargets) {
    try {
      target.postMessage(message, window.location.origin)
    } catch {
      /* disposed iframe */
    }
  }
}
