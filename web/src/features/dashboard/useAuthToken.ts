import { useAuth } from '@clerk/react'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

function useClerkAuthToken() {
  const { getToken, isSignedIn } = useAuth()

  if (!isSignedIn) {
    return async () => null
  }

  return getToken
}

function useDemoAuthToken() {
  return async () => null
}

const useResolvedAuthToken = clerkEnabled ? useClerkAuthToken : useDemoAuthToken

export function useAuthToken() {
  return useResolvedAuthToken()
}
