import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { DashboardShell } from '../../components/DashboardShell'
import { useAuthUser } from './useAuthUser'
import { Sidebar } from './Sidebar'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const user = useAuthUser()

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
      sidebar={<Sidebar onClose={() => setSidebarOpen(false)} open={sidebarOpen} user={user} />}
      user={user}
      withGuestActions
    >
      <Outlet />
    </DashboardShell>
  )
}
