import { motion } from 'framer-motion'

interface AuroraBackgroundProps {
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function AuroraBackground({
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
}: AuroraBackgroundProps) {
  const primaryDuration = variant === 'landing' ? 46 : 30
  const secondaryDuration = variant === 'landing' ? 60 : 38
  const box = variant === 'landing' ? 'absolute -inset-[4%] min-h-[108%] min-w-[108%] z-[1]' : 'absolute inset-0 z-[1]'

  return (
    <>
      <motion.div
        animate={
          reducedEffects
            ? { opacity: intensity === 'low' ? 0.18 : 0.24 }
            : { x: ['-4.5%', '3.5%', '-2%'], y: ['0.5%', '3.5%', '0%'], scale: [1, 1.05, 1] }
        }
        className={`aurora-layer pointer-events-none ${box} mix-blend-screen`}
        transition={
          reducedEffects
            ? { duration: 0 }
            : { duration: primaryDuration, ease: [0.4, 0, 0.2, 1], repeat: Infinity }
        }
      />
      <motion.div
        animate={
          reducedEffects
            ? { opacity: intensity === 'low' ? 0.14 : 0.18 }
            : { x: ['2.5%', '-4%', '1%'], y: ['0%', '-3.5%', '0.5%'], scale: [1, 0.98, 1.04] }
        }
        className={`aurora-layer-secondary pointer-events-none ${box} mix-blend-screen`}
        transition={
          reducedEffects
            ? { duration: 0 }
            : { duration: secondaryDuration, ease: [0.4, 0, 0.2, 1], repeat: Infinity }
        }
      />
    </>
  )
}
