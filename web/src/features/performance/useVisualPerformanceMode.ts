import { useEffect, useState } from 'react'
import {
  readVisualPerformanceMode,
  VISUAL_PERFORMANCE_CHANGE_EVENT,
  type VisualPerformanceMode,
  writeVisualPerformanceMode,
} from './visualPerformancePreference'

export function useVisualPerformanceMode() {
  const [mode, setMode] = useState<VisualPerformanceMode>(() => readVisualPerformanceMode())

  useEffect(() => {
    const sync = () => setMode(readVisualPerformanceMode())
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'rayd8_visual_performance') {
        sync()
      }
    }
    const onCustom = () => sync()

    window.addEventListener('storage', onStorage)
    window.addEventListener(VISUAL_PERFORMANCE_CHANGE_EVENT, onCustom as EventListener)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(VISUAL_PERFORMANCE_CHANGE_EVENT, onCustom as EventListener)
    }
  }, [])

  return {
    mode,
    setMode: (next: VisualPerformanceMode) => {
      writeVisualPerformanceMode(next)
      setMode(next)
    },
  }
}
