const sections = [
  {
    body: 'When experiencing the RAYD8 technology, let yourself move into a relaxed state of being. Deep cleansing breaths where the exhale is longer than the inhale is highly beneficial to keep your body calm and relaxed. You may also want to try a muscle relaxation exercise where you start from the feet relaxing the muscles letting them feel limp as you work your way to the top of the head.',
    label: 'Getting Started',
    title: null,
  },
  {
    body: "While experiencing RAYD8, it's also recommended to have water with you and to hydrate. Hydration helps irrigate cellular debris and flush it from the body. This is highly recommended as your cells are entering a state of constant millivolt charge while any of the versions of RAYD8 are running.",
    label: 'Hydration',
    title: null,
  },
  {
    body: 'This is our lightest version of the RAYD8 technology. It works with scalar waves and also grounds the charging field into your body working together with the Schumann resonance (7.83 hz). The white horizontal bar on screen contains frequencies for high states of cellular charge through the white color vibration (beneficial for lungs and respiratory system). It also aids in subtle body rejuvenation and improving white blood cell integrity.',
    label: 'Expansion',
    title: 'RAYD8 Expansion',
  },
  {
    body: 'This version works with all major organs, blood circulation and systems within the physical body delivering natural organic frequencies through a scalar-charged field. It also helps to strengthen telomere growth, calibrate chakra centers, meridians and subtle energy body fields. The 15-color bar array works with all color vibratory patterns organized throughout the body to enhance vitality and clear stagnant blockages through physical and energetic systems.',
    label: 'Premium',
    title: 'RAYD8 Premium',
  },
  {
    body: 'Our most thorough version of RAYD8. It contains all capabilities of Premium, and also works for thorough charging of areas in the body susceptible to inflammation, viral, bacterial, and fungal presence or infection. REGEN also works with the living frequencies of the Solfeggio frequencies to heighten deeper states of awareness, and works with the crown center of the body to stimulate deeper brainwave activity. REGEN utilizes benefic frequencies of astrological alignments to help nourish your physical body and the surrounding environment. It holds a greater amplification to rejuvenating the body on a deeper level and provides negative ion charge to improve your environment as if it were a living field for a lush rainforest.',
    label: 'REGEN',
    title: 'RAYD8 REGEN',
  },
] as const

export function InstructionsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-6 py-20 text-white sm:px-8 lg:px-10">
        <header>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Guidance</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Instructions
          </h1>
        </header>

        <div className="mt-10 space-y-10">
          {sections.map((section, index) => (
            <section key={section.label}>
              {index > 0 ? <div className="border-t border-white/10 my-10" /> : null}
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">{section.label}</p>
              {section.title ? (
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">
                  {section.title}
                </h2>
              ) : null}
              <p className="mt-4 text-base leading-relaxed text-white/78 sm:text-[1.05rem]">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
