import { useEffect, useRef, useState } from 'react'
import { elapsedMs } from '../../../../api/src/modules/prime/core/clock.ts'

export function useSessionClock(frozenElapsedMs: number | null = null) {
  const startedAt = useRef<number | null>(null)
  const pausedAccumulatedMs = useRef(0)
  const pauseStartedAt = useRef<number | null>(null)
  const [running, setRunning] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (frozenElapsedMs !== null) {
      setElapsed(frozenElapsedMs)
      return
    }
    if (!running || paused) {
      return
    }

    let frame = 0
    const tick = (now: number) => {
      if (startedAt.current !== null) {
        setElapsed(elapsedMs(now, startedAt.current, pausedAccumulatedMs.current))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [frozenElapsedMs, paused, running])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && running && !paused) {
        pauseStartedAt.current = performance.now()
        setPaused(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [paused, running])

  function start() {
    startedAt.current = performance.now()
    pausedAccumulatedMs.current = 0
    pauseStartedAt.current = null
    setElapsed(0)
    setPaused(false)
    setRunning(true)
  }

  function pause() {
    if (!running || paused) {
      return
    }
    pauseStartedAt.current = performance.now()
    setPaused(true)
  }

  function resume() {
    if (!running || !paused || pauseStartedAt.current === null) {
      return
    }
    pausedAccumulatedMs.current += performance.now() - pauseStartedAt.current
    pauseStartedAt.current = null
    setPaused(false)
  }

  function end() {
    startedAt.current = null
    pausedAccumulatedMs.current = 0
    pauseStartedAt.current = null
    setRunning(false)
    setPaused(false)
    setElapsed(0)
  }

  return { elapsed, end, pause, paused, resume, running, start }
}
