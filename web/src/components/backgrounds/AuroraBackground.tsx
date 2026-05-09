import type { LandingAmbientProfile } from '../../features/landing/landingAmbientProfile'
import { useDocumentVisible } from '../../lib/useDocumentVisible'

interface AuroraBackgroundProps {
  ambientProfile: LandingAmbientProfile
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function AuroraBackground({
  ambientProfile,
  reducedEffects = false,
  variant = 'dashboard',
}: AuroraBackgroundProps) {
  const isVisible = useDocumentVisible()
  const allowAnim = !reducedEffects && isVisible
  const box =
    variant === 'landing'
      ? 'absolute -inset-[4%] min-h-[108%] min-w-[108%] z-[1]'
      : 'absolute inset-0 z-[1]'

  const primaryClass =
    ambientProfile === 'cinematic' && allowAnim
      ? 'ambient-animate-aurora-a-cinematic'
      : ambientProfile === 'balanced' && allowAnim
        ? 'ambient-animate-aurora-a-balanced'
        : ''

  const secondaryClass =
    ambientProfile === 'cinematic' && allowAnim ? 'ambient-animate-aurora-b-cinematic' : ''

  return (
    <>
      <div
        className={`aurora-layer pointer-events-none ${box} mix-blend-screen ${primaryClass}`.trim()}
      />
      <div
        className={`aurora-layer-secondary pointer-events-none ${box} mix-blend-screen ${secondaryClass}`.trim()}
      />
    </>
  )
}
