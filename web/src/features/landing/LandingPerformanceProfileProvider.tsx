import type { ReactNode } from 'react'
import type { LandingAmbientProfile } from './landingAmbientProfile'
import { LandingPerformanceProfileContext } from './landingPerformanceProfileContext'

export function LandingPerformanceProfileProvider({
  profile,
  children,
}: {
  profile: LandingAmbientProfile
  children: ReactNode
}) {
  return (
    <LandingPerformanceProfileContext.Provider value={{ profile }}>
      {children}
    </LandingPerformanceProfileContext.Provider>
  )
}
