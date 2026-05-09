import type { LandingAmbientProfile } from '../../features/landing/landingAmbientProfile'
import { useDocumentVisible } from '../../lib/useDocumentVisible'

interface CosmicLavaLayerProps {
  ambientProfile: LandingAmbientProfile
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function CosmicLavaLayer({
  ambientProfile,
  reducedEffects = false,
  variant = 'dashboard',
}: CosmicLavaLayerProps) {
  const isVisible = useDocumentVisible()

  if (reducedEffects) {
    return null
  }

  if (variant === 'landing' && ambientProfile === 'minimal') {
    return null
  }

  const allowMotion = ambientProfile === 'cinematic' && isVisible
  const box =
    variant === 'landing'
      ? 'absolute -inset-[4%] min-h-[108%] min-w-[108%] z-[1]'
      : 'absolute inset-0 z-[1]'

  const classA = allowMotion ? 'ambient-animate-cosmic-a-cinematic' : ''
  const classB = allowMotion ? 'ambient-animate-cosmic-b-cinematic' : ''

  return (
    <>
      <div className={`cosmic-lava-a pointer-events-none ${box} mix-blend-screen ${classA}`.trim()} />
      <div className={`cosmic-lava-b pointer-events-none ${box} mix-blend-screen ${classB}`.trim()} />
    </>
  )
}
