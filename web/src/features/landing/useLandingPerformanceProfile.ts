import { useContext } from 'react'
import {
  LandingPerformanceProfileContext,
  type LandingPerformanceProfileValue,
} from './landingPerformanceProfileContext'

export function useLandingPerformanceProfile(): LandingPerformanceProfileValue {
  return useContext(LandingPerformanceProfileContext)
}
