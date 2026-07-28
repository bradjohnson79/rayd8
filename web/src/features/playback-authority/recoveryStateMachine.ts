/**
 * Bounded recovery state machine for dual/combined Mux HLS playback.
 * Prevents unbounded major recovery / loadSource / HLS recreate loops.
 */

export type RecoveryPipeline = 'video' | 'audio' | 'token'
export type RecoveryAction =
  | 'soft_resume'
  | 'media_error_recover'
  | 'start_load'
  | 'load_source'
  | 'hls_recreate'
  | 'terminal'

export type FreezeClass =
  | 'media_stall'
  | 'player_ui_freeze'
  | 'browser_tab_freeze'
  | 'graphics_freeze'
  | 'av_desync'
  | 'full_device_instability'
  | 'unknown'

export interface RecoveryAttemptRecord {
  action: RecoveryAction
  at: number
  pipeline: RecoveryPipeline
  reason: string
  success: boolean | null
}

export interface RecoveryBudgetConfig {
  /** Max major recoveries (start_load / media_error / load_source) per rolling window. */
  maxMajorPerWindow: number
  /** Rolling window length in ms. */
  windowMs: number
  /** Max major recoveries for an entire session. */
  maxMajorPerSession: number
  /** Max loadSource calls during healthy/token refresh for a session. */
  maxLoadSourcePerSession: number
  /** Base backoff after a failed major recovery. */
  baseBackoffMs: number
  /** Cap for exponential backoff. */
  maxBackoffMs: number
}

export const DEFAULT_RECOVERY_BUDGET: RecoveryBudgetConfig = {
  maxMajorPerWindow: 3,
  windowMs: 5 * 60_000,
  maxMajorPerSession: 8,
  maxLoadSourcePerSession: 6,
  baseBackoffMs: 30_000,
  maxBackoffMs: 5 * 60_000,
}

const MAJOR_ACTIONS = new Set<RecoveryAction>([
  'media_error_recover',
  'start_load',
  'load_source',
  'hls_recreate',
])

export interface RecoveryPermit {
  allowed: boolean
  action: RecoveryAction | 'deny'
  backoffMs: number
  reason: string
  terminal: boolean
}

export class RecoveryStateMachine {
  private readonly config: RecoveryBudgetConfig
  private readonly attempts: RecoveryAttemptRecord[] = []
  private consecutiveFailures = 0
  private terminal = false
  private lastMajorAt = 0

  constructor(config: Partial<RecoveryBudgetConfig> = {}) {
    this.config = { ...DEFAULT_RECOVERY_BUDGET, ...config }
  }

  get isTerminal() {
    return this.terminal
  }

  getAttemptCount() {
    return this.attempts.length
  }

  getMajorAttemptCount(now = Date.now()) {
    const sessionMajor = this.attempts.filter((a) => MAJOR_ACTIONS.has(a.action)).length
    const windowMajor = this.attempts.filter(
      (a) => MAJOR_ACTIONS.has(a.action) && now - a.at <= this.config.windowMs,
    ).length
    const loadSource = this.attempts.filter((a) => a.action === 'load_source').length
    return { sessionMajor, windowMajor, loadSource }
  }

  getSnapshot(now = Date.now()) {
    const counts = this.getMajorAttemptCount(now)
    return {
      consecutiveFailures: this.consecutiveFailures,
      terminal: this.terminal,
      attempts: this.attempts.slice(-40),
      ...counts,
      nextBackoffMs: this.computeBackoffMs(),
    }
  }

  reset() {
    this.attempts.length = 0
    this.consecutiveFailures = 0
    this.terminal = false
    this.lastMajorAt = 0
  }

  /**
   * Request permission to perform a recovery action.
   * Soft resume is always allowed unless terminal.
   */
  request(
    pipeline: RecoveryPipeline,
    preferred: RecoveryAction,
    reason: string,
    now = Date.now(),
  ): RecoveryPermit {
    if (this.terminal) {
      return {
        allowed: false,
        action: 'deny',
        backoffMs: 0,
        reason: 'terminal_error_state',
        terminal: true,
      }
    }

    if (preferred === 'soft_resume') {
      return {
        allowed: true,
        action: 'soft_resume',
        backoffMs: 0,
        reason,
        terminal: false,
      }
    }

    if (preferred === 'terminal') {
      this.terminal = true
      this.record({ action: 'terminal', at: now, pipeline, reason, success: false })
      return {
        allowed: false,
        action: 'deny',
        backoffMs: 0,
        reason: 'forced_terminal',
        terminal: true,
      }
    }

    const counts = this.getMajorAttemptCount(now)

    if (counts.sessionMajor >= this.config.maxMajorPerSession) {
      this.terminal = true
      this.record({ action: 'terminal', at: now, pipeline, reason: 'session_budget_exhausted', success: false })
      return {
        allowed: false,
        action: 'deny',
        backoffMs: 0,
        reason: 'session_budget_exhausted',
        terminal: true,
      }
    }

    if (counts.windowMajor >= this.config.maxMajorPerWindow) {
      const backoffMs = this.computeBackoffMs()
      return {
        allowed: false,
        action: 'deny',
        backoffMs,
        reason: 'window_budget_exhausted',
        terminal: false,
      }
    }

    if (preferred === 'load_source' && counts.loadSource >= this.config.maxLoadSourcePerSession) {
      this.terminal = true
      this.record({
        action: 'terminal',
        at: now,
        pipeline,
        reason: 'load_source_budget_exhausted',
        success: false,
      })
      return {
        allowed: false,
        action: 'deny',
        backoffMs: 0,
        reason: 'load_source_budget_exhausted',
        terminal: true,
      }
    }

    const sinceLast = now - this.lastMajorAt
    const requiredBackoff = this.computeBackoffMs()

    if (this.lastMajorAt > 0 && sinceLast < requiredBackoff) {
      return {
        allowed: false,
        action: 'deny',
        backoffMs: Math.max(0, requiredBackoff - sinceLast),
        reason: 'backoff_active',
        terminal: false,
      }
    }

    return {
      allowed: true,
      action: preferred,
      backoffMs: 0,
      reason,
      terminal: false,
    }
  }

  begin(
    pipeline: RecoveryPipeline,
    action: RecoveryAction,
    reason: string,
    now = Date.now(),
  ) {
    if (MAJOR_ACTIONS.has(action)) {
      this.lastMajorAt = now
    }

    this.record({ action, at: now, pipeline, reason, success: null })
  }

  complete(success: boolean) {
    const last = this.attempts[this.attempts.length - 1]

    if (last && last.success === null) {
      last.success = success
    }

    if (success) {
      this.consecutiveFailures = 0
      return
    }

    this.consecutiveFailures += 1

    if (this.consecutiveFailures >= this.config.maxMajorPerWindow) {
      this.terminal = true
      this.record({
        action: 'terminal',
        at: Date.now(),
        pipeline: last?.pipeline ?? 'video',
        reason: 'consecutive_failures',
        success: false,
      })
    }
  }

  private computeBackoffMs() {
    if (this.consecutiveFailures <= 0) {
      return this.config.baseBackoffMs
    }

    const scaled = this.config.baseBackoffMs * 2 ** Math.min(this.consecutiveFailures, 4)
    return Math.min(this.config.maxBackoffMs, scaled)
  }

  private record(entry: RecoveryAttemptRecord) {
    this.attempts.push(entry)
    if (this.attempts.length > 200) {
      this.attempts.splice(0, this.attempts.length - 200)
    }
  }
}

/** Pure helper used by regression tests: simulate a storm of major recoveries. */
export function simulateUnboundedRecoveryStorm(
  machine: RecoveryStateMachine,
  iterations = 50,
): { allowed: number; denied: number; terminal: boolean } {
  let allowed = 0
  let denied = 0
  let now = Date.now()

  for (let i = 0; i < iterations; i += 1) {
    const permit = machine.request('video', 'start_load', 'storm', now)

    if (!permit.allowed) {
      denied += 1
      now += Math.max(1_000, permit.backoffMs)
      continue
    }

    allowed += 1
    machine.begin('video', 'start_load', 'storm', now)
    machine.complete(false)
    now += 1_000
  }

  return { allowed, denied, terminal: machine.isTerminal }
}
