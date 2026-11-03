import { Link } from 'react-router-dom'
import { Rayd8Background } from '../components/Rayd8Background'

export function NotFoundPage() {
  return (
    <Rayd8Background intensity="low" reducedEffects variant="landing">
      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl items-center px-4 py-16">
        <div className="w-full rounded-[2rem] border border-white/12 bg-[rgba(7,12,16,0.72)] p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/70">404</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">This page does not exist.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            The address is not part of RAYD8. Head back to the main page, or sign in from the login page.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link className="text-sm text-emerald-100 underline decoration-emerald-200/40 underline-offset-4" to="/">
              Back to RAYD8
            </Link>
            <Link className="text-sm text-white/75 underline decoration-white/25 underline-offset-4" to="/login">
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </Rayd8Background>
  )
}
