interface ParticlesLayerProps {
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function ParticlesLayer({
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
}: ParticlesLayerProps) {
  if (reducedEffects) {
    return null
  }

  const box = variant === 'landing' ? 'absolute -inset-[3%] min-h-[106%] min-w-[106%] z-[2]' : 'absolute inset-0 z-[2]'

  return (
    <div
      className={`particles-layer pointer-events-none ${box}`}
      data-intensity={intensity}
      data-variant={variant}
    />
  )
}
