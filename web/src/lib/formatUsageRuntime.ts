function toSafeSeconds(value: number | null) {
  return Math.max(0, Math.floor(value ?? 0))
}

export function formatRuntimeClock(seconds: number | null) {
  if (seconds === null) {
    return 'UNLIMITED'
  }

  const safeSeconds = toSafeSeconds(seconds)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60

  return `${hours} HR : ${String(minutes).padStart(2, '0')} MIN : ${String(remainingSeconds).padStart(2, '0')} SEC`
}

export function formatRuntimeLimit(seconds: number | null) {
  if (seconds === null) {
    return 'UNLIMITED'
  }

  const hours = Math.max(0, Math.floor(seconds / 3600))
  return `${hours} HOURS`
}

export function formatUsagePercent(value: number | null) {
  if (value === null) {
    return '--% used'
  }

  return `${Math.round(Math.max(0, Math.min(100, value)))}% used`
}
