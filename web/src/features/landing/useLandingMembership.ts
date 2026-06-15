import { useEffect, useMemo, useState } from 'react'
import type { PlanTier } from '../../app/types'
import { getMe } from '../../services/me'
import { useAuthReadiness } from '../auth/useAuthReadiness'

interface LandingMembershipState {
  isAuthenticated: boolean
  isLoading: boolean
  plan: PlanTier | null
}

export function useLandingMembership(): LandingMembershipState {
  const { authUser, getTokenSafe, status } = useAuthReadiness()
  const [dbPlan, setDbPlan] = useState<PlanTier | null>(null)
  const [dbPlanChecked, setDbPlanChecked] = useState(false)

  useEffect(() => {
    if (status !== 'signed-in') {
      setDbPlan(null)
      setDbPlanChecked(false)
      return
    }

    let cancelled = false

    async function hydratePlan() {
      const tokenResult = await getTokenSafe()

      if (!tokenResult.token) {
        if (!cancelled) {
          setDbPlan(null)
          setDbPlanChecked(true)
        }
        return
      }

      try {
        const response = await getMe(tokenResult.token)

        if (!cancelled) {
          setDbPlan(response.user?.plan ?? null)
          setDbPlanChecked(true)
        }
      } catch {
        if (!cancelled) {
          setDbPlan(null)
          setDbPlanChecked(true)
        }
      }
    }

    setDbPlanChecked(false)
    void hydratePlan()

    return () => {
      cancelled = true
    }
  }, [getTokenSafe, status])

  return useMemo(
    () => ({
      isAuthenticated: status === 'signed-in',
      isLoading: status === 'loading' || (status === 'signed-in' && !dbPlanChecked),
      plan: dbPlan ?? authUser?.plan ?? null,
    }),
    [authUser?.plan, dbPlan, dbPlanChecked, status],
  )
}
