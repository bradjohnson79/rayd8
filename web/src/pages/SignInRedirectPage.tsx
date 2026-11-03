import { RedirectToSignIn } from '@clerk/react'
import { useLocation } from 'react-router-dom'

export function SignInRedirectPage() {
  const location = useLocation()
  const redirectUrl = new URLSearchParams(location.search).get('redirect_url') || '/dashboard'

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070c10] px-6 text-white">
      <div className="max-w-md rounded-3xl border border-white/10 bg-black/20 px-6 py-5 text-center text-sm text-slate-300">
        <p>Taking you to sign in.</p>
      </div>
      <RedirectToSignIn redirectUrl={redirectUrl} />
    </main>
  )
}
