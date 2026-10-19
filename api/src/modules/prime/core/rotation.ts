export const ROTATION_SECONDS = [15, 30, 60, 90] as const
export type RotationSeconds = (typeof ROTATION_SECONDS)[number]

export function playlistIndex(elapsedMs: number, intervalSeconds: number, length: number) {
  if (length <= 0 || intervalSeconds <= 0) {
    return 0
  }

  const intervalMs = intervalSeconds * 1000
  return Math.floor(Math.max(0, elapsedMs) / intervalMs) % length
}

/** 1 at the start of a slot, fading during the last crossfade window. */
export function slotOpacity(elapsedMs: number, intervalSeconds: number, crossfadeMs = 1500) {
  const intervalMs = intervalSeconds * 1000
  const intoSlot = Math.max(0, elapsedMs) % intervalMs
  const fadeStart = Math.max(0, intervalMs - crossfadeMs)

  if (intoSlot < crossfadeMs) {
    return intoSlot / crossfadeMs
  }

  if (intoSlot > fadeStart) {
    return 1 - (intoSlot - fadeStart) / crossfadeMs
  }

  return 1
}
