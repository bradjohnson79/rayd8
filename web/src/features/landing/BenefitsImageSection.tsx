const BENEFITS_IMAGE = '/images/RAYD8_benefits.png'

export function BenefitsImageSection() {
  return (
    <section aria-hidden className="mt-3 w-full sm:mt-4" id="benefits-visual">
      <div className="relative w-full overflow-hidden rounded-2xl shadow-[0_0_0_1px_rgba(16,185,129,0.1),0_0_50px_rgba(16,185,129,0.14),0_24px_50px_rgba(0,0,0,0.35)] sm:rounded-3xl">
        <div aria-hidden className="benefits-visual-rainbow-drum" />
        <div className="relative z-[1] m-[2.5px] overflow-hidden rounded-[13px] bg-[var(--rayd8-bg)] sm:m-[3px] sm:rounded-[21px]">
          <img
            alt=""
            className="block h-auto w-full"
            decoding="async"
            draggable={false}
            src={BENEFITS_IMAGE}
          />
        </div>
      </div>
    </section>
  )
}
