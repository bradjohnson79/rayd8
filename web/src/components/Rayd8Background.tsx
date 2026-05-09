import type { PropsWithChildren } from 'react'
import type { LandingAmbientProfile } from '../features/landing/landingAmbientProfile'
import { BackgroundSystem } from './backgrounds/BackgroundSystem'

interface Rayd8BackgroundProps extends PropsWithChildren {
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
  ambientProfile?: LandingAmbientProfile | null
}

export function Rayd8Background({
  children,
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
  ambientProfile,
}: Rayd8BackgroundProps) {
  return (
    <BackgroundSystem
      intensity={intensity}
      reducedEffects={reducedEffects}
      variant={variant}
      ambientProfile={ambientProfile}
    >
      {children}
    </BackgroundSystem>
  )
}
