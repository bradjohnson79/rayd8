export function outlinePx(level: number) {
  const clamped = Math.min(8, Math.max(1, Math.round(level)))
  return clamped + 2
}
