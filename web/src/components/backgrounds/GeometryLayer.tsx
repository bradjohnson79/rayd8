import { motion } from 'framer-motion'
import { useDocumentVisible } from '../../lib/useDocumentVisible'

interface GeometryLayerProps {
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function GeometryLayer({
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
}: GeometryLayerProps) {
  const isVisible = useDocumentVisible()
  const isPaused = reducedEffects || !isVisible
  const box = variant === 'landing' ? 'absolute -inset-[2%] min-h-[104%] min-w-[104%] z-[1]' : 'absolute inset-0 z-[1]'

  return (
    <motion.div
      animate={
        isPaused
          ? { opacity: intensity === 'low' ? 0.08 : 0.12 }
          : { x: ['-0.5%', '0.6%', '0%'], y: ['0%', '-0.4%', '0%'] }
      }
      className={`geometry-layer pointer-events-none ${box}`}
      data-intensity={intensity}
      data-variant={variant}
      transition={
        isPaused
          ? { duration: 0 }
          : { duration: variant === 'landing' ? 68 : 48, ease: 'easeInOut', repeat: Infinity }
      }
    />
  )
}
