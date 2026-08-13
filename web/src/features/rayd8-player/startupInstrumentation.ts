/**
 * Startup instrumentation counters + stage timing.
 *
 * The incidents showed repeated request sequences and silent loops. Startup
 * emits structured counters — token requests, media mounts, recovery attempts,
 * stage timings — all redaction-safe (no tokens, URLs, or PII).
 *
 * Extended for Chromium-variant investigation (INC-2026-08-07-OPERA-STARTUP-HANG):
 * element/controller/source/overlay/health-guard counts, per-stage durations,
 * and non-monotonic stage-cycle detection for overlay flicker.
 */
import type { StartupStage } from './sessionStartupTaxonomy'

export type TimingPhase =
  | 'authentication'
  | 'session_creation'
  | 'playback_token'
  | 'manifest_download'
  | 'media_attachment'
  | 'first_frame'
  | 'playback_start'

export interface StartupStageTiming {
  stage: StartupStage
  atMs: number
}

export interface StageCycle {
  from: StartupStage
  to: StartupStage
  atMs: number
}

export interface StartupInstrumentationSnapshot {
  attemptNumber: number
  tokenRequestCount: number
  sessionTokenRequestTotal: number
  mediaMountCount: number
  softRecoveryCount: number
  majorRecoveryCount: number
  videoElementCreateCount: number
  audioElementCreateCount: number
  hlsControllerCreateCount: number
  nativeControllerCreateCount: number
  sourceAssignmentCount: number
  overlayMountCount: number
  overlayRenderCount: number
  healthGuardActivationCount: number
  stages: StartupStageTiming[]
  stageDurationsMs: Partial<Record<StartupStage, number>>
  timingPhasesMs: Partial<Record<TimingPhase, number>>
  nonMonotonicCycles: StageCycle[]
  hasNonMonotonicCycle: boolean
}

export interface StartupInstrumentation {
  beginAttempt(): void
  recordTokenRequest(): void
  recordMediaMount(): void
  recordRecoveryAttempt(kind: 'soft' | 'major'): void
  recordStage(stage: StartupStage): void
  recordVideoElementCreate(): void
  recordAudioElementCreate(): void
  recordControllerCreate(kind: 'hls' | 'native'): void
  recordSourceAssignment(): void
  recordOverlayMount(): void
  recordOverlayRender(): void
  recordHealthGuardActivation(): void
  markTimingPhase(phase: TimingPhase): void
  endTimingPhase(phase: TimingPhase): void
  publishToWindow(): void
  snapshot(): StartupInstrumentationSnapshot
}

const STAGE_ORDER: StartupStage[] = [
  'AUTH_READINESS',
  'ACCESS_CHECK',
  'ENTITLEMENT_CHECK',
  'SESSION_CREATE',
  'SESSION_ATTACH',
  'PLAYBACK_ASSET_RESOLUTION',
  'PLAYBACK_TOKEN',
  'MEDIA_CONTROLLER_CREATE',
  'MEDIA_SOURCE_APPLY',
  'MEDIA_METADATA',
  'AUTOPLAY_PENDING',
  'MEDIA_READY',
  'PLAYBACK_HEALTH',
  'SESSION_END',
  'UNKNOWN',
]

const STAGE_TO_TIMING_PHASE: Partial<Record<StartupStage, TimingPhase>> = {
  AUTH_READINESS: 'authentication',
  SESSION_CREATE: 'session_creation',
  PLAYBACK_TOKEN: 'playback_token',
  MEDIA_SOURCE_APPLY: 'manifest_download',
  MEDIA_CONTROLLER_CREATE: 'media_attachment',
  MEDIA_METADATA: 'first_frame',
  MEDIA_READY: 'playback_start',
  AUTOPLAY_PENDING: 'playback_start',
}

function stageIndex(stage: StartupStage): number {
  const idx = STAGE_ORDER.indexOf(stage)
  return idx < 0 ? STAGE_ORDER.length : idx
}

export function createStartupInstrumentation(): StartupInstrumentation {
  const startedAt = Date.now()
  let attemptNumber = 0
  let tokenRequestCount = 0
  let sessionTokenRequestTotal = 0
  let mediaMountCount = 0
  let softRecoveryCount = 0
  let majorRecoveryCount = 0
  let videoElementCreateCount = 0
  let audioElementCreateCount = 0
  let hlsControllerCreateCount = 0
  let nativeControllerCreateCount = 0
  let sourceAssignmentCount = 0
  let overlayMountCount = 0
  let overlayRenderCount = 0
  let healthGuardActivationCount = 0
  let stages: StartupStageTiming[] = []
  let stageEnteredAt = new Map<StartupStage, number>()
  let stageDurationsMs: Partial<Record<StartupStage, number>> = {}
  let timingPhaseStartedAt = new Map<TimingPhase, number>()
  let timingPhasesMs: Partial<Record<TimingPhase, number>> = {}
  let nonMonotonicCycles: StageCycle[] = []
  let lastStage: StartupStage | null = null

  function buildSnapshot(): StartupInstrumentationSnapshot {
    return {
      attemptNumber,
      tokenRequestCount,
      sessionTokenRequestTotal,
      mediaMountCount,
      softRecoveryCount,
      majorRecoveryCount,
      videoElementCreateCount,
      audioElementCreateCount,
      hlsControllerCreateCount,
      nativeControllerCreateCount,
      sourceAssignmentCount,
      overlayMountCount,
      overlayRenderCount,
      healthGuardActivationCount,
      stages: stages.map((entry) => ({ ...entry })),
      stageDurationsMs: { ...stageDurationsMs },
      timingPhasesMs: { ...timingPhasesMs },
      nonMonotonicCycles: nonMonotonicCycles.map((entry) => ({ ...entry })),
      hasNonMonotonicCycle: nonMonotonicCycles.length > 0,
    }
  }

  return {
    beginAttempt() {
      attemptNumber += 1
      tokenRequestCount = 0
      mediaMountCount = 0
      softRecoveryCount = 0
      majorRecoveryCount = 0
      videoElementCreateCount = 0
      audioElementCreateCount = 0
      hlsControllerCreateCount = 0
      nativeControllerCreateCount = 0
      sourceAssignmentCount = 0
      overlayMountCount = 0
      overlayRenderCount = 0
      healthGuardActivationCount = 0
      stages = []
      stageEnteredAt = new Map()
      stageDurationsMs = {}
      timingPhaseStartedAt = new Map()
      timingPhasesMs = {}
      nonMonotonicCycles = []
      lastStage = null
    },

    recordTokenRequest() {
      tokenRequestCount += 1
      sessionTokenRequestTotal += 1
    },

    recordMediaMount() {
      mediaMountCount += 1
    },

    recordRecoveryAttempt(kind: 'soft' | 'major') {
      if (kind === 'soft') {
        softRecoveryCount += 1
      } else {
        majorRecoveryCount += 1
      }
    },

    recordStage(stage: StartupStage) {
      const atMs = Date.now() - startedAt
      if (lastStage && stageIndex(stage) < stageIndex(lastStage) && stage !== lastStage) {
        nonMonotonicCycles.push({ from: lastStage, to: stage, atMs })
      }
      if (lastStage && lastStage !== stage) {
        const entered = stageEnteredAt.get(lastStage)
        if (entered !== undefined) {
          stageDurationsMs[lastStage] = atMs - entered
        }
      }
      stageEnteredAt.set(stage, atMs)
      stages.push({ stage, atMs })
      lastStage = stage

      const phase = STAGE_TO_TIMING_PHASE[stage]
      if (phase && !timingPhaseStartedAt.has(phase)) {
        timingPhaseStartedAt.set(phase, atMs)
      }
    },

    recordVideoElementCreate() {
      videoElementCreateCount += 1
    },

    recordAudioElementCreate() {
      audioElementCreateCount += 1
    },

    recordControllerCreate(kind: 'hls' | 'native') {
      if (kind === 'hls') {
        hlsControllerCreateCount += 1
      } else {
        nativeControllerCreateCount += 1
      }
    },

    recordSourceAssignment() {
      sourceAssignmentCount += 1
    },

    recordOverlayMount() {
      overlayMountCount += 1
    },

    recordOverlayRender() {
      overlayRenderCount += 1
    },

    recordHealthGuardActivation() {
      healthGuardActivationCount += 1
    },

    markTimingPhase(phase: TimingPhase) {
      if (!timingPhaseStartedAt.has(phase)) {
        timingPhaseStartedAt.set(phase, Date.now() - startedAt)
      }
    },

    endTimingPhase(phase: TimingPhase) {
      const started = timingPhaseStartedAt.get(phase)
      if (started === undefined) return
      timingPhasesMs[phase] = Date.now() - startedAt - started
    },

    publishToWindow() {
      if (typeof window === 'undefined') return
      try {
        ;(window as unknown as { __rayd8StartupInstrumentation?: StartupInstrumentationSnapshot }).__rayd8StartupInstrumentation =
          buildSnapshot()
      } catch {
        // Ignore window publish failures (SSR / restricted contexts).
      }
    },

    snapshot(): StartupInstrumentationSnapshot {
      const snap = buildSnapshot()
      if (lastStage) {
        const entered = stageEnteredAt.get(lastStage)
        if (entered !== undefined && snap.stageDurationsMs[lastStage] === undefined) {
          snap.stageDurationsMs[lastStage] = Date.now() - startedAt - entered
        }
      }
      return snap
    },
  }
}
