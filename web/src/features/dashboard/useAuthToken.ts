import { useCallback } from 'react'
import { useAuthReadiness } from '../auth/useAuthReadiness'

export function useAuthToken() {
  const { getTokenSafe } = useAuthReadiness()

  return useCallback(async () => {
    const result = await getTokenSafe()
    return result.token
  }, [getTokenSafe])
}
