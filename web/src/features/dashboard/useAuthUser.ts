import { useAuth, useUser } from '@clerk/react'
import type { AuthUser, PlanTier, UserRole } from '../../app/types'
import { isSourceOfTruthAdminEmail } from '../auth/sourceOfTruth'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

const demoUser: AuthUser = {
  id: 'demo-member',
  email: 'demo@rayd8.app',
  role: 'member',
  plan: 'free',
  isAuthenticated: false,
}

function normalizeRole(value: unknown): UserRole {
  return value === 'admin' ? 'admin' : 'member'
}

function resolveSourceOfTruthRole(email: string, role: UserRole) {
  return isSourceOfTruthAdminEmail(email) ? 'admin' : role
}

function normalizePlan(value: unknown): PlanTier {
  if (value === 'premium') {
    return 'premium'
  }

  if (value === 'regen') {
    return 'regen'
  }

  if (value === 'amrita') {
    return 'amrita'
  }

  return 'free'
}

export function useAuthUser(): AuthUser {
  return useResolvedAuthUser()
}

function useClerkAuthUser(): AuthUser {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth()
  const { isLoaded: isUserLoaded, user } = useUser()

  if (!isAuthLoaded || !isUserLoaded || !isSignedIn || !user) {
    return demoUser
  }

  return {
    id: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? demoUser.email,
    role: resolveSourceOfTruthRole(
      user.primaryEmailAddress?.emailAddress ?? demoUser.email,
      normalizeRole(user.publicMetadata.role),
    ),
    plan: normalizePlan(user.publicMetadata.plan),
    isAuthenticated: true,
  }
}

function useDemoAuthUser(): AuthUser {
  return demoUser
}

const useResolvedAuthUser = clerkEnabled ? useClerkAuthUser : useDemoAuthUser
