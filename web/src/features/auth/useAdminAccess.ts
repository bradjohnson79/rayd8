import { useAuth, useUser } from '@clerk/react'
import { isSourceOfTruthAdminEmail } from './sourceOfTruth'

export function useAdminAccess() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress
  const isAdmin =
    user?.publicMetadata.role === 'admin' || isSourceOfTruthAdminEmail(email)

  return {
    isAdmin,
    isLoaded,
    isSignedIn,
    user,
  }
}
