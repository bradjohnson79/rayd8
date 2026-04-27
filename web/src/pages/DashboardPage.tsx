import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { dashboardSectionIds } from '../features/dashboard/dashboardSections'
import { Rayd8Dashboard } from '../features/rayd8-dashboard/Rayd8Dashboard'

export function DashboardPage() {
  const location = useLocation()

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

  return <Rayd8Dashboard />
}
