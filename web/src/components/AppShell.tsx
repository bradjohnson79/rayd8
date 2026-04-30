import { Outlet } from 'react-router-dom'
import { RouteMetadataManager } from './RouteMetadataManager'

export function AppShell() {
  return (
    <>
      <RouteMetadataManager />
      <Outlet />
    </>
  )
}
