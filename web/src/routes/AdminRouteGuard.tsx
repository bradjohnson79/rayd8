import { RedirectToSignIn } from '@clerk/react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAdminAccess } from '../features/auth/useAdminAccess'

export function AdminRouteGuard() {
  const { isAdmin, isLoaded, isSignedIn } = useAdminAccess()

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--rayd8-bg)] px-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-black/20 px-6 py-5 text-sm text-slate-300 backdrop-blur-xl">
          Checking admin access...
        </div>
      </div>
    )
  }

  if (!isSignedIn) {
    return <RedirectToSignIn redirectUrl="/admin" />
  }

  if (!isAdmin) {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}
