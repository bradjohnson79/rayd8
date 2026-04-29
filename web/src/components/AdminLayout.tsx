import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuthUser } from '../features/dashboard/useAuthUser'
import { AdminSidebar } from './AdminSidebar'
import { DashboardShell } from './DashboardShell'

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const user = useAuthUser()

  return (
    <DashboardShell
      accent="violet"
      description="Identity, billing, content, and streaming orchestration stay active while plan previews change the dashboard core."
      desktopSidebarOffsetClass="xl:pl-[25vw]"
      eyebrow="RAYD8® operating system"
      menuButtonClassName=""
      menuButtonLabel="Open admin navigation"
      onOpenSidebar={() => setSidebarOpen(true)}
      sidebar={<AdminSidebar onClose={() => setSidebarOpen(false)} open={sidebarOpen} />}
      user={user}
    >
      <Outlet />
    </DashboardShell>
  )
}
