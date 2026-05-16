import { useUpgradeNavigation } from '../auth/useUpgradeNavigation'
import { immersiveDashboardOutletScrollClassName } from '../dashboard/immersiveDashboardOutlet'
import { useAuthUser } from '../dashboard/useAuthUser'

const AMRITA_APP_URL = '/amrita_app/index.html'

function AmritaLaunchScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-black text-white">
      <header className="flex flex-col gap-3 border-b border-white/10 bg-black/50 px-4 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">AMRITA</p>
          <h1 className="mt-2 text-lg font-semibold tracking-[0.12em] text-white">
            Living Full-Spectrum Harmonic Field
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            Configure glyph systems, focus of charge, rate of charge, wellness filters, and
            sequence timing before entering the AMRITA runtime.
          </p>
        </div>
      </header>

      <iframe
        allow="autoplay; fullscreen; clipboard-read; clipboard-write; screen-wake-lock"
        className="block min-h-[42rem] w-full flex-1 border-0 bg-black"
        src={AMRITA_APP_URL}
        title="AMRITA procedural rejuvenation environment"
      />
    </div>
  )
}

function LockedInfoScreen() {
  const navigateToUpgrade = useUpgradeNavigation()

  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_22%_20%,rgba(125,249,255,0.18),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(216,180,254,0.16),transparent_30%),linear-gradient(135deg,rgba(8,13,28,0.94),rgba(4,7,16,0.98))] p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">AMRITA</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[0.08em] text-white sm:text-5xl">
          Premium Rejuvenation Environment
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          AMRITA is a procedural GUI-based flowing rejuvenation environment built around
          full-spectrum harmonic backgrounds, white-outline glyph sequencing, and
          configurable session intent.
        </p>
        <button
          className="mt-8 inline-flex items-center justify-center rounded-full bg-cyan-200 px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-[0_18px_55px_rgba(125,249,255,0.22)] transition-colors hover:bg-cyan-100"
          onClick={() => void navigateToUpgrade()}
          type="button"
        >
          Upgrade Access
        </button>
      </section>
    </div>
  )
}

export function AmritaRoutePage() {
  const user = useAuthUser()
  const hasAmritaAccess = user.plan === 'amrita' || user.role === 'admin'

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
