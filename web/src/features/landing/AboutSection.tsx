import { Section } from './components/Section'

const BRAD_IMAGE = '/images/Brad-RAYD8.png'

const introCopy =
  'RAYD8® is a visual technology created through intended transcendent states sampling actual living frequencies and imbuing them into digital animations. This metaphysical structure introduces a living visual and audio experience designed to encourage natural body & mind regeneration.'

interface AboutSectionProps {
  reducedEffects?: boolean
}

const versionCards = [
  {
    body: 'Entry-level immersion for immediate relief, grounding, and emotional reset.',
    title: 'Expansion',
  },
  {
    body: 'A richer visual field for deeper energetic immersion and stronger perceptual lift.',
    title: 'Premium',
  },
  {
    body: 'The full system for extended use, greater clarity, and a more powerful regenerative atmosphere.',
    title: 'REGEN',
  },
]

export function AboutSection({ reducedEffects = false }: AboutSectionProps) {
  return (
    <Section
      childrenClassName="flex w-full flex-col gap-10 lg:gap-12"
      eyebrow="About RAYD8®"
      id="about"
      reducedEffects={reducedEffects}
      showBackToTop
      title="Built from visual engineering and energetic design."
    >
      <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-start lg:gap-5 xl:gap-6">
        <div className="mx-auto w-full max-w-[min(22.5rem,90%)] shrink-0 sm:max-w-[25rem] lg:mx-0">
          <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-2.5 shadow-[0_20px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:rounded-2xl sm:p-3">
            <div className="relative flex aspect-[4/5] max-h-[min(26.5rem,64.5svh)] w-full items-center justify-center overflow-hidden rounded-[1.15rem] bg-[#080c12] sm:max-h-[min(29.75rem,70svh)]">
              <img
                alt="Brad with RAYD8® Premium on a tablet"
                className="h-full w-full object-contain object-top"
                decoding="async"
                loading="lazy"
                src={BRAD_IMAGE}
              />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 lg:gap-5">
          <p className="text-base leading-8 text-slate-300">{introCopy}</p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-2xl sm:rounded-3xl sm:p-7">
            <p className="text-base leading-8 text-slate-200">
              RAYD8® launched as a mobile app in April 2024, and has progressed further to become the
              world&apos;s first living digital technology that radiates a field of frequencies for
              natural body and mind recovery.
            </p>
            <p className="mt-4 text-base leading-8 text-slate-200">
              Created by Brad Johnson, an experienced metaphysical practitioner with nearly 2 decades
              of metaphysical research and healing practices, RAYD8® has been developed as a resonant
              technology devoid of heavy equipment setup, and simple implementation that can turn an
              environment into a subtle energy charging center for all living things.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {versionCards.map((card) => (
          <article
            className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-2xl"
            key={card.title}
          >
            <p className="text-[11px] uppercase tracking-[0.34em] text-white/58">{card.title}</p>
            <p className="mt-4 text-sm leading-7 text-slate-300">{card.body}</p>
          </article>
        ))}
      </div>
    </Section>
  )
}
