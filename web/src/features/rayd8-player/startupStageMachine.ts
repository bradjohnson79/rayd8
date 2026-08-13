/**
 * Explicit startup stage machine.
 *
 * INC-2026-08-06-PLAYBACK-TOKEN-CORS: the "Preparing Your RAYD8 Session / 0%"
 * overlay was driven by implicit state that could hang forever. This machine
 * guarantees every startup reaches a terminal state (ready | failed) and that
 * any terminal failure clears the preparation overlay.
 */
import type { StartupFailureCode, StartupStage } from './sessionStartupTaxonomy'

export type StartupStatus = 'idle' | 'starting' | 'ready' | 'failed'

export interface StartupStageEntry {
  stage: StartupStage | 'IDLE'
  atMs: number
}

export interface StartupFailure {
  stage: StartupStage
  code: StartupFailureCode
}

export interface StartupMachineState {
  status: StartupStatus
  stage: StartupStage | 'IDLE'
  overlayVisible: boolean
  displayPercent: number | null
  failure: StartupFailure | null
  history: StartupStageEntry[]
}

export interface StartupStageMachine {
  readonly state: StartupMachineState
  advance(stage: StartupStage): void
  setBufferPercent(percent: number): void
  markReady(): void
  fail(failure: StartupFailure): void
}

/** Stages during which a real buffer percentage is meaningful. */
const MEDIA_WAITING_STAGES: ReadonlySet<StartupStage | 'IDLE'> = new Set([
  'MEDIA_SOURCE_APPLY',
  'MEDIA_METADATA',
  'AUTOPLAY_PENDING',
  'MEDIA_READY',
])

export function createStartupStageMachine(options: { videoRequired: boolean }): StartupStageMachine {
  const startedAt = Date.now()
  // Buffer percentage is only meaningful when video media must load.
  const showBufferPercent = options.videoRequired
  const state: StartupMachineState = {
    status: 'idle',
    stage: 'IDLE',
    overlayVisible: true,
    displayPercent: null,
    failure: null,
    history: [{ stage: 'IDLE', atMs: 0 }],
  }

  const isTerminal = () => state.status === 'ready' || state.status === 'failed'

  return {
    state,

    advance(stage: StartupStage) {
      if (isTerminal()) {
        return
      }
      state.status = 'starting'
      state.stage = stage
      state.overlayVisible = true
      if (!MEDIA_WAITING_STAGES.has(stage)) {
        state.displayPercent = null
      }
      state.history.push({ stage, atMs: Date.now() - startedAt })
    },

    setBufferPercent(percent: number) {
      if (isTerminal()) {
        return
      }
      if (showBufferPercent && MEDIA_WAITING_STAGES.has(state.stage)) {
        state.displayPercent = Math.max(0, Math.min(100, Math.round(percent)))
      }
    },

    markReady() {
      if (isTerminal()) {
        return
      }
      state.status = 'ready'
      state.stage = 'MEDIA_READY'
      state.overlayVisible = false
      state.displayPercent = 100
    },

    fail(failure: StartupFailure) {
      if (isTerminal()) {
        return
      }
      state.status = 'failed'
      state.stage = failure.stage
      state.failure = failure
      // Terminal failure ALWAYS clears the preparation overlay — the recovery
      // overlay is rendered separately from the failure state.
      state.overlayVisible = false
      state.displayPercent = null
    },
  }
}
