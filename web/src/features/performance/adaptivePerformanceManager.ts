import {
  decideTierTransition,
  DEFAULT_POLICY_CONFIG,
  profileForTier,
} from './adaptivePerformancePolicy'
import type {
  AdaptiveActivityState,
  EffectivePerformanceProfile,
  EffectiveTier,
  PerformanceMode,
  PerformanceSample,
} from './adaptivePerformanceTypes'
import { PerformanceSampler } from './performanceSampler'
import { installAmbientRuntimeController } from './ambientRuntimeController'
import { installAmritaRuntimeController } from './amritaRuntimeController'
import { installExpressMediaRuntimeController } from './expressMediaNetworkPolicy'
import { installHamsaRuntimeController } from './hamsaRuntimeController'
import { applyProfileToControllers } from './runtimeControllers'
import { getRuntimeResourceSnapshot } from './runtimeResourceRegistry'
import {
  readVisualPerformanceMode,
  VISUAL_PERFORMANCE_CHANGE_EVENT,
  type VisualPerformanceMode,
} from './visualPerformancePreference'

type ProfileListener = (profile: EffectivePerformanceProfile) => void

const MAX_WINDOW_SAMPLES = 20

export class AdaptivePerformanceManager {
  private mode: PerformanceMode = 'automatic'
  private activityState: AdaptiveActivityState = 'idle'
  private tier: EffectiveTier = 'standard'
  private profile: EffectivePerformanceProfile
  private lastTierChangeAt: number | null = null
  private ordinaryTierChangesThisSession = 0
  private baselineHeapUsedBytes: number | null = null
  private samples: PerformanceSample[] = []
  private listeners = new Set<ProfileListener>()
  private sampler: PerformanceSampler
  private visibilityHandler: (() => void) | null = null
  private preferenceHandler: ((event: Event) => void) | null = null
  private disposed = false
  private sessionCount = 0
  private pageActive = false

  constructor() {
    this.mode = readVisualPerformanceMode()
    this.tier = this.mode === 'reduced' ? 'reduced' : 'standard'
    this.profile = this.buildProfile('init')
    this.sampler = new PerformanceSampler({
      getRegisteredResourceCount: () => getRuntimeResourceSnapshot().resources.length,
      now: () => Date.now(),
    })
    this.sampler.subscribe((sample) => this.onSample(sample))
  }

  install() {
    if (typeof window === 'undefined' || this.disposed) {
      return
    }

    this.preferenceHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: VisualPerformanceMode }>).detail
      if (detail?.mode) {
        this.setUserMode(detail.mode)
      } else {
        this.setUserMode(readVisualPerformanceMode())
      }
    }
    window.addEventListener(VISUAL_PERFORMANCE_CHANGE_EVENT, this.preferenceHandler)

    this.visibilityHandler = () => {
      this.recomputeActivity('visibility')
    }
    document.addEventListener('visibilitychange', this.visibilityHandler)

    // Default: page may be active after install.
    this.pageActive = true
    this.recomputeActivity('install')
    this.publishIfChanged(true)
  }

  dispose() {
    this.disposed = true
    this.activityState = 'disposed'
    this.sampler.dispose()
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
    if (this.preferenceHandler && typeof window !== 'undefined') {
      window.removeEventListener(VISUAL_PERFORMANCE_CHANGE_EVENT, this.preferenceHandler)
      this.preferenceHandler = null
    }
    this.listeners.clear()
  }

  subscribe(listener: ProfileListener) {
    this.listeners.add(listener)
    listener(this.profile)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getProfile() {
    return this.profile
  }

  getActivityState() {
    return this.activityState
  }

  getMode() {
    return this.mode
  }

  /** Surfaces report session lifecycle — manager is sole activity authority. */
  notifySessionStarted() {
    this.sessionCount += 1
    this.recomputeActivity('sessionStarted')
  }

  notifySessionStopped() {
    this.sessionCount = Math.max(0, this.sessionCount - 1)
    this.recomputeActivity('sessionStopped')
  }

  notifyRouteActive(active: boolean) {
    this.pageActive = active
    this.recomputeActivity(active ? 'routeActive' : 'routeDisposed')
  }

  setUserMode(mode: PerformanceMode) {
    if (this.mode === mode) {
      return
    }
    this.mode = mode
    if (mode === 'reduced') {
      this.applyTier('reduced', 'user_selected_reduced', false)
    } else if (mode === 'standard') {
      this.applyTier('standard', 'user_selected_standard', false)
    } else {
      // Automatic: keep current tier unless starting fresh above reduced preference.
      if (this.tier === 'reduced' && this.ordinaryTierChangesThisSession === 0) {
        this.applyTier('standard', 'user_selected_automatic', false)
      } else {
        this.profile = this.buildProfile('user_selected_automatic')
        this.publishIfChanged(true)
      }
    }
  }

  /** Test seam */
  __injectSample(sample: PerformanceSample) {
    this.onSample(sample)
  }

  __getSampler() {
    return this.sampler
  }

  private recomputeActivity(_reason: string) {
    if (this.disposed) {
      this.activityState = 'disposed'
      this.sampler.setActivityState('disposed')
      return
    }

    const hidden = typeof document !== 'undefined' && document.hidden
    let next: AdaptiveActivityState
    if (hidden && (this.sessionCount > 0 || this.pageActive)) {
      next = 'hidden'
    } else if (this.sessionCount > 0) {
      next = 'session-active'
    } else if (this.pageActive) {
      next = 'page-active'
    } else {
      next = 'idle'
    }

    if (next !== this.activityState) {
      this.activityState = next
      this.sampler.setActivityState(next)
      this.profile = this.buildProfile(this.profile.reason ?? 'activity_change')
      this.publishIfChanged(true)
    } else {
      this.sampler.setActivityState(next)
    }
  }

  private onSample(sample: PerformanceSample) {
    if (this.disposed || this.activityState === 'idle' || this.activityState === 'disposed') {
      return
    }

    this.samples.push(sample)
    if (this.samples.length > MAX_WINDOW_SAMPLES) {
      this.samples.shift()
    }
    if (this.baselineHeapUsedBytes == null && sample.heapUsedBytes != null) {
      this.baselineHeapUsedBytes = sample.heapUsedBytes
    }

    if (this.mode !== 'automatic' || this.activityState === 'hidden') {
      return
    }

    const decision = decideTierTransition(
      {
        samples: this.samples,
        targetFps: this.profile.targetFps,
      },
      {
        mode: this.mode,
        currentTier: this.tier,
        now: sample.at,
        lastTierChangeAt: this.lastTierChangeAt,
        ordinaryTierChangesThisSession: this.ordinaryTierChangesThisSession,
        baselineHeapUsedBytes: this.baselineHeapUsedBytes,
      },
      DEFAULT_POLICY_CONFIG,
    )

    if (decision.action === 'downgrade') {
      this.applyTier(decision.to, decision.reason, !decision.emergency)
    } else if (decision.action === 'recover') {
      this.applyTier(decision.to, decision.reason, true)
    }
  }

  private applyTier(tier: EffectiveTier, reason: string, countsAsOrdinary: boolean) {
    if (this.tier === tier && this.profile.reason === reason) {
      return
    }
    this.tier = tier
    this.lastTierChangeAt = Date.now()
    if (countsAsOrdinary) {
      this.ordinaryTierChangesThisSession += 1
    }
    this.profile = this.buildProfile(reason)
    this.publishIfChanged(true)
  }

  private buildProfile(reason: string | null): EffectivePerformanceProfile {
    return profileForTier(this.mode, this.tier, {
      reason,
      lastTierChangeAt: this.lastTierChangeAt,
      ordinaryTierChangesThisSession: this.ordinaryTierChangesThisSession,
      activityState: this.activityState,
    })
  }

  private publishIfChanged(forceDispatch: boolean) {
    applyProfileToControllers(this.profile)
    if (forceDispatch) {
      for (const listener of this.listeners) {
        listener(this.profile)
      }
    }
  }
}

let singleton: AdaptivePerformanceManager | null = null
const controllerUnregisters: Array<() => void> = []

export function getAdaptivePerformanceManager() {
  return singleton
}

export function installAdaptivePerformance() {
  if (typeof window === 'undefined') {
    return null
  }
  if (singleton) {
    return singleton
  }

  controllerUnregisters.push(
    installHamsaRuntimeController(),
    installAmritaRuntimeController(),
    installAmbientRuntimeController(),
    installExpressMediaRuntimeController(),
  )

  singleton = new AdaptivePerformanceManager()
  singleton.install()

  const w = window as Window & {
    __RAYD8_ADAPTIVE__?: {
      getProfile: () => EffectivePerformanceProfile
      getActivityState: () => AdaptiveActivityState
      notifySessionStarted: () => void
      notifySessionStopped: () => void
      notifyRouteActive: (active: boolean) => void
    }
  }
  w.__RAYD8_ADAPTIVE__ = {
    getProfile: () => singleton!.getProfile(),
    getActivityState: () => singleton!.getActivityState(),
    notifySessionStarted: () => singleton!.notifySessionStarted(),
    notifySessionStopped: () => singleton!.notifySessionStopped(),
    notifyRouteActive: (active: boolean) => singleton!.notifyRouteActive(active),
  }

  return singleton
}

export function disposeAdaptivePerformance() {
  singleton?.dispose()
  singleton = null
  while (controllerUnregisters.length > 0) {
    controllerUnregisters.pop()?.()
  }
  if (typeof window !== 'undefined') {
    delete (window as Window & { __RAYD8_ADAPTIVE__?: unknown }).__RAYD8_ADAPTIVE__
  }
}

export function __resetAdaptivePerformanceForTests() {
  disposeAdaptivePerformance()
}
