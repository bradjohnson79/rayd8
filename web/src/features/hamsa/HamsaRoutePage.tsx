import { useState } from 'react'

import { useUpgradeNavigation } from '../auth/useUpgradeNavigation'
import { immersiveDashboardOutletScrollClassName } from '../dashboard/immersiveDashboardOutlet'
import { useAuthUser } from '../dashboard/useAuthUser'
import {
  detectHamsaAppUrl,
  HAMSA_PREP_IMAGE,
  hamsaFeatureCallouts,
  hamsaPreviewCopy,
} from './hamsaContent'
import { ImmersiveViewport } from '../rayd8-player/ImmersiveViewport'

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
      {hamsaFeatureCallouts.map((feature) => (
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

export function HamsaLaunchScreen() {
  const [hamsaSrc] = useState(detectHamsaAppUrl)

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <header className="shrink-0 border-b border-white/10 bg-black/50 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-200/80">HAMSA™</p>
          <h1 className="mt-2 text-lg font-semibold tracking-[0.12em] text-white">
            Virtual Healing Hand
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Included with active REGEN access. HAMSA runs independently from RAYD8
            playback sessions, Mux streaming, and time-limit systems.
          </p>
        </div>
      </header>

      <main
        className="relative min-h-0 flex-1 overflow-hidden bg-black"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
        }}
      >
        <ImmersiveViewport surface="fill">
          <iframe
            allow="autoplay; fullscreen; clipboard-read; clipboard-write; screen-wake-lock"
            className="block h-full w-full border-0 bg-black"
            src={hamsaSrc}
            title="HAMSA virtual healing hand"
          />
        </ImmersiveViewport>
      </main>
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
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/80">
            Available for REGEN Subscribers
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[0.1em] text-white sm:text-5xl">
            {hamsaPreviewCopy.title}
          </h1>
          <p className="mt-4 text-xl leading-8 text-fuchsia-100">
            {hamsaPreviewCopy.subtitle}
          </p>
          <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
            <p>
              {hamsaPreviewCopy.body}
            </p>
            <p>
              Built upon the same foundational scalar and transcendental principles found
              throughout the RAYD8 ecosystem, HAMSA introduces a unique hand-centered visual
              environment designed to complement mindful rest, presence, and intentional
              sessions.
            </p>
            <p>
              {hamsaPreviewCopy.detail}
            </p>
            <p>
              Whether used for quiet reflection, meditation, energetic restoration, or deep
              relaxation, HAMSA™ offers a simple yet immersive way to experience RAYD8 in a
              new format.
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
            Experience HAMSA™
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
