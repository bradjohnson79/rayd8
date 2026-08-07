/**
 * Startup instrumentation counters.
 *
 * The incidents showed repeated request sequences and silent loops. Startup
 * emits structured counters — token requests, media mounts, recovery attempts,
 * stage timings — all redaction-safe (no tokens, URLs, or PII).
 */
import type { StartupStage } from './sessionStartupTaxonomy'

export interface StartupStageTiming {
  stage: StartupStage
  atMs: number
}

export interface StartupInstrumentationSnapshot {
  attemptNumber: number
  tokenRequestCount: number
  sessionTokenRequestTotal: number
  mediaMountCount: number
  softRecoveryCount: number
  majorRecoveryCount: number
  stages: StartupStageTiming[]
}

export interface StartupInstrumentation {
  beginAttempt(): void
  recordTokenRequest(): void
  recordMediaMount(): void
  recordRecoveryAttempt(kind: 'soft' | 'major'): void
  recordStage(stage: StartupStage): void
  snapshot(): StartupInstrumentationSnapshot
}

export function createStartupInstrumentation(): StartupInstrumentation {
  const startedAt = Date.now()
  let attemptNumber = 0
  let tokenRequestCount = 0
  let sessionTokenRequestTotal = 0
  let mediaMountCount = 0
  let softRecoveryCount = 0
  let majorRecoveryCount = 0
  let stages: StartupStageTiming[] = []

  return {
    beginAttempt() {
      attemptNumber += 1
      tokenRequestCount = 0
      mediaMountCount = 0
      softRecoveryCount = 0
      majorRecoveryCount = 0
      stages = []
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
      stages.push({ stage, atMs: Date.now() - startedAt })
    },

    snapshot(): StartupInstrumentationSnapshot {
      return {
        attemptNumber,
        tokenRequestCount,
        sessionTokenRequestTotal,
        mediaMountCount,
        softRecoveryCount,
        majorRecoveryCount,
        stages: stages.map((entry) => ({ ...entry })),
      }
    },
  }
}
