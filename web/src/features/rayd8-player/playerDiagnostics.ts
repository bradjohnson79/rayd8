import {
  getPlaybackSoakMetricsSnapshot,
  resetPlaybackSoakMetrics,
} from '../playback-authority/playbackSoakMetrics'

type DiagnosticCounter = Record<string, number>

interface PlayerDiagnosticsSnapshot {
  activeHlsInstances: DiagnosticCounter
  activeVideoLayers: DiagnosticCounter
  eventListeners: DiagnosticCounter
  hlsControllers: DiagnosticCounter
  renders: DiagnosticCounter
  soak?: ReturnType<typeof getPlaybackSoakMetricsSnapshot>
  sourceLoads: DiagnosticCounter
  timers: DiagnosticCounter
  videoMounts: DiagnosticCounter
}

interface Rayd8PlayerDebugGlobal {
  getSnapshot: () => PlayerDiagnosticsSnapshot
  reset: () => void
}

declare global {
  interface Window {
    __RAYD8_PLAYER_DEBUG__?: Rayd8PlayerDebugGlobal
  }
}

function createCounters(): PlayerDiagnosticsSnapshot {
  return {
    activeHlsInstances: {},
    activeVideoLayers: {},
    eventListeners: {},
    hlsControllers: {},
    renders: {},
    sourceLoads: {},
    timers: {},
    videoMounts: {},
  }
}

let counters: PlayerDiagnosticsSnapshot | null = null

/** Local dev, or staging/production when explicitly enabled (soak / QA only — never default-on in prod). */
function isPlaybackEngineeringDiagnosticsEnabled() {
  if (typeof window === 'undefined') {
    return false
  }

  if (import.meta.env.DEV) {
    return true
  }

  return (
    window.location.search.includes('rayd8PlayerDebug=true') ||
    window.localStorage.getItem('rayd8-player-debug') === 'true'
  )
}

function shouldLogDiagnostics() {
  if (!isPlaybackEngineeringDiagnosticsEnabled()) {
    return false
  }

  return (
    window.localStorage.getItem('rayd8-player-debug') === 'true' ||
    window.location.search.includes('rayd8PlayerDebug=true')
  )
}

function getCounters() {
  counters ??= createCounters()
  return counters
}

function increment(group: DiagnosticCounter, key: string) {
  group[key] = (group[key] ?? 0) + 1
}

function decrement(group: DiagnosticCounter, key: string) {
  group[key] = Math.max(0, (group[key] ?? 0) - 1)
}

function exposeDebugApi() {
  if (!isPlaybackEngineeringDiagnosticsEnabled() || window.__RAYD8_PLAYER_DEBUG__) {
    return
  }

  const counters = getCounters()
  window.__RAYD8_PLAYER_DEBUG__ = {
    getSnapshot: () => {
      const base = JSON.parse(JSON.stringify(counters)) as PlayerDiagnosticsSnapshot
      base.soak = getPlaybackSoakMetricsSnapshot()
      return base
    },
    reset: () => {
      Object.values(counters).forEach((group) => {
        Object.keys(group).forEach((key) => {
          delete group[key]
        })
      })
      resetPlaybackSoakMetrics()
    },
  }
}

export function recordPlayerRender(label: string) {
  if (!isPlaybackEngineeringDiagnosticsEnabled()) {
    return
  }

  exposeDebugApi()
  const counters = getCounters()
  increment(counters.renders, label)
}

export function recordVideoMount(label: string, mounted: boolean) {
  if (!isPlaybackEngineeringDiagnosticsEnabled()) {
    return
  }

  exposeDebugApi()
  const counters = getCounters()
  increment(counters.videoMounts, `${label}:${mounted ? 'mount' : 'unmount'}`)

  if (mounted) {
    counters.activeVideoLayers[label] = 1
  } else {
    delete counters.activeVideoLayers[label]
  }

  if (shouldLogDiagnostics()) {
    console.info(`[RAYD8 diagnostics] video ${mounted ? 'mounted' : 'unmounted'}: ${label}`)
  }
}

export function recordSourceLoad(label: string, sourceUrl: string) {
  if (!isPlaybackEngineeringDiagnosticsEnabled()) {
    return
  }

  exposeDebugApi()
  const counters = getCounters()
  increment(counters.sourceLoads, label)

  if (shouldLogDiagnostics()) {
    console.info(`[RAYD8 diagnostics] source load: ${label}`, sourceUrl)
  }
}

export function recordHlsController(label: string, action: 'create' | 'destroy') {
  if (!isPlaybackEngineeringDiagnosticsEnabled()) {
    return
  }

  exposeDebugApi()
  const counters = getCounters()
  increment(counters.hlsControllers, `${label}:${action}`)

  if (action === 'create') {
    counters.activeHlsInstances.total = (counters.activeHlsInstances.total ?? 0) + 1
  } else {
    counters.activeHlsInstances.total = Math.max(0, (counters.activeHlsInstances.total ?? 0) - 1)
  }

  if (shouldLogDiagnostics()) {
    console.info(`[RAYD8 diagnostics] HLS controller ${action}: ${label}`)
  }
}

export function addTrackedEventListener<K extends keyof HTMLElementEventMap>(
  target: HTMLElement,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  label: string,
) {
  target.addEventListener(type, listener as EventListener)

  if (isPlaybackEngineeringDiagnosticsEnabled()) {
    exposeDebugApi()
    const counters = getCounters()
    increment(counters.eventListeners, label)
  }

  return () => {
    target.removeEventListener(type, listener as EventListener)

    if (isPlaybackEngineeringDiagnosticsEnabled()) {
      const counters = getCounters()
      decrement(counters.eventListeners, label)
    }
  }
}

export function addTrackedDomEventListener(
  target: EventTarget,
  type: string,
  listener: EventListener,
  label: string,
) {
  target.addEventListener(type, listener)

  if (isPlaybackEngineeringDiagnosticsEnabled()) {
    exposeDebugApi()
    const counters = getCounters()
    increment(counters.eventListeners, label)
  }

  return () => {
    target.removeEventListener(type, listener)

    if (isPlaybackEngineeringDiagnosticsEnabled()) {
      const counters = getCounters()
      decrement(counters.eventListeners, label)
    }
  }
}

export function setTrackedTimeout(
  callback: () => void,
  delay: number,
  label: string,
) {
  if (isPlaybackEngineeringDiagnosticsEnabled()) {
    exposeDebugApi()
    const counters = getCounters()
    increment(counters.timers, label)
  }

  const timerId = window.setTimeout(() => {
    if (isPlaybackEngineeringDiagnosticsEnabled()) {
      const counters = getCounters()
      decrement(counters.timers, label)
    }

    callback()
  }, delay)

  return timerId
}

export function clearTrackedTimeout(timerId: number | null, label: string) {
  if (timerId === null) {
    return
  }

  window.clearTimeout(timerId)

  if (isPlaybackEngineeringDiagnosticsEnabled()) {
    const counters = getCounters()
    decrement(counters.timers, label)
  }
}
