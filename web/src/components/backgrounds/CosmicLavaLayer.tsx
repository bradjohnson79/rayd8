import { motion } from 'framer-motion'

interface CosmicLavaLayerProps {
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function CosmicLavaLayer({ reducedEffects = false, variant = 'dashboard' }: CosmicLavaLayerProps) {
  if (reducedEffects) {
    return null
  }

  const t = variant === 'landing' ? 58 : 44
  const box = variant === 'landing' ? 'absolute -inset-[4%] min-h-[108%] min-w-[108%] z-[1]' : 'absolute inset-0 z-[1]'

  return (
    <>
      <motion.div
        animate={{ x: ['-5%', '2%', '4%', '-1%'], y: ['1%', '-1.5%', '-2%', '0.5%'], scale: [1, 1.04, 0.98, 1] }}
        className={`cosmic-lava-a pointer-events-none ${box} mix-blend-screen`}
        transition={{ duration: t, ease: [0.4, 0, 0.2, 1], repeat: Infinity }}
      />
      <motion.div
        animate={{ x: ['1%', '-4%', '0%', '2%'], y: ['-1%', '2.5%', '-0.5%', '0%'], scale: [1, 0.98, 1.03, 1] }}
        className={`cosmic-lava-b pointer-events-none ${box} mix-blend-screen`}
        transition={{ duration: t * 1.15, ease: [0.4, 0, 0.2, 1], repeat: Infinity }}
      />
    </>
  )
}
