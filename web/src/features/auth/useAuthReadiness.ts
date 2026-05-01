import { useAuth, useUser } from '@clerk/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { AuthUser, PlanTier, UserRole } from '../../app/types'
import { isSourceOfTruthAdminEmail } from './sourceOfTruth'

export type AuthReadinessStatus = 'loading' | 'signed-in' | 'signed-out'
export type TokenSafeError = 'loading' | 'signed-out' | 'token-unavailable'

export const AUTH_LOADING_MESSAGE = 'Checking your session...'
export const AUTH_LOADING_SLOW_MESSAGE =
  'Still connecting... if this continues, please refresh or sign in again.'
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again to continue.'
export const SESSION_RESUME_MESSAGE = 'Please sign in again to continue your session.'
export const CHECKOUT_FAILURE_MESSAGE = "We couldn't start checkout. Please try again."

const fallbackAuthUser: AuthUser = {
  id: 'demo-member',
  email: 'demo@rayd8.app',
  role: 'member',
  plan: 'free',
  isAuthenticated: false,
}

function logInDev(event: string, payload?: Record<string, unknown>) {
  if (!import.meta.env.DEV) {
    return
  }

  if (payload) {
    console.info(`[auth] ${event}`, payload)
    return
  }

  console.info(`[auth] ${event}`)
}

function normalizeRole(value: unknown): UserRole {
  return value === 'admin' ? 'admin' : 'member'
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

function toAuthUser(value: ReturnType<typeof useUser>['user']): AuthUser {
  const email = value?.primaryEmailAddress?.emailAddress ?? fallbackAuthUser.email
  const role = isSourceOfTruthAdminEmail(email)
    ? 'admin'
    : normalizeRole(value?.publicMetadata.role)

  return {
    id: value?.id ?? fallbackAuthUser.id,
    email,
    role,
    plan: normalizePlan(value?.publicMetadata.plan),
    isAuthenticated: true,
  }
}

export function useAuthReadiness() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth()
  const { isLoaded: isUserLoaded, user } = useUser()
  const isLoaded = isAuthLoaded && isUserLoaded
  const status: AuthReadinessStatus = !isLoaded
    ? 'loading'
    : isSignedIn && user
      ? 'signed-in'
      : 'signed-out'
  const authUser = useMemo(() => (status === 'signed-in' && user ? toAuthUser(user) : null), [status, user])
  const previousStatusRef = useRef<AuthReadinessStatus | null>(null)

  useEffect(() => {
    if (previousStatusRef.current === status) {
      return
    }

    logInDev('state-change', {
      isLoaded,
      isSignedIn,
      status,
      userId: user?.id ?? null,
    })
    previousStatusRef.current = status
  }, [isLoaded, isSignedIn, status, user?.id])

  const getTokenSafe = useCallback(async () => {
    if (!isLoaded) {
      return {
        token: null,
        error: 'loading' as const,
      }
    }

    if (!isSignedIn) {
      return {
        token: null,
        error: 'signed-out' as const,
      }
    }

    try {
      const token = await getToken({ skipCache: true })

      if (!token) {
        logInDev('token-unavailable', {
          status,
          userId: user?.id ?? null,
        })

        return {
          token: null,
          error: 'token-unavailable' as const,
        }
      }

      return {
        token,
        error: null,
      }
    } catch (error) {
      logInDev('token-failed', {
        message: error instanceof Error ? error.message : String(error),
        status,
        userId: user?.id ?? null,
      })

      return {
        token: null,
        error: 'token-unavailable' as const,
      }
    }
  }, [getToken, isLoaded, isSignedIn, status, user?.id])

  return {
    authUser,
    getTokenSafe,
    isLoaded,
    isSignedIn: status === 'signed-in',
    status,
    user,
  }
}

export function getFallbackAuthUser() {
  return fallbackAuthUser
}
