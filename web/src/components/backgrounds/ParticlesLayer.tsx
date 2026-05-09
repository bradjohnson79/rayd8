import type { LandingAmbientProfile } from '../../features/landing/landingAmbientProfile'

interface ParticlesLayerProps {
  ambientProfile: LandingAmbientProfile
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function ParticlesLayer({
  ambientProfile,
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
}: ParticlesLayerProps) {
  if (reducedEffects || ambientProfile !== 'cinematic') {
    return null
  }

  const box =
    variant === 'landing'
      ? 'absolute -inset-[3%] min-h-[106%] min-w-[106%] z-[2]'
      : 'absolute inset-0 z-[2]'

  return (
    <div
      className={`particles-layer pointer-events-none ${box}`}
      data-intensity={intensity}
      data-variant={variant}
    />
  )
}
