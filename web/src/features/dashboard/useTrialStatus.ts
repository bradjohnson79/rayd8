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

    void hydrateTrialStatus()
    const intervalId = window.setInterval(() => {
      void hydrateTrialStatus()
    }, refreshMs)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [authUser?.plan, getTokenSafe, refreshMs, status])

  return trialStatus
}
