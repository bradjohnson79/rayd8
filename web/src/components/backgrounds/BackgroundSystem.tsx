import type { PropsWithChildren } from 'react'
import { AuroraBackground } from './AuroraBackground'
import { CosmicLavaLayer } from './CosmicLavaLayer'
import { GeometryLayer } from './GeometryLayer'
import { LightBloom } from './LightBloom'
import { ParticlesLayer } from './ParticlesLayer'

interface BackgroundSystemProps extends PropsWithChildren {
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function BackgroundSystem({
  children,
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
}: BackgroundSystemProps) {
  return (
    <div
      className="rayd8-bg relative min-h-screen overflow-hidden bg-[var(--rayd8-bg)] text-[var(--rayd8-text-primary)]"
      data-intensity={intensity}
      data-reduced-effects={reducedEffects ? 'true' : 'false'}
      data-variant={variant}
    >
      <LightBloom intensity={intensity} reducedEffects={reducedEffects} variant={variant} />
      <AuroraBackground intensity={intensity} reducedEffects={reducedEffects} variant={variant} />
      <CosmicLavaLayer reducedEffects={reducedEffects} variant={variant} />
      <GeometryLayer intensity={intensity} reducedEffects={reducedEffects} variant={variant} />
      <ParticlesLayer intensity={intensity} reducedEffects={reducedEffects} variant={variant} />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
