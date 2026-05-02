import { Outlet } from 'react-router-dom'
import { RouteMetadataManager } from './RouteMetadataManager'
import { ReferralAttributionManager } from '../features/referrals/ReferralAttributionManager'

export function AppShell() {
  return (
    <>
      <RouteMetadataManager />
      <ReferralAttributionManager />
      <Outlet />
    </>
  )
}
