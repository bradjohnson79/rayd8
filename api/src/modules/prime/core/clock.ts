export function elapsedMs(now: number, sessionStartedAt: number, pausedAccumulatedMs: number) {
  return Math.max(0, now - sessionStartedAt - pausedAccumulatedMs)
}
