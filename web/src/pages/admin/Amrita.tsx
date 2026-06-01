const AMRITA_APP_URL = '/amrita_app/index.html'

export function AdminAmritaPage() {
  return (
    <section className="space-y-4">
      <div className="rounded-[2rem] border border-cyan-200/15 bg-white/[0.045] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
        <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/70">AMRITA App</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Control Panel Preview</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Local admin access to the AMRITA main menu, glyph configuration controls, and
          rejuvenation runtime.
        </p>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-black shadow-[0_28px_100px_rgba(0,0,0,0.34)]">
        <iframe
          allow="autoplay; fullscreen; clipboard-read; clipboard-write; screen-wake-lock"
          className="block h-[calc(100dvh-16rem)] min-h-[760px] w-full border-0 bg-[#02030a]"
          src={AMRITA_APP_URL}
          title="AMRITA app control panel"
        />
      </div>
    </section>
  )
}
