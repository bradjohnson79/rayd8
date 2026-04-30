import { useEffect, useState } from 'react'
import { getTrialStatus, type TrialStatusResponse } from '../../services/trial'
import { useAuthUser } from './useAuthUser'
import { useAuthToken } from './useAuthToken'

const DEFAULT_REFRESH_MS = 60_000

export function useTrialStatus(refreshMs = DEFAULT_REFRESH_MS) {
  const user = useAuthUser()
  const getAuthToken = useAuthToken()
  const [trialStatus, setTrialStatus] = useState<TrialStatusResponse | null>(null)

  useEffect(() => {
    if (!user.isAuthenticated || user.plan !== 'free') {
      setTrialStatus(null)
      return
    }

    let cancelled = false

    const hydrateTrialStatus = async () => {
      try {
        const token = await getAuthToken()

        if (!token || cancelled) {
          return
        }

        const response = await getTrialStatus(token)

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
  }, [getAuthToken, refreshMs, user.isAuthenticated, user.plan])

  return trialStatus
}
