import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { dashboardSectionIds } from '../features/dashboard/dashboardSections'
import { useAuthUser } from '../features/dashboard/useAuthUser'
import { Rayd8Dashboard } from '../features/rayd8-dashboard/Rayd8Dashboard'

interface DashboardPageProps {
  view?: 'amrita' | 'standard'
}

export function DashboardPage({ view = 'standard' }: DashboardPageProps) {
  const location = useLocation()
  const user = useAuthUser()

  useEffect(() => {
    const hashId = location.hash.replace('#', '')

    if (!dashboardSectionIds.includes(hashId as (typeof dashboardSectionIds)[number])) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const targetElement = document.getElementById(hashId)
      targetElement?.scrollIntoView({ behavior: 'auto', block: 'start' })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [location.hash])

  if (view === 'amrita' && user.plan !== 'amrita') {
    return <Navigate replace to="/subscription?plan=amrita" />
  }

  if (view === 'standard' && user.plan === 'amrita') {
    return <Navigate replace to="/amrita-dashboard" />
  }

  return <Rayd8Dashboard />
}
