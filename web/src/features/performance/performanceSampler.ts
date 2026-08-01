import type { AdaptiveActivityState, PerformanceSample } from './adaptivePerformanceTypes'

export interface PerformanceSamplerOptions {
  getRegisteredResourceCount?: () => number
  getBuffering?: () => boolean
  now?: () => number
}

/**
 * Low-cost observation gatherer. No tier decisions.
 * Connects/disconnects based on activity state.
 */
export class PerformanceSampler {
  private readonly options: PerformanceSamplerOptions
  private activity: AdaptiveActivityState = 'idle'
  private frameTimes: number[] = []
  private longTaskCountWindow = 0
  private rafId: number | null = null
  private intervalId: number | null = null
  private longTaskObserver: PerformanceObserver | null = null
  private lastSample: PerformanceSample | null = null
  private onSample: ((sample: PerformanceSample) => void) | null = null

  constructor(options: PerformanceSamplerOptions = {}) {
    this.options = options
  }

  setActivityState(state: AdaptiveActivityState) {
    if (this.activity === state) {
      return
    }
    this.activity = state
    this.reconfigure()
  }

  subscribe(handler: (sample: PerformanceSample) => void) {
    this.onSample = handler
    return () => {
      if (this.onSample === handler) {
        this.onSample = null
      }
    }
  }

  getLastSample() {
    return this.lastSample
  }

  /** Test seam: push a synthetic sample without observers. */
  injectSample(sample: PerformanceSample) {
    this.lastSample = sample
    this.onSample?.(sample)
  }

  dispose() {
    this.activity = 'disposed'
    this.teardownObservers()
    this.onSample = null
  }

  private reconfigure() {
    this.teardownObservers()

    if (typeof window === 'undefined') {
      return
    }

    if (this.activity === 'idle' || this.activity === 'disposed') {
      return
    }

    if (this.activity === 'hidden') {
      // Visibility-focused: infrequent sample only.
      this.intervalId = window.setInterval(() => this.emitSample(), 5_000)
      this.emitSample()
      return
    }

    if (this.activity === 'page-active') {
      this.intervalId = window.setInterval(() => this.emitSample(), 4_000)
      this.startLightRafProbe()
      this.emitSample()
      return
    }

    // session-active
    this.intervalId = window.setInterval(() => this.emitSample(), 1_500)
    this.startLightRafProbe()
    this.startLongTaskObserver()
    this.emitSample()
  }

  private startLightRafProbe() {
    let last = this.now()
    const tick = (time: number) => {
      this.frameTimes.push(time - last)
      if (this.frameTimes.length > 30) {
        this.frameTimes.shift()
      }
      last = time
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private startLongTaskObserver() {
    if (typeof PerformanceObserver === 'undefined') {
      return
    }
    try {
      this.longTaskObserver = new PerformanceObserver((list) => {
        this.longTaskCountWindow += list.getEntries().length
      })
      this.longTaskObserver.observe({
        entryTypes: ['longtask'] as string[],
      } as PerformanceObserverInit)
    } catch {
      this.longTaskObserver = null
    }
  }

  private teardownObservers() {
    if (this.rafId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.intervalId != null && typeof clearInterval === 'function') {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.longTaskObserver?.disconnect()
    this.longTaskObserver = null
    this.frameTimes = []
    this.longTaskCountWindow = 0
  }

  private emitSample() {
    const intervals = this.frameTimes.slice(-10)
    const frameIntervalMs =
      intervals.length > 0
        ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
        : null

    let heapUsedBytes: number | null = null
    const memory = (
      performance as Performance & { memory?: { usedJSHeapSize?: number } }
    ).memory
    if (typeof memory?.usedJSHeapSize === 'number') {
      heapUsedBytes = memory.usedJSHeapSize
    }

    const sample: PerformanceSample = {
      at: this.now(),
      frameIntervalMs,
      longTaskCountWindow: this.longTaskCountWindow,
      heapUsedBytes,
      buffering: this.options.getBuffering?.() ?? false,
      registeredResourceCount: this.options.getRegisteredResourceCount?.() ?? 0,
      hidden: typeof document !== 'undefined' ? document.hidden : false,
    }

    // Decay long-task window after each emit so counts are per-interval.
    this.longTaskCountWindow = 0
    this.lastSample = sample
    this.onSample?.(sample)
  }

  private now() {
    return this.options.now?.() ?? Date.now()
  }
}
