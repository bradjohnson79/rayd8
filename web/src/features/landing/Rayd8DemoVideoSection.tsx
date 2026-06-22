import { Section } from './components/Section'
import {
  useLandingBackdropStrong,
  useLandingPromoShadow,
} from './landingBackdropHooks'

interface Rayd8DemoVideoSectionProps {
  reducedEffects?: boolean
}

const DEMO_VIDEO_EMBED_URL = 'https://www.youtube-nocookie.com/embed/qyMdBxMg7dQ'

export function Rayd8DemoVideoSection({
  reducedEffects = false,
}: Rayd8DemoVideoSectionProps) {
  const backdropStrong = useLandingBackdropStrong()
  const promoShadow = useLandingPromoShadow()

  return (
    <Section
      childrenClassName="max-w-7xl"
      className="py-12 sm:py-16"
      description="Watch a short walkthrough of the RAYD8 experience so you can see how the visual system, membership flow, and session environment work before you begin."
      eyebrow="RAYD8 Demonstration"
      id="rayd8-demonstration"
      reducedEffects={reducedEffects}
      title="See How RAYD8 Works"
    >
      <div
        className={`overflow-hidden rounded-[2rem] border border-cyan-100/18 bg-[linear-gradient(145deg,rgba(9,19,34,0.92),rgba(20,35,59,0.9)_48%,rgba(59,23,84,0.86))] p-4 sm:p-6 lg:p-8 ${promoShadow} ${backdropStrong}`}
      >
        <div className="overflow-hidden rounded-[1.5rem] border border-white/12 bg-black/35 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="aspect-video w-full">
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              src={DEMO_VIDEO_EMBED_URL}
              title="RAYD8 demonstration video"
            />
          </div>
        </div>
      </div>
    </Section>
  )
}
