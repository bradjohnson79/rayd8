import type { AuthUser } from '../../app/types'
import { getFallbackAuthUser, useAuthReadiness } from '../auth/useAuthReadiness'

export function useAuthUser(): AuthUser {
  const { authUser } = useAuthReadiness()

  return authUser ?? getFallbackAuthUser()
}
