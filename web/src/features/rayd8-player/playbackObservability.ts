/**
 * Dev/QA-gated playback observability for freeze classification and soak metrics.
 * Never logs signed URLs, JWTs, or private content.
 */

import { isPlaybackSoakMetricsEnabled } from '../playback-authority/playbackSoakMetrics'
import type { FreezeClass } from '../playback-authority/recoveryStateMachine'
import { emitPlaybackIncident, isAbnormalPlaybackIncident } from './playbackIncidentTelemetry'

export type HypothesisStatus =
  | 'UNTESTED'
  | 'NOT_REPRODUCED'
  | 'CORRELATED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'INCONCLUSIVE'

export interface LongTaskBuckets {
  over50ms: number
  over200ms: number
  over1000ms: number
  longestMs: number
}

export interface ResponsivenessSnapshot {
  eventLoopDelayMs: number
  maxEventLoopDelayMs: number
  longTasks: LongTaskBuckets
  rafCadenceMs: number | null
  missedFrames: number
  consecutiveMissedFrames: number
  freezePollScheduledAt: number | null
  freezePollExecutedAt: number | null
  freezePollDelayMs: number | null
  heartbeatScheduledAt: number | null
  heartbeatCompletedAt: number | null
  heartbeatLagMs: number | null
  reactCommits: number
  expensiveReactCommits: number
}

export interface DecodeSnapshot {
  totalVideoFrames: number | null
  droppedVideoFrames: number | null
  corruptedVideoFrames: number | null
  displayWidth: number | null
  displayHeight: number | null
  videoWidth: number | null
  videoHeight: number | null
  hlsLevel: number | null
  estimatedBandwidth: number | null
  videoBufferLength: number | null
  audioBufferLength: number | null
  pipelineMode: 'dual' | 'combined' | 'unknown'
  playbackEngine: 'hls.js' | 'native_hls' | 'unknown'
}

export interface AvSyncSnapshot {
  videoCurrentTime: number | null
  audioCurrentTime: number | null
  driftSeconds: number | null
  maxAbsDriftSeconds: number
  samples: number
}

export interface HardwareContextSnapshot {
  browserName: string
  browserVersion: string
  userAgent: string
  language: string
  hardwareConcurrency: number | null
  deviceMemoryGb: number | null
  screenWidth: number | null
  screenHeight: number | null
  devicePixelRatio: number | null
  reducedMotion: boolean | null
  saveData: boolean | null
  visibilityState: DocumentVisibilityState | null
  webglRenderer: string | null
  webglSoftware: boolean | null
  batteryCharging: boolean | null
  batteryLevel: number | null
  zoomApprox: number | null
}

export interface FreezeEventRecord {
  at: number
  class: FreezeClass
  reason: string
  mediaTimeAdvancing: boolean
  mainThreadResponsive: boolean
  freezePollDelayed: boolean
}

export interface ObservabilitySnapshot {
  correlationId: string
  startedAt: number
  elapsedMs: number
  responsiveness: ResponsivenessSnapshot
  decode: DecodeSnapshot
  avSync: AvSyncSnapshot
  hardware: HardwareContextSnapshot | null
  freezeEvents: FreezeEventRecord[]
  recovery: Record<string, number>
  tokenRefreshCount: number
  loadSourceCount: number
  heartbeatCount: number
  mediaElementCounts: { video: number; audio: number }
}

const RING = 60

let correlationId = ''
let startedAt = 0
let longTasks: LongTaskBuckets = { over50ms: 0, over200ms: 0, over1000ms: 0, longestMs: 0 }
let maxEventLoopDelayMs = 0
let lastEventLoopDelayMs = 0
let rafCadenceMs: number | null = null
let missedFrames = 0
let consecutiveMissedFrames = 0
let lastRafAt: number | null = null
let freezePollScheduledAt: number | null = null
let freezePollExecutedAt: number | null = null
let freezePollDelayMs: number | null = null
let heartbeatScheduledAt: number | null = null
let heartbeatCompletedAt: number | null = null
let reactCommits = 0
let expensiveReactCommits = 0
let tokenRefreshCount = 0
let loadSourceCount = 0
let heartbeatCount = 0
let recoveryCounters: Record<string, number> = {}
let freezeEvents: FreezeEventRecord[] = []
let avSync: AvSyncSnapshot = {
  videoCurrentTime: null,
  audioCurrentTime: null,
  driftSeconds: null,
  maxAbsDriftSeconds: 0,
  samples: 0,
}
let decode: DecodeSnapshot = emptyDecode()
let hardware: HardwareContextSnapshot | null = null
let longTaskObserver: PerformanceObserver | null = null
let eventLoopTimer: number | null = null
let rafHandle: number | null = null
let rvfcHandle: number | null = null

function enabled() {
  return isPlaybackSoakMetricsEnabled()
}

function emptyDecode(): DecodeSnapshot {
  return {
    totalVideoFrames: null,
    droppedVideoFrames: null,
    corruptedVideoFrames: null,
    displayWidth: null,
    displayHeight: null,
    videoWidth: null,
    videoHeight: null,
    hlsLevel: null,
    estimatedBandwidth: null,
    videoBufferLength: null,
    audioBufferLength: null,
    pipelineMode: 'unknown',
    playbackEngine: 'unknown',
  }
}

function createCorrelationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `rayd8-pb-${crypto.randomUUID()}`
  }

  return `rayd8-pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function redactPlaybackUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '[redacted]')
    }
    return parsed.toString().replace(/token=[^&]+/gi, 'token=[redacted]')
  } catch {
    return url.replace(/token=[^&]+/gi, 'token=[redacted]')
  }
}

export function ensurePlaybackObservability() {
  if (!enabled() || typeof window === 'undefined') {
    return
  }

  if (!correlationId) {
    correlationId = createCorrelationId()
    startedAt = Date.now()
  }

  if (!hardware) {
    hardware = captureHardwareContext()
  }

  startLongTaskObserver()
  startEventLoopProbe()
  startRafProbe()
}

export function getPlaybackCorrelationId() {
  ensurePlaybackObservability()
  return correlationId || null
}

export function resetPlaybackObservability() {
  stopProbes()
  correlationId = ''
  startedAt = 0
  longTasks = { over50ms: 0, over200ms: 0, over1000ms: 0, longestMs: 0 }
  maxEventLoopDelayMs = 0
  lastEventLoopDelayMs = 0
  rafCadenceMs = null
  missedFrames = 0
  consecutiveMissedFrames = 0
  lastRafAt = null
  freezePollScheduledAt = null
  freezePollExecutedAt = null
  freezePollDelayMs = null
  heartbeatScheduledAt = null
  heartbeatCompletedAt = null
  reactCommits = 0
  expensiveReactCommits = 0
  tokenRefreshCount = 0
  loadSourceCount = 0
  heartbeatCount = 0
  recoveryCounters = {}
  freezeEvents = []
  avSync = {
    videoCurrentTime: null,
    audioCurrentTime: null,
    driftSeconds: null,
    maxAbsDriftSeconds: 0,
    samples: 0,
  }
  decode = emptyDecode()
  hardware = null
}

function stopProbes() {
  longTaskObserver?.disconnect()
  longTaskObserver = null

  if (eventLoopTimer !== null) {
    window.clearInterval(eventLoopTimer)
    eventLoopTimer = null
  }

  if (rafHandle !== null) {
    window.cancelAnimationFrame(rafHandle)
    rafHandle = null
  }

  if (rvfcHandle !== null && typeof HTMLVideoElement !== 'undefined') {
    // Best-effort; handle is opaque across browsers.
    rvfcHandle = null
  }
}

function startLongTaskObserver() {
  if (longTaskObserver || typeof PerformanceObserver === 'undefined') {
    return
  }

  try {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = entry.duration
        if (duration >= 50) longTasks.over50ms += 1
        if (duration >= 200) longTasks.over200ms += 1
        if (duration >= 1000) longTasks.over1000ms += 1
        longTasks.longestMs = Math.max(longTasks.longestMs, duration)
      }
    })
    longTaskObserver.observe({ entryTypes: ['longtask'] as string[] })
  } catch {
    longTaskObserver = null
  }
}

function startEventLoopProbe() {
  if (eventLoopTimer !== null) {
    return
  }

  let expected = performance.now() + 1000
  eventLoopTimer = window.setInterval(() => {
    const now = performance.now()
    const delay = Math.max(0, now - expected)
    lastEventLoopDelayMs = delay
    maxEventLoopDelayMs = Math.max(maxEventLoopDelayMs, delay)
    expected = now + 1000
  }, 1000)
}

function startRafProbe() {
  if (rafHandle !== null) {
    return
  }

  const tick = (ts: number) => {
    if (lastRafAt !== null) {
      const delta = ts - lastRafAt
      rafCadenceMs = delta
      if (delta > 32) {
        missedFrames += 1
        consecutiveMissedFrames += 1
      } else {
        consecutiveMissedFrames = 0
      }
    }
    lastRafAt = ts
    rafHandle = window.requestAnimationFrame(tick)
  }

  rafHandle = window.requestAnimationFrame(tick)
}

export function markFreezePollScheduled() {
  if (!enabled()) return
  ensurePlaybackObservability()
  freezePollScheduledAt = performance.now()
}

export function markFreezePollExecuted() {
  if (!enabled()) return
  ensurePlaybackObservability()
  freezePollExecutedAt = performance.now()
  if (freezePollScheduledAt !== null) {
    freezePollDelayMs = Math.max(0, freezePollExecutedAt - freezePollScheduledAt)
  }
}

export function markHeartbeatScheduled() {
  if (!enabled()) return
  ensurePlaybackObservability()
  heartbeatScheduledAt = performance.now()
}

export function markHeartbeatCompleted() {
  if (!enabled()) return
  ensurePlaybackObservability()
  heartbeatCompletedAt = performance.now()
  heartbeatCount += 1
}

export function recordReactCommit(durationMs?: number) {
  if (!enabled()) return
  ensurePlaybackObservability()
  reactCommits += 1
  if (typeof durationMs === 'number' && durationMs >= 16) {
    expensiveReactCommits += 1
  }
}

export function recordTokenRefresh() {
  if (!enabled()) return
  ensurePlaybackObservability()
  tokenRefreshCount += 1
}

export function recordObservabilityLoadSource() {
  if (!enabled()) return
  ensurePlaybackObservability()
  loadSourceCount += 1
}

export function recordRecoveryAction(label: string) {
  if (!enabled()) return
  ensurePlaybackObservability()
  recoveryCounters[label] = (recoveryCounters[label] ?? 0) + 1
}

export function recordFreezeEvent(input: Omit<FreezeEventRecord, 'at'> & { at?: number }) {
  if (!enabled()) return
  ensurePlaybackObservability()
  freezeEvents.push({
    at: input.at ?? Date.now(),
    class: input.class,
    reason: input.reason,
    mediaTimeAdvancing: input.mediaTimeAdvancing,
    mainThreadResponsive: input.mainThreadResponsive,
    freezePollDelayed: input.freezePollDelayed,
  })
  if (freezeEvents.length > RING) {
    freezeEvents.splice(0, freezeEvents.length - RING)
  }

  // Production telemetry: abnormal freezes only (not every Class E sample).
  if (isAbnormalPlaybackIncident(input.class)) {
    emitPlaybackIncident({
      correlationId,
      freezeClass: input.class,
      reason: input.reason,
      pipelineMode: decode?.pipelineMode ?? null,
      playbackEngine: decode?.playbackEngine ?? null,
    })
  }
}

export function classifyFreezeEvent(input: {
  mediaTimeAdvancing: boolean
  controlsResponsive: boolean
  eventLoopDelayMs: number
  graphicsUpdating: boolean
  avDriftSeconds: number | null
}): FreezeClass {
  if (input.eventLoopDelayMs >= 1000 || !input.controlsResponsive) {
    if (!input.mediaTimeAdvancing && input.eventLoopDelayMs >= 1000) {
      return 'browser_tab_freeze'
    }
    if (!input.controlsResponsive && input.mediaTimeAdvancing) {
      return 'player_ui_freeze'
    }
    return 'browser_tab_freeze'
  }

  if (
    input.avDriftSeconds !== null &&
    Math.abs(input.avDriftSeconds) >= 0.35 &&
    input.mediaTimeAdvancing
  ) {
    return 'av_desync'
  }

  if (!input.graphicsUpdating && input.mediaTimeAdvancing) {
    return 'graphics_freeze'
  }

  if (!input.mediaTimeAdvancing) {
    return 'media_stall'
  }

  return 'unknown'
}

function bufferLengthSeconds(media: HTMLMediaElement | null) {
  if (!media || !media.buffered || media.buffered.length === 0) {
    return null
  }

  try {
    const end = media.buffered.end(media.buffered.length - 1)
    return Math.max(0, end - media.currentTime)
  } catch {
    return null
  }
}

export function sampleMediaMetrics(input: {
  video: HTMLVideoElement | null
  audio: HTMLAudioElement | null
  pipelineMode?: 'dual' | 'combined'
  playbackEngine?: 'hls.js' | 'native_hls'
  hlsLevel?: number | null
  estimatedBandwidth?: number | null
}) {
  if (!enabled()) return
  ensurePlaybackObservability()

  const { video, audio } = input
  decode.pipelineMode = input.pipelineMode ?? decode.pipelineMode
  decode.playbackEngine = input.playbackEngine ?? decode.playbackEngine
  decode.hlsLevel = input.hlsLevel ?? decode.hlsLevel
  decode.estimatedBandwidth = input.estimatedBandwidth ?? decode.estimatedBandwidth
  decode.videoBufferLength = bufferLengthSeconds(video)
  decode.audioBufferLength = bufferLengthSeconds(audio)

  if (video) {
    decode.videoWidth = video.videoWidth || null
    decode.videoHeight = video.videoHeight || null
    decode.displayWidth = Math.round(video.clientWidth) || null
    decode.displayHeight = Math.round(video.clientHeight) || null

    const quality =
      typeof video.getVideoPlaybackQuality === 'function'
        ? video.getVideoPlaybackQuality()
        : null

    if (quality) {
      decode.totalVideoFrames = quality.totalVideoFrames
      decode.droppedVideoFrames = quality.droppedVideoFrames
      decode.corruptedVideoFrames = quality.corruptedVideoFrames
    }

    if (typeof video.requestVideoFrameCallback === 'function' && rvfcHandle === null) {
      const onFrame = () => {
        rvfcHandle = video.requestVideoFrameCallback(onFrame)
      }
      rvfcHandle = video.requestVideoFrameCallback(onFrame)
    }
  }

  // Only compute A/V drift when both pipelines have an active media source.
  // Default sessions often use audioTrack='none' (empty <audio>), which must not
  // be reported as Class E desynchronization.
  if (video?.currentSrc && audio?.currentSrc) {
    const drift = video.currentTime - audio.currentTime
    avSync.videoCurrentTime = video.currentTime
    avSync.audioCurrentTime = audio.currentTime
    avSync.driftSeconds = drift
    avSync.maxAbsDriftSeconds = Math.max(avSync.maxAbsDriftSeconds, Math.abs(drift))
    avSync.samples += 1
  } else {
    avSync.videoCurrentTime = video?.currentTime ?? null
    avSync.audioCurrentTime = audio?.currentSrc ? audio.currentTime : null
    avSync.driftSeconds = null
  }
}

function captureHardwareContext(): HardwareContextSnapshot {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { saveData?: boolean }
    userAgentData?: { brands?: Array<{ brand: string; version: string }> }
  }

  let webglRenderer: string | null = null
  let webglSoftware: boolean | null = null

  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null)
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info')
      if (dbg) {
        webglRenderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '')
        webglSoftware = /swiftshader|llvmpipe|software/i.test(webglRenderer)
      }
    }
  } catch {
    webglRenderer = null
  }

  const brand = nav.userAgentData?.brands?.at(-1)

  return {
    browserName: brand?.brand ?? guessBrowserName(nav.userAgent),
    browserVersion: brand?.version ?? '',
    userAgent: nav.userAgent,
    language: nav.language,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
    deviceMemoryGb: nav.deviceMemory ?? null,
    screenWidth: window.screen?.width ?? null,
    screenHeight: window.screen?.height ?? null,
    devicePixelRatio: window.devicePixelRatio ?? null,
    reducedMotion:
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : null,
    saveData: nav.connection?.saveData ?? null,
    visibilityState: document.visibilityState,
    webglRenderer,
    webglSoftware,
    batteryCharging: null,
    batteryLevel: null,
    zoomApprox:
      typeof window.outerWidth === 'number' && window.innerWidth > 0
        ? Number((window.outerWidth / window.innerWidth).toFixed(2))
        : null,
  }
}

function guessBrowserName(ua: string) {
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua)) return 'Chrome'
  if (/Safari\//.test(ua)) return 'Safari'
  return 'Unknown'
}

export async function enrichHardwareBattery() {
  if (!enabled() || !hardware) return
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{ charging: boolean; level: number }>
  }
  if (typeof nav.getBattery !== 'function') return
  try {
    const battery = await nav.getBattery()
    hardware.batteryCharging = battery.charging
    hardware.batteryLevel = battery.level
  } catch {
    // Unsupported / denied.
  }
}

export function getObservabilitySnapshot(): ObservabilitySnapshot | null {
  if (!enabled()) return null
  ensurePlaybackObservability()

  const videos = typeof document !== 'undefined' ? document.querySelectorAll('video').length : 0
  const audios = typeof document !== 'undefined' ? document.querySelectorAll('audio').length : 0

  return {
    correlationId,
    startedAt,
    elapsedMs: startedAt ? Date.now() - startedAt : 0,
    responsiveness: {
      eventLoopDelayMs: lastEventLoopDelayMs,
      maxEventLoopDelayMs,
      longTasks: { ...longTasks },
      rafCadenceMs,
      missedFrames,
      consecutiveMissedFrames,
      freezePollScheduledAt,
      freezePollExecutedAt,
      freezePollDelayMs,
      heartbeatScheduledAt,
      heartbeatCompletedAt,
      heartbeatLagMs:
        heartbeatScheduledAt !== null && heartbeatCompletedAt !== null
          ? Math.max(0, heartbeatCompletedAt - heartbeatScheduledAt)
          : null,
      reactCommits,
      expensiveReactCommits,
    },
    decode: { ...decode },
    avSync: { ...avSync },
    hardware,
    freezeEvents: freezeEvents.slice(),
    recovery: { ...recoveryCounters },
    tokenRefreshCount,
    loadSourceCount,
    heartbeatCount,
    mediaElementCounts: { video: videos, audio: audios },
  }
}
