export type VisualPerformanceMode = 'automatic' | 'standard' | 'reduced'

export const VISUAL_PERFORMANCE_STORAGE_KEY = 'rayd8_visual_performance'
export const VISUAL_PERFORMANCE_CHANGE_EVENT = 'rayd8:visual-performance-change'

export function isVisualPerformanceMode(value: unknown): value is VisualPerformanceMode {
  return value === 'automatic' || value === 'standard' || value === 'reduced'
}

export function readVisualPerformanceMode(): VisualPerformanceMode {
  if (typeof window === 'undefined') {
    return 'automatic'
  }

  try {
    const stored = window.localStorage.getItem(VISUAL_PERFORMANCE_STORAGE_KEY)
    if (isVisualPerformanceMode(stored)) {
      return stored
    }
  } catch {
    /* private mode / blocked storage */
  }

  return 'automatic'
}

export function writeVisualPerformanceMode(mode: VisualPerformanceMode) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(VISUAL_PERFORMANCE_STORAGE_KEY, mode)
  } catch {
    /* private mode / blocked storage */
  }

  window.dispatchEvent(
    new CustomEvent(VISUAL_PERFORMANCE_CHANGE_EVENT, {
      detail: { mode },
    }),
  )
}

/** Map preference + automatic signals into ambient profile. */
export function resolveVisualPerformanceProfile(
  mode: VisualPerformanceMode,
  automaticProfile: 'cinematic' | 'balanced' | 'minimal',
): 'cinematic' | 'balanced' | 'minimal' {
  if (mode === 'reduced') {
    return 'minimal'
  }
  if (mode === 'standard') {
    return automaticProfile === 'cinematic' ? 'balanced' : automaticProfile
  }
  return automaticProfile
}
