import type { PropsWithChildren } from 'react'
import { BackgroundSystem } from './backgrounds/BackgroundSystem'

interface Rayd8BackgroundProps extends PropsWithChildren {
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function Rayd8Background({
  children,
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
}: Rayd8BackgroundProps) {
  return (
    <BackgroundSystem intensity={intensity} reducedEffects={reducedEffects} variant={variant}>
      {children}
    </BackgroundSystem>
  )
}
