export const TWO_HOURS_MS = 2 * 60 * 60 * 1000

export function shouldTriggerSessionWarning(input: {
  allowExtendedSessions: boolean
  now: number
  sessionStartTime: number | null
}) {
  if (input.allowExtendedSessions || input.sessionStartTime === null) {
    return false
  }

  return input.now - input.sessionStartTime >= TWO_HOURS_MS
}
