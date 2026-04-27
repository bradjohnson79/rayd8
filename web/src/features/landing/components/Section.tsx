import { motion } from 'framer-motion'
import type { PropsWithChildren, ReactNode } from 'react'

interface SectionProps extends PropsWithChildren {
  childrenClassName?: string
  className?: string
  description?: ReactNode
  eyebrow?: string
  eyebrowClassName?: string
  id?: string
  reducedEffects?: boolean
  title?: ReactNode
}

export function Section({
  children,
  childrenClassName = '',
  className = '',
  description,
  eyebrow,
  eyebrowClassName,
  id,
  reducedEffects = false,
  title,
}: SectionProps) {
  return (
    <motion.section
      className={`relative px-4 py-18 sm:px-6 lg:px-8 ${className}`.trim()}
      id={id}
      initial={reducedEffects ? false : { opacity: 0, y: 36 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      viewport={{ amount: 0.2, once: true }}
      whileInView={reducedEffects ? undefined : { opacity: 1, y: 0 }}
    >
      <div className={`mx-auto max-w-7xl ${childrenClassName}`.trim()}>
        {eyebrow || title || description ? (
          <div className="mb-10 max-w-3xl">
            {eyebrow ? (
              <p
                className={
                  eyebrowClassName?.trim() ||
                  'text-[11px] uppercase tracking-[0.38em] text-emerald-200/70'
                }
              >
                {eyebrow}
              </p>
            ) : null}
            {title ? <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h2> : null}
            {description ? (
              <p className="mt-4 text-base leading-8 text-slate-300">{description}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </motion.section>
  )
}
