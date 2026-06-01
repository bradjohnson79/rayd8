import { useEffect, useRef, useState } from 'react'

import { trackUmamiEvent } from '../../services/umami'
import { useUpgradeNavigation } from '../auth/useUpgradeNavigation'
import { immersiveDashboardOutletScrollClassName } from '../dashboard/immersiveDashboardOutlet'
import { useAuthUser } from '../dashboard/useAuthUser'
import { ImmersiveViewport } from '../rayd8-player/ImmersiveViewport'
import {
  AMRITA_CARD_IMAGE,
  amritaDescription,
  amritaTierFeatures,
  regenTierFeatures,
} from './amritaContent'

const AMRITA_APP_URL = '/amrita_app/index.html'

function AmritaLaunchScreen() {
  const [amritaSrc] = useState(AMRITA_APP_URL)
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) {
      return
    }

    trackedRef.current = true
    trackUmamiEvent('amrita_main_menu_opened', {
      location: 'amrita_route',
    })
  }, [])

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <header className="shrink-0 border-b border-white/10 bg-black/55 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">RAYD8 AMRITA</p>
            <h1 className="mt-2 text-lg font-semibold tracking-[0.12em] text-white">
              Living Full-Spectrum Harmonic Field
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
              Included with active AMRITA membership. AMRITA runs independently from RAYD8
              playback sessions, Mux streaming, and time-limit systems.
            </p>
          </div>
          <a
            className="inline-flex items-center justify-center rounded-full border border-cyan-100/20 bg-cyan-100/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50 transition hover:bg-cyan-100/16"
            href="/amrita-dashboard"
          >
            ← Back To Dashboard
          </a>
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
            className="block h-full w-full border-0 bg-[#02030a]"
            src={amritaSrc}
            title="RAYD8 Amrita main menu"
          />
        </ImmersiveViewport>
      </main>
    </div>
  )
}

function FeatureList({ items, tone }: { items: readonly string[]; tone: 'amrita' | 'regen' }) {
  return (
    <ul className="mt-4 grid gap-2.5 text-sm leading-6 text-slate-200">
      {items.map((item) => (
        <li className="flex items-center gap-3" key={item}>
          <span
            aria-hidden
            className={[
              'h-1.5 w-1.5 shrink-0 rounded-full',
              tone === 'amrita' ? 'bg-cyan-300/70' : 'bg-emerald-300/70',
            ].join(' ')}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function LockedInfoScreen() {
  const navigateToUpgrade = useUpgradeNavigation()

  function startAmritaUpgrade() {
    trackUmamiEvent('amrita_upgrade_clicked', {
      location: 'locked_amrita_route',
    })
    void navigateToUpgrade({ targetPath: '/subscription?plan=amrita' })
  }

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.86fr)] lg:items-center">
        <div className="overflow-hidden rounded-[2rem] border border-cyan-100/15 bg-black shadow-[0_30px_120px_rgba(8,145,178,0.2)]">
          <img
            alt="RAYD8 Amrita main menu preview"
            className="aspect-[16/9] w-full object-cover"
            decoding="async"
            loading="eager"
            src={AMRITA_CARD_IMAGE}
          />
        </div>

        <div className="rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_22%_20%,rgba(125,249,255,0.18),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(216,180,254,0.16),transparent_30%),linear-gradient(135deg,rgba(8,13,28,0.94),rgba(4,7,16,0.98))] p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-8">
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">
            Highest RAYD8 Membership
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[0.08em] text-white sm:text-5xl">
            RAYD8 Amrita
          </h1>
          <p className="mt-5 text-sm leading-7 text-slate-300">{amritaDescription}</p>
          <button
            className="mt-8 inline-flex items-center justify-center rounded-full bg-cyan-200 px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-[0_18px_55px_rgba(103,232,249,0.22)] transition hover:bg-cyan-100"
            onClick={startAmritaUpgrade}
            type="button"
          >
            Start Amrita Membership
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[1.8rem] border border-emerald-200/14 bg-white/[0.04] p-5 text-white backdrop-blur-xl sm:p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-100/70">REGEN</p>
          <h2 className="mt-3 text-2xl font-semibold">250 Hours + HAMSA Access</h2>
          <FeatureList items={regenTierFeatures} tone="regen" />
        </article>
        <article className="rounded-[1.8rem] border border-cyan-100/24 bg-cyan-100/[0.06] p-5 text-white shadow-[0_18px_60px_rgba(8,145,178,0.14)] backdrop-blur-xl sm:p-6">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/75">AMRITA</p>
          <h2 className="mt-3 text-2xl font-semibold">500 Hours + Full Ecosystem Access</h2>
          <FeatureList items={amritaTierFeatures} tone="amrita" />
        </article>
      </section>
    </div>
  )
}

export function AmritaRoutePage() {
  const user = useAuthUser()
  const hasAmritaAccess = user.plan === 'amrita'

  return (
    <div className={immersiveDashboardOutletScrollClassName}>
      <div className="relative isolate min-h-[100dvh] bg-[#02030a] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_15%,rgba(125,249,255,0.16),transparent_28%),radial-gradient(circle_at_72%_18%,rgba(216,180,254,0.18),transparent_30%),radial-gradient(circle_at_48%_72%,rgba(253,230,138,0.1),transparent_36%),linear-gradient(180deg,#02030a_0%,#070a12_100%)]"
        />
        <div className="relative z-10">
          {hasAmritaAccess ? <AmritaLaunchScreen /> : <LockedInfoScreen />}
        </div>
      </div>
    </div>
  )
}
