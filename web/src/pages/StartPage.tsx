import { Link } from 'react-router-dom'
import { Rayd8Background } from '../components/Rayd8Background'
import { ConversionButton } from '../features/landing/components/ConversionButton'

export function StartPage() {
  return (
    <Rayd8Background intensity="low" reducedEffects variant="landing">
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <Link className="inline-flex items-center" to="/">
            <img alt="RAYD8®" className="h-16 w-16" height={64} src="/rayd8-mark.png" width={64} />
          </Link>
          <Link className="text-sm text-white/70 transition hover:text-white" to="/">
            Main site
          </Link>
        </header>

        <main className="flex flex-1 items-center py-12">
          <section className="w-full rounded-[2rem] border border-white/12 bg-[rgba(7,12,16,0.72)] p-8 shadow-[0_18px_80px_rgba(0,0,0,0.24)] sm:p-10">
            <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/70">A calm daily ritual</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              A visual and sound experience for relaxation
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200">
              RAYD8® is a screen-based visual and sound experience you can return to as a calm daily ritual.
              No equipment to set up. Play it where you already are.
            </p>
            <ul className="mt-6 space-y-2 text-sm leading-7 text-slate-300">
              <li>A visual and sound experience</li>
              <li>Made for relaxation</li>
              <li>Works on any screen</li>
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ConversionButton guestMode="signUp" label="Start free trial" to="/subscription?plan=free" />
              <Link className="text-sm text-white/70 underline decoration-white/25 underline-offset-4" to="/subscription">
                View plans
              </Link>
            </div>
          </section>
        </main>
      </div>
    </Rayd8Background>
  )
}
