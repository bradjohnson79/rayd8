import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { captureRewardfulViaFromSearch } from '../../services/rewardful'

export function RewardfulAttributionManager() {
  const location = useLocation()

  useEffect(() => {
    captureRewardfulViaFromSearch(location.search)
  }, [location.search])

  return null
}
