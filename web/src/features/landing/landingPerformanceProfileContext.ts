import { createContext } from 'react'
import type { LandingAmbientProfile } from './landingAmbientProfile'

export type LandingPerformanceProfileValue = {
  profile: LandingAmbientProfile
}

export const LandingPerformanceProfileContext = createContext<LandingPerformanceProfileValue>({
  profile: 'cinematic',
})
