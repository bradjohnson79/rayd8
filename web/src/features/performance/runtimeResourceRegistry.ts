export type RuntimeResourceKind =
  | 'webgl_context'
  | 'raf_loop'
  | 'hls_instance'
  | 'video_element'
  | 'audio_element'
  | 'audio_context'
  | 'timer'
  | 'listener'
  | 'observer'

export type RuntimeOwner =
  | 'Express Player'
  | 'Amrita'
  | 'Hamsa Aura'
  | 'Hamsa Glyph'
  | 'Hamsa Hand'
  | 'Session audio layer'
  | 'DashboardShell / BackgroundSystem'
  | 'SessionProvider'
  | 'Runtime diagnostics'

export interface RuntimeResourceRecord {
  id: string
  kind: RuntimeResourceKind
  owner: RuntimeOwner
  createdAt: number
  meta?: Record<string, unknown>
}

export interface RuntimeTimelineEvent {
  name: string
  at: number
  detail?: Record<string, unknown>
}

export interface RuntimeCleanupMark {
  at: number
  reason: string
}

export interface RuntimeResourceSnapshot {
  resources: RuntimeResourceRecord[]
  counts: Record<RuntimeResourceKind, number>
  byOwner: Record<string, number>
  hamsaContexts: number
  amritaLoops: number
  videoPlayers: number
  hlsInstances: number
  rafLoops: number
  timers: number
  listeners: number
  audioContexts: number
  heapUsedBytes: number | null
  jsHeapBytes: number | null
  performanceMode: string | null
  lastCleanup: RuntimeCleanupMark | null
  timeline: RuntimeTimelineEvent[]
}

const resources = new Map<string, RuntimeResourceRecord>()
const timeline: RuntimeTimelineEvent[] = []
let lastCleanup: RuntimeCleanupMark | null = null
let performanceMode: string | null = null
const MAX_TIMELINE = 200

function emptyCounts(): Record<RuntimeResourceKind, number> {
  return {
    webgl_context: 0,
    raf_loop: 0,
    hls_instance: 0,
    video_element: 0,
    audio_element: 0,
    audio_context: 0,
    timer: 0,
    listener: 0,
    observer: 0,
  }
}

function readHeap(): { heapUsedBytes: number | null; jsHeapBytes: number | null } {
  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number }
    }
  ).memory
  if (!memory) {
    return { heapUsedBytes: null, jsHeapBytes: null }
  }
  return {
    heapUsedBytes: memory.usedJSHeapSize ?? null,
    jsHeapBytes: memory.totalJSHeapSize ?? null,
  }
}

export function registerRuntimeResource(input: {
  id: string
  kind: RuntimeResourceKind
  owner: RuntimeOwner
  meta?: Record<string, unknown>
}) {
  resources.set(input.id, {
    id: input.id,
    kind: input.kind,
    owner: input.owner,
    createdAt: Date.now(),
    meta: input.meta,
  })
}

export function unregisterRuntimeResource(id: string, _reason?: string) {
  resources.delete(id)
}

export function markRuntimeCleanup(reason: string) {
  lastCleanup = { at: Date.now(), reason }
  recordRuntimeTimeline('cleanup', { reason })
}

export function setRuntimePerformanceMode(mode: string | null) {
  performanceMode = mode
}

export function recordRuntimeTimeline(name: string, detail?: Record<string, unknown>) {
  timeline.push({ name, at: Date.now(), detail })
  if (timeline.length > MAX_TIMELINE) {
    timeline.splice(0, timeline.length - MAX_TIMELINE)
  }
}

export function getRuntimeTimeline(): RuntimeTimelineEvent[] {
  return timeline.slice()
}

export function clearRuntimeTimeline() {
  timeline.length = 0
}

export function resetRuntimeResourceRegistry() {
  resources.clear()
  timeline.length = 0
  lastCleanup = null
}

export function getRuntimeResourceSnapshot(): RuntimeResourceSnapshot {
  const counts = emptyCounts()
  const byOwner: Record<string, number> = {}
  const list = Array.from(resources.values())

  for (const resource of list) {
    counts[resource.kind] += 1
    byOwner[resource.owner] = (byOwner[resource.owner] ?? 0) + 1
  }

  const heap = readHeap()
  const hamsaContexts = list.filter(
    (r) => r.kind === 'webgl_context' && r.owner.startsWith('Hamsa'),
  ).length
  const amritaLoops = list.filter(
    (r) => r.kind === 'raf_loop' && r.owner === 'Amrita',
  ).length

  return {
    resources: list,
    counts,
    byOwner,
    hamsaContexts,
    amritaLoops,
    videoPlayers: counts.video_element,
    hlsInstances: counts.hls_instance,
    rafLoops: counts.raf_loop,
    timers: counts.timer,
    listeners: counts.listener,
    audioContexts: counts.audio_context,
    heapUsedBytes: heap.heapUsedBytes,
    jsHeapBytes: heap.jsHeapBytes,
    performanceMode,
    lastCleanup,
    timeline: getRuntimeTimeline(),
  }
}

export function installRuntimeProbe() {
  if (typeof window === 'undefined') {
    return
  }
  ;(
    window as Window & {
      __RAYD8_RUNTIME__?: {
        getSnapshot: typeof getRuntimeResourceSnapshot
        getTimeline: typeof getRuntimeTimeline
        markCleanup: typeof markRuntimeCleanup
        recordTimeline: typeof recordRuntimeTimeline
      }
    }
  ).__RAYD8_RUNTIME__ = {
    getSnapshot: getRuntimeResourceSnapshot,
    getTimeline: getRuntimeTimeline,
    markCleanup: markRuntimeCleanup,
    recordTimeline: recordRuntimeTimeline,
  }
}
