/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react'

export type ExpressShellMode = 'drawer' | 'persistent'

const PERSISTENT_SIDEBAR_QUERY = '(min-width: 1024px)'

interface ExpressNavigationContextValue {
  closeSidebar: () => void
  closeSidebarThen: (callback: () => void) => Promise<void>
  isMobileShell: boolean
  isSidebarOpen: boolean
  openSidebar: () => void
  shellMode: ExpressShellMode
  toggleSidebar: () => void
}

interface ExpressNavigationProviderProps extends PropsWithChildren {
  forceDrawerMode?: boolean
}

const ExpressNavigationContext = createContext<ExpressNavigationContextValue | null>(null)

function isPersistentSidebarViewport() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia(PERSISTENT_SIDEBAR_QUERY).matches
}

function subscribeToPersistentSidebarViewport(listener: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const mediaQuery = window.matchMedia(PERSISTENT_SIDEBAR_QUERY)
  mediaQuery.addEventListener('change', listener)

  return () => {
    mediaQuery.removeEventListener('change', listener)
  }
}

export function ExpressNavigationProvider({
  children,
  forceDrawerMode = false,
}: ExpressNavigationProviderProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const hasPersistentViewport = useSyncExternalStore(
    subscribeToPersistentSidebarViewport,
    isPersistentSidebarViewport,
    () => false,
  )
  const shellMode: ExpressShellMode =
    forceDrawerMode || !hasPersistentViewport ? 'drawer' : 'persistent'
  const isMobileShell = shellMode === 'drawer'

  const closeSidebar = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  const openSidebar = useCallback(() => {
    setIsSidebarOpen(true)
  }, [])

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((currentValue) => !currentValue)
  }, [])

  const closeSidebarThen = useCallback(
    async (callback: () => void) => {
      closeSidebar()
      callback()
    },
    [closeSidebar],
  )

  useEffect(() => {
    if (shellMode === 'persistent') {
      const frameId = window.requestAnimationFrame(closeSidebar)

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [closeSidebar, shellMode])

  const value = useMemo(
    () => ({
      closeSidebar,
      closeSidebarThen,
      isMobileShell,
      isSidebarOpen,
      openSidebar,
      shellMode,
      toggleSidebar,
    }),
    [
      closeSidebar,
      closeSidebarThen,
      isMobileShell,
      isSidebarOpen,
      openSidebar,
      shellMode,
      toggleSidebar,
    ],
  )

  return (
    <ExpressNavigationContext.Provider value={value}>
      {children}
    </ExpressNavigationContext.Provider>
  )
}

export function useExpressNavigation() {
  const context = useContext(ExpressNavigationContext)

  if (!context) {
    throw new Error('useExpressNavigation must be used inside ExpressNavigationProvider.')
  }

  return context
}

export function useOptionalExpressNavigation() {
  return useContext(ExpressNavigationContext)
}
