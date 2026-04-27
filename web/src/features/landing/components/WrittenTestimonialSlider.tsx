import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'

interface WrittenTestimonial {
  context?: string
  name: string
  quote: string
}

interface WrittenTestimonialSliderProps {
  reducedEffects?: boolean
  testimonials: readonly WrittenTestimonial[]
}

export function WrittenTestimonialSlider({
  reducedEffects = false,
  testimonials,
}: WrittenTestimonialSliderProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const active = useMemo(() => testimonials[activeIndex], [activeIndex, testimonials])

  if (!active) {
    return null
  }

  const goPrevious = () => {
    setActiveIndex((current) => (current === 0 ? testimonials.length - 1 : current - 1))
  }

  const goNext = () => {
    setActiveIndex((current) => (current === testimonials.length - 1 ? 0 : current + 1))
  }

  return (
    <article className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:rounded-[2.25rem] sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.36em] text-emerald-200/70">Written stories</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="Previous written testimonial"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/82 transition hover:border-white/20 hover:bg-white/[0.08]"
            onClick={goPrevious}
            type="button"
          >
            <span aria-hidden>‹</span>
          </button>
          <button
            aria-label="Next written testimonial"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-lg text-white/82 transition hover:border-white/20 hover:bg-white/[0.08]"
            onClick={goNext}
            type="button"
          >
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>

      <div className="mt-8 min-h-[12rem]">
        <AnimatePresence mode="wait">
          <motion.div
            animate={reducedEffects ? undefined : { opacity: 1, x: 0 }}
            className="h-full"
            exit={reducedEffects ? undefined : { opacity: 0, x: -18 }}
            initial={reducedEffects ? false : { opacity: 0, x: 18 }}
            key={`${active.name}-${activeIndex}`}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            {active.context ? (
              <p className="text-[11px] uppercase tracking-[0.32em] text-white/56">{active.context}</p>
            ) : null}
            <div className="mt-4 max-h-[min(55vh,26rem)] overflow-y-auto pr-0.5 [scrollbar-gutter:stable] sm:max-h-[min(60vh,30rem)]">
              <blockquote className="text-base font-medium leading-[1.65] tracking-tight text-white/95 sm:text-lg sm:leading-[1.7]">
                “{active.quote}”
              </blockquote>
            </div>
            <p className="mt-6 text-sm uppercase tracking-[0.28em] text-emerald-100/70">{active.name}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {testimonials.map((_, index) => {
          const isActive = index === activeIndex
          return (
            <button
              aria-label={`Show written testimonial ${index + 1}`}
              aria-pressed={isActive}
              className={[
                'h-2.5 rounded-full transition-all duration-300',
                isActive ? 'w-8 bg-emerald-300/90' : 'w-2.5 bg-white/24 hover:bg-white/38',
              ].join(' ')}
              key={`written-${index}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            />
          )
        })}
      </div>
    </article>
  )
}
