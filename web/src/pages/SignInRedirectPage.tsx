import { RedirectToSignIn } from '@clerk/react'
import { useLocation } from 'react-router-dom'

const ACCOUNT_PORTAL_SIGN_IN = 'https://accounts.rayd8.app/sign-in'

function accountPortalSignInHref(returnUrl: string) {
  return `${ACCOUNT_PORTAL_SIGN_IN}#/?redirect_url=${encodeURIComponent(returnUrl)}`
}

export function SignInRedirectPage() {
  const location = useLocation()
  const redirectPath = new URLSearchParams(location.search).get('redirect_url') || '/dashboard'
  const returnUrl =
    typeof window === 'undefined' ? redirectPath : new URL(redirectPath, window.location.origin).toString()
  const signInHref = accountPortalSignInHref(returnUrl)

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070c10] px-6 text-white">
      <div className="max-w-md rounded-3xl border border-white/10 bg-black/20 px-6 py-5 text-center text-sm leading-7 text-slate-300">
        <p>Taking you to sign in.</p>
        <a
          className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-slate-950"
          href={signInHref}
        >
          Continue to sign in
        </a>
      </div>
      <RedirectToSignIn redirectUrl={redirectPath} />
    </main>
  )
}
