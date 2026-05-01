import { RedirectToSignIn } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { DashboardShell } from '../../components/DashboardShell'
import {
  AUTH_LOADING_MESSAGE,
  AUTH_LOADING_SLOW_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  useAuthReadiness,
} from '../auth/useAuthReadiness'
import { consumeStoredAuthReturnTo } from '../auth/useUpgradeNavigation'
import { useAuthUser } from './useAuthUser'
import { Sidebar } from './Sidebar'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const user = useAuthUser()
  const { authUser, status } = useAuthReadiness()
  const location = useLocation()
  const navigate = useNavigate()
  const [showSlowLoadingCopy, setShowSlowLoadingCopy] = useState(false)

  useEffect(() => {
    if (status !== 'loading') {
      setShowSlowLoadingCopy(false)
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
      return
    }

    const pendingPath = consumeStoredAuthReturnTo()

    if (!pendingPath || pendingPath === `${location.pathname}${location.search}`) {
      return
    }

    navigate(pendingPath, { replace: true })
  }, [location.pathname, location.search, navigate, status])

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
    <DashboardShell
      accent="emerald"
      description="One shared dashboard surface for session launch, guidance, and account controls."
      desktopSidebarOffsetClass="md:pl-[25vw]"
      eyebrow="RAYD8® USER ACCOUNT"
      menuButtonClassName=""
      menuButtonLabel="Open navigation"
      onOpenSidebar={() => setSidebarOpen(true)}
      presentation="immersive"
      sidebar={<Sidebar onClose={() => setSidebarOpen(false)} open={sidebarOpen} user={authUser ?? user} />}
      user={authUser ?? user}
    >
      <Outlet />
    </DashboardShell>
  )
}
