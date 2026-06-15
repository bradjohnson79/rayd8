import { RedirectToSignIn } from '@clerk/react'
import { useCallback, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { AuthUser, PlanTier } from '../../app/types'
import { DashboardShell } from '../../components/DashboardShell'
import {
  AUTH_LOADING_MESSAGE,
  AUTH_LOADING_SLOW_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  useAuthReadiness,
} from '../auth/useAuthReadiness'
import { consumeStoredAuthReturnTo } from '../auth/useUpgradeNavigation'
import { useSession } from '../session/SessionProvider'
import { useAuthUser } from './useAuthUser'
import { Sidebar } from './Sidebar'
import { ExpressNavigationProvider, useExpressNavigation } from './useExpressNavigation'
import { getMe } from '../../services/me'

export function DashboardLayout() {
  const user = useAuthUser()
  const { authUser, getTokenSafe, status } = useAuthReadiness()
  const location = useLocation()
  const navigate = useNavigate()
  const [showSlowLoadingCopy, setShowSlowLoadingCopy] = useState(false)
  const [dbPlan, setDbPlan] = useState<PlanTier | null>(null)
  const [dbPlanChecked, setDbPlanChecked] = useState(false)

  useEffect(() => {
    if (status !== 'loading') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowSlowLoadingCopy(true)
    }, 2500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'signed-in') {
      setDbPlan(null)
      setDbPlanChecked(false)
      return
    }

    const pendingPath = consumeStoredAuthReturnTo()

    if (!pendingPath || pendingPath === `${location.pathname}${location.search}`) {
      return
    }

    navigate(pendingPath, { replace: true })
  }, [location.pathname, location.search, navigate, status])

  useEffect(() => {
    if (status !== 'signed-in') {
      return
    }

    let cancelled = false

    async function hydrateDbPlan() {
      const tokenResult = await getTokenSafe()

      if (!tokenResult.token) {
        if (!cancelled) {
          setDbPlan(null)
          setDbPlanChecked(true)
        }
        return
      }

      try {
        const response = await getMe(tokenResult.token)

        if (!cancelled) {
          setDbPlan(response.user?.plan ?? null)
          setDbPlanChecked(true)
        }
      } catch {
        if (!cancelled) {
          setDbPlan(null)
          setDbPlanChecked(true)
        }
      }
    }

    setDbPlanChecked(false)
    void hydrateDbPlan()

    return () => {
      cancelled = true
    }
  }, [getTokenSafe, status])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--rayd8-bg)] px-6 text-white">
        <div className="max-w-md rounded-3xl border border-white/10 bg-black/20 px-6 py-5 text-center text-sm text-slate-300 backdrop-blur-xl">
          <p>{AUTH_LOADING_MESSAGE}</p>
          {showSlowLoadingCopy ? <p className="mt-3 text-slate-400">{AUTH_LOADING_SLOW_MESSAGE}</p> : null}
        </div>
      </div>
    )
  }

  if (status === 'signed-out') {
    if (new URLSearchParams(location.search).get('source') === 'express') {
      return <Navigate replace to="/signup?source=express" />
    }

    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-[var(--rayd8-bg)] px-6 text-white">
          <div className="max-w-md rounded-3xl border border-white/10 bg-black/20 px-6 py-5 text-center text-sm text-slate-300 backdrop-blur-xl">
            {SESSION_EXPIRED_MESSAGE}
          </div>
        </div>
        <RedirectToSignIn redirectUrl={`${location.pathname}${location.search}${location.hash}`} />
      </>
    )
  }

  return (
    <ExpressNavigationProvider>
      <SignedInDashboardLayout
        isMembershipLoading={!dbPlanChecked}
        user={authUser ? { ...authUser, plan: dbPlan ?? authUser.plan } : user}
      />
    </ExpressNavigationProvider>
  )
}

function SignedInDashboardLayout({
  isMembershipLoading,
  user,
}: {
  isMembershipLoading: boolean
  user: AuthUser
}) {
  const location = useLocation()
  const { isActive } = useSession()
  const {
    closeSidebar,
    isSidebarOpen,
    shellMode,
    shouldRenderSidebar,
    toggleSidebar,
  } = useExpressNavigation()

  useEffect(() => {
    if (shellMode === 'drawer') {
      closeSidebar()
    }
  }, [closeSidebar, location.pathname, shellMode])

  useEffect(() => {
    if (isActive) {
      closeSidebar()
    }
  }, [closeSidebar, isActive])

  const handleToggleSidebar = useCallback(() => {
    if (isActive) {
      closeSidebar()
      return
    }

    toggleSidebar()
  }, [closeSidebar, isActive, toggleSidebar])

  return (
    <DashboardShell
      accent="emerald"
      description="One shared dashboard surface for session launch, guidance, and account controls."
      desktopSidebarOffsetClass={shellMode === 'persistent' ? 'pl-[25vw]' : ''}
      eyebrow="RAYD8® USER ACCOUNT"
      isSessionActive={isActive}
      isSidebarOpen={isSidebarOpen}
      menuButtonClassName=""
      menuButtonLabel="Open navigation"
      onToggleSidebar={handleToggleSidebar}
      presentation="immersive"
      shellMode={shellMode}
      sidebar={
        shouldRenderSidebar ? (
          <Sidebar
            isMembershipLoading={isMembershipLoading}
            onClose={closeSidebar}
            open={isSidebarOpen}
            shellMode={shellMode}
            user={user}
          />
        ) : null
      }
      user={user}
    >
      <Outlet />
    </DashboardShell>
  )
}
