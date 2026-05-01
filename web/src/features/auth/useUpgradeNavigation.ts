import { useClerk } from '@clerk/react'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AUTH_LOADING_MESSAGE, SESSION_EXPIRED_MESSAGE, useAuthReadiness } from './useAuthReadiness'

const AUTH_RETURN_TO_STORAGE_KEY = 'rayd8_auth_return_to'
export const UPGRADE_PATH = '/subscription?plan=regen'

function setStoredAuthReturnTo(path: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, path)
}

export function consumeStoredAuthReturnTo() {
  if (typeof window === 'undefined') {
    return null
  }

  const nextValue = window.localStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY)

  if (!nextValue) {
    return null
  }

  window.localStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY)
  return nextValue
}

interface UpgradeNavigationOptions {
  onBeforeNavigate?: () => Promise<void> | void
  onError?: (message: string) => void
  onLoading?: (message: string) => void
  targetPath?: string
}

export function useUpgradeNavigation() {
  const { openSignIn } = useClerk()
  const navigate = useNavigate()
  const { status } = useAuthReadiness()

  return useCallback(
    async (options?: UpgradeNavigationOptions) => {
      const targetPath = options?.targetPath ?? UPGRADE_PATH

      if (status === 'loading') {
        options?.onLoading?.(AUTH_LOADING_MESSAGE)
        return false
      }

      if (status === 'signed-out') {
        setStoredAuthReturnTo(targetPath)
        options?.onError?.(SESSION_EXPIRED_MESSAGE)
        await openSignIn()
        return false
      }

      try {
        await options?.onBeforeNavigate?.()
        navigate(targetPath)
        return true
      } catch (error) {
        options?.onError?.(
          error instanceof Error ? error.message : 'Unable to open the upgrade page right now.',
        )
        return false
      }
    },
    [navigate, openSignIn, status],
  )
}
