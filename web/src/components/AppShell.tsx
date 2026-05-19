import { Outlet } from 'react-router-dom'
import { RouteMetadataManager } from './RouteMetadataManager'
import { ReferralAttributionManager } from '../features/referrals/ReferralAttributionManager'
import { RewardfulAttributionManager } from '../features/rewardful/RewardfulAttributionManager'

export function AppShell() {
  return (
    <>
      <RouteMetadataManager />
      <ReferralAttributionManager />
      <RewardfulAttributionManager />
      <Outlet />
    </>
  )
}
