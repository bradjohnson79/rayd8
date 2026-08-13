import type { PlanTier } from '../../app/types'

export function hasHamsaPlanAccess(plan: PlanTier | null | undefined) {
  return plan === 'regen' || plan === 'amrita'
}

export type HamsaAccessDecision = 'loading' | 'launch' | 'locked'

export function resolveHamsaAccessDecision(input: {
  authStatus: 'loading' | 'signed-in' | 'signed-out'
  clerkPlan: PlanTier | null
  dbBackedPlan: PlanTier | null
  dbPlanChecked: boolean
}): HamsaAccessDecision {
  if (input.authStatus === 'loading') {
    return 'loading'
  }

  if (hasHamsaPlanAccess(input.clerkPlan)) {
    return 'launch'
  }

  if (input.authStatus === 'signed-in' && !input.dbPlanChecked) {
    return 'loading'
  }

  return hasHamsaPlanAccess(input.dbBackedPlan) ? 'launch' : 'locked'
}
