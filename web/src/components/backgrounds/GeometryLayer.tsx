import type { LandingAmbientProfile } from '../../features/landing/landingAmbientProfile'
import { useDocumentVisible } from '../../lib/useDocumentVisible'

interface GeometryLayerProps {
  ambientProfile: LandingAmbientProfile
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function GeometryLayer({
  ambientProfile,
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
}: GeometryLayerProps) {
  const isVisible = useDocumentVisible()
  const allowMotion = ambientProfile === 'cinematic' && !reducedEffects && isVisible
  const box =
    variant === 'landing'
      ? 'absolute -inset-[2%] min-h-[104%] min-w-[104%] z-[1]'
      : 'absolute inset-0 z-[1]'

  const motionClass = allowMotion ? 'ambient-animate-geometry-cinematic' : ''

  return (
    <div
      className={`geometry-layer pointer-events-none ${box} ${motionClass}`.trim()}
      data-intensity={intensity}
      data-variant={variant}
    />
  )
}
