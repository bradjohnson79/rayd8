import { immersiveDashboardOutletScrollClassName } from '../dashboard/immersiveDashboardOutlet'

function AmritaComingSoonScreen() {
  return (
    <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_22%_20%,rgba(125,249,255,0.18),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(216,180,254,0.16),transparent_30%),linear-gradient(135deg,rgba(8,13,28,0.94),rgba(4,7,16,0.98))] p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">AMRITA</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[0.08em] text-white sm:text-5xl">
          Coming Soon
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
          AMRITA is a procedural GUI-based flowing rejuvenation environment built around
          full-spectrum harmonic backgrounds, white-outline glyph sequencing, and
          configurable session intent. It is currently in private development and is not
          available on live member accounts.
        </p>
        <div className="mt-8 inline-flex items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">
          In Development
        </div>
      </section>
    </div>
  )
}

export function AmritaRoutePage() {
  return (
    <div className={immersiveDashboardOutletScrollClassName}>
      <div className="relative isolate min-h-[100dvh] bg-[#02030a] text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_18%_15%,rgba(125,249,255,0.16),transparent_28%),radial-gradient(circle_at_72%_18%,rgba(216,180,254,0.18),transparent_30%),radial-gradient(circle_at_48%_72%,rgba(253,230,138,0.1),transparent_36%),linear-gradient(180deg,#02030a_0%,#070a12_100%)]"
        />
        <div className="relative z-10">
          <AmritaComingSoonScreen />
        </div>
      </div>
    </div>
  )
}
