export type UserRole = 'member' | 'admin'
export type PlanTier = 'free' | 'premium' | 'regen' | 'amrita'
export type Experience = 'expansion' | 'premium' | 'regen'
export type DashboardView = 'free_trial' | 'regen' | 'amrita'
export type SessionType = Experience | 'amrita'
export type BillingPlan = 'regen'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  plan: PlanTier
  isAuthenticated: boolean
}
