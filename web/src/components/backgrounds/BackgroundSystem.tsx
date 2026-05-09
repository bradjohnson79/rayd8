import type { PropsWithChildren } from 'react'
import type { LandingAmbientProfile } from '../../features/landing/landingAmbientProfile'
import { resolveAmbientProfile } from '../../features/landing/resolveAmbientProfile'
import { AuroraBackground } from './AuroraBackground'
import { CosmicLavaLayer } from './CosmicLavaLayer'
import { GeometryLayer } from './GeometryLayer'
import { LightBloom } from './LightBloom'
import { ParticlesLayer } from './ParticlesLayer'

interface BackgroundSystemProps extends PropsWithChildren {
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
  /** When omitted: balanced if reducedEffects, else cinematic (dashboard/legal defaults stay readable). */
  ambientProfile?: LandingAmbientProfile | null
}

export function BackgroundSystem({
  children,
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
  ambientProfile: ambientProfileProp,
}: BackgroundSystemProps) {
  const ambientProfile = resolveAmbientProfile(ambientProfileProp, reducedEffects)

  return (
    <div
      className="rayd8-bg relative min-h-screen overflow-hidden bg-[var(--rayd8-bg)] text-[var(--rayd8-text-primary)]"
      data-intensity={intensity}
      data-reduced-effects={reducedEffects ? 'true' : 'false'}
      data-variant={variant}
      data-ambient-profile={ambientProfile}
    >
      <LightBloom
        ambientProfile={ambientProfile}
        intensity={intensity}
        reducedEffects={reducedEffects}
        variant={variant}
      />
      <AuroraBackground ambientProfile={ambientProfile} reducedEffects={reducedEffects} variant={variant} />
      <CosmicLavaLayer
        ambientProfile={ambientProfile}
        reducedEffects={reducedEffects}
        variant={variant}
      />
      <GeometryLayer
        ambientProfile={ambientProfile}
        intensity={intensity}
        reducedEffects={reducedEffects}
        variant={variant}
      />
      <ParticlesLayer
        ambientProfile={ambientProfile}
        intensity={intensity}
        reducedEffects={reducedEffects}
        variant={variant}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
