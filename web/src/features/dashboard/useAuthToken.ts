import { useAuth } from '@clerk/react'
import { useCallback } from 'react'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

function useClerkAuthToken() {
  const { getToken, isLoaded, isSignedIn } = useAuth()

  return useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      return null
    }

    try {
      return await getToken({ skipCache: true })
    } catch {
      return null
    }
  }, [getToken, isLoaded, isSignedIn])
}

function useDemoAuthToken() {
  return async () => null
}

const useResolvedAuthToken = clerkEnabled ? useClerkAuthToken : useDemoAuthToken

export function useAuthToken() {
  return useResolvedAuthToken()
}
