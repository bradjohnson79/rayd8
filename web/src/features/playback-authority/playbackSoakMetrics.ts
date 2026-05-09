function engineeringPlaybackProbeEnabled() {
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

/** Same gate as player diagnostics: staging soak when ?rayd8PlayerDebug=true or localStorage flag. */
export function isPlaybackSoakMetricsEnabled() {
  return engineeringPlaybackProbeEnabled()
}

export interface PlaybackSoakMetricsSnapshot {
  authorityDecisions: Record<string, number>
  interruptionsBySignal: Record<string, number>
  playingUptimeMs: number
  lastFreezeStartedAt: number | null
  cumulativeFreezeMs: number
  decisionLog: Array<{ at: number; signalType: string; machineAfter?: string }>
}

const RING_MAX = 80

let metrics: PlaybackSoakMetricsSnapshot | null = null
let playingSince: number | null = null

function ensureMetrics(): PlaybackSoakMetricsSnapshot {
  metrics ??= {
    authorityDecisions: {},
    interruptionsBySignal: {},
    playingUptimeMs: 0,
    lastFreezeStartedAt: null,
    cumulativeFreezeMs: 0,
    decisionLog: [],
  }
  return metrics
}

export function recordAuthorityDecision(signalType: string, machineAfter?: string) {
  if (!isPlaybackSoakMetricsEnabled()) {
    return
  }

  const m = ensureMetrics()
  m.authorityDecisions[signalType] = (m.authorityDecisions[signalType] ?? 0) + 1
  m.decisionLog.push({ at: Date.now(), signalType, machineAfter })
  if (m.decisionLog.length > RING_MAX) {
    m.decisionLog.splice(0, m.decisionLog.length - RING_MAX)
  }
}

export function recordInterruption(signalType: string) {
  if (!isPlaybackSoakMetricsEnabled()) {
    return
  }

  const m = ensureMetrics()
  m.interruptionsBySignal[signalType] = (m.interruptionsBySignal[signalType] ?? 0) + 1
}

export function soakMarkPlayingState(isPlaying: boolean) {
  if (!isPlaybackSoakMetricsEnabled()) {
    return
  }

  const now = Date.now()
  const m = ensureMetrics()

  if (isPlaying) {
    if (playingSince === null) {
      playingSince = now
    }
    return
  }

  if (playingSince !== null) {
    m.playingUptimeMs += Math.max(0, now - playingSince)
    playingSince = null
  }
}

export function soakFreezeStart() {
  if (!isPlaybackSoakMetricsEnabled()) {
    return
  }

  const m = ensureMetrics()
  m.lastFreezeStartedAt = Date.now()
}

export function soakFreezeEnd() {
  if (!isPlaybackSoakMetricsEnabled()) {
    return
  }

  const m = ensureMetrics()
  if (m.lastFreezeStartedAt !== null) {
    m.cumulativeFreezeMs += Math.max(0, Date.now() - m.lastFreezeStartedAt)
    m.lastFreezeStartedAt = null
  }
}

export function getPlaybackSoakMetricsSnapshot(): PlaybackSoakMetricsSnapshot | null {
  if (!isPlaybackSoakMetricsEnabled()) {
    return null
  }

  return ensureMetrics()
}

export function resetPlaybackSoakMetrics() {
  metrics = null
  playingSince = null
}
