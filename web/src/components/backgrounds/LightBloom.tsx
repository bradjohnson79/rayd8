import { motion } from 'framer-motion'
import { useDocumentVisible } from '../../lib/useDocumentVisible'

interface LightBloomProps {
  intensity?: 'default' | 'low'
  reducedEffects?: boolean
  variant?: 'dashboard' | 'landing'
}

export function LightBloom({
  intensity = 'default',
  reducedEffects = false,
  variant = 'dashboard',
}: LightBloomProps) {
  const isVisible = useDocumentVisible()
  const isPaused = reducedEffects || !isVisible
  const bloomOpacity = reducedEffects ? 'opacity-50' : intensity === 'low' ? 'opacity-80' : 'opacity-100'
  const blurSize = variant === 'landing' ? 'blur-[170px]' : 'blur-[200px]'
  const d = variant === 'landing' ? 84 : 72
  const box = variant === 'landing' ? 'absolute -inset-[3%] min-h-[106%] min-w-[106%] z-0' : 'absolute inset-0 z-0'

  return (
    <motion.div
      animate={isPaused ? undefined : { x: [0, '0.4%', 0], y: [0, '-0.2%', 0] }}
      className={`light-bloom-wrap pointer-events-none overflow-hidden ${box} ${bloomOpacity}`}
      transition={isPaused ? { duration: 0 } : { duration: d, ease: 'easeInOut', repeat: Infinity }}
    >
      <div className={`absolute left-[-12%] top-[6%] h-[44rem] w-[44rem] rounded-full bg-emerald-400/18 ${blurSize}`} />
      <div className={`absolute left-[22%] top-[-16%] h-[40rem] w-[40rem] rounded-full bg-violet-500/24 ${blurSize}`} />
      <div className={`absolute bottom-[-10%] right-[-4%] h-[38rem] w-[38rem] rounded-full bg-blue-500/20 ${blurSize}`} />
      <div className="absolute right-[20%] top-[52%] h-[26rem] w-[26rem] rounded-full bg-amber-300/10 blur-[150px]" />
    </motion.div>
  )
}
