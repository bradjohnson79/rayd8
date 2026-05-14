import { useUpgradeNavigation } from '../auth/useUpgradeNavigation'
import { immersiveDashboardOutletScrollClassName } from '../dashboard/immersiveDashboardOutlet'
import { useAuthUser } from '../dashboard/useAuthUser'

const HAMSA_PREP_IMAGE = '/hamsa/hamsa-prep.png'
const HAMSA_APP_URL = '/hamsa-app/'

const featureCallouts = [
  'Scalar & transcendental resonance technology',
  'Deep meditative and restorative environments',
  'Sacred geometry-inspired energetic systems',
  'Designed for calm, focus, stillness & coherence',
  'Exclusive to REGEN subscribers',
]

function HamsaArtwork() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_30px_120px_rgba(168,85,247,0.22)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(217,70,239,0.16),transparent_34%),radial-gradient(circle_at_18%_16%,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(132,204,22,0.14),transparent_28%)]" />
      <img
        alt="HAMSA virtual healing hand preview"
        className="relative z-10 aspect-[16/9] w-full object-cover"
        decoding="async"
        loading="eager"
        src={HAMSA_PREP_IMAGE}
      />
      <div className="pointer-events-none absolute inset-0 z-20 rounded-[2rem] ring-1 ring-inset ring-white/10" />
    </div>
  )
}

function FeatureCallouts() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {featureCallouts.map((feature) => (
        <div
          className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-slate-200 shadow-[0_14px_45px_rgba(0,0,0,0.16)] backdrop-blur-xl"
          key={feature}
        >
          {feature}
        </div>
      ))}
    </div>
  )
}

function HamsaLaunchScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-white">
      <header className="flex flex-col gap-3 border-b border-white/10 bg-black/50 px-4 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-200/80">HAMSA™</p>
          <h1 className="mt-2 text-lg font-semibold tracking-[0.12em] text-white">
            Virtual Healing Hand
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Included with active REGEN and AMRITA access. HAMSA runs independently from
            RAYD8 playback sessions, Mux streaming, and time-limit systems.
          </p>
        </div>
      </header>

      <iframe
        allow="autoplay; fullscreen; clipboard-read; clipboard-write; screen-wake-lock"
        className="block min-h-[42rem] w-full flex-1 border-0 bg-black"
        src={HAMSA_APP_URL}
        title="HAMSA virtual healing hand"
      />
    </div>
  )
}

function LockedInfoScreen() {
  const navigateToUpgrade = useUpgradeNavigation()

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] lg:items-center">
        <HamsaArtwork />

        <div className="rounded-[2rem] border border-white/10 bg-black/25 p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/80">Upcoming Feature</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[0.1em] text-white sm:text-5xl">
            HAMSA™
          </h1>
          <p className="mt-4 text-xl leading-8 text-fuchsia-100">
            A next-generation transcendental field experience.
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
            <p>
              HAMSA™ combines the same scalar and transcendental energetic principles
              found throughout the RAYD8® ecosystem, but applies them through an
              advanced interactive field environment designed for deeper immersion,
              stillness, and internal coherence.
            </p>
            <p>
              Through sacred geometry-inspired interfaces, dynamic resonance systems,
              and guided energetic harmonics, HAMSA™ is designed to support profound
              states of calm, focus, meditation, regeneration, and expanded awareness.
            </p>
            <p>
              Built upon the same foundational field architecture as Expansion,
              Premium, and REGEN, HAMSA™ represents the next evolution of the RAYD8®
              experience.
            </p>
          </div>
        </div>
      </section>

      <FeatureCallouts />

      <section className="rounded-[2rem] border border-emerald-200/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(168,85,247,0.14))] p-6 text-white shadow-[0_24px_80px_rgba(16,185,129,0.12)] backdrop-blur-2xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-[0.08em]">Unlock HAMSA™</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
              Upgrade to REGEN to access the next evolution of the RAYD8® experience.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-[0_18px_55px_rgba(16,185,129,0.22)] transition-colors hover:bg-emerald-200"
            onClick={() => void navigateToUpgrade()}
            type="button"
          >
            Upgrade to REGEN
          </button>
        </div>
      </section>
    </div>
  )
}

export function HamsaRoutePage() {
  const user = useAuthUser()

  const hasHamsaAccess = user.plan === 'regen' || user.plan === 'amrita'

  return (
    <div className={immersiveDashboardOutletScrollClassName}>
      <div className="relative isolate min-h-[100dvh] bg-[#020403] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_15%,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_72%_18%,rgba(217,70,239,0.18),transparent_30%),radial-gradient(circle_at_48%_72%,rgba(132,204,22,0.1),transparent_36%),linear-gradient(180deg,#020403_0%,#070a12_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />
        <div className="relative z-10">
          {hasHamsaAccess ? <HamsaLaunchScreen /> : <LockedInfoScreen />}
        </div>
      </div>
    </div>
  )
}
