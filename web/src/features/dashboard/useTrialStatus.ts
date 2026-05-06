import { useEffect, useState } from 'react'
import { getTrialStatus, type TrialStatusResponse } from '../../services/trial'
import { useAuthReadiness } from '../auth/useAuthReadiness'

const DEFAULT_REFRESH_MS = 60_000

export function useTrialStatus(refreshMs = DEFAULT_REFRESH_MS) {
  const { authUser, getTokenSafe, status } = useAuthReadiness()
  const [trialStatus, setTrialStatus] = useState<TrialStatusResponse | null>(null)

  useEffect(() => {
    if (status !== 'signed-in' || authUser?.plan !== 'free') {
      setTrialStatus(null)
      return
    }

    let cancelled = false
    let intervalId: number | null = null

    const hydrateTrialStatus = async () => {
      try {
        const tokenResult = await getTokenSafe()

        if (!tokenResult.token || cancelled) {
          return
        }

        const response = await getTrialStatus(tokenResult.token)

        if (!cancelled) {
          setTrialStatus(response)
        }
      } catch {
        if (!cancelled) {
          setTrialStatus(null)
        }
      }
    }

    const startInterval = () => {
      if (intervalId !== null) {
        return
      }
      intervalId = window.setInterval(() => {
        void hydrateTrialStatus()
      }, refreshMs)
    }

    const stopInterval = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const isVisible = () =>
      typeof document === 'undefined' ? true : document.visibilityState === 'visible'

    void hydrateTrialStatus()

    if (isVisible()) {
      startInterval()
    }

    const handleVisibilityChange = () => {
      if (cancelled) {
        return
      }
      if (isVisible()) {
        void hydrateTrialStatus()
        startInterval()
      } else {
        stopInterval()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [authUser?.plan, getTokenSafe, refreshMs, status])

  return trialStatus
}
