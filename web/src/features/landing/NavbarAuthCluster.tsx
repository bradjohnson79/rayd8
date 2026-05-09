import { Show, SignInButton, UserButton } from '@clerk/react'
import { Link } from 'react-router-dom'
import { useAuthUser } from '../dashboard/useAuthUser'
import { ConversionButton } from './components/ConversionButton'

export default function NavbarAuthCluster() {
  const user = useAuthUser()

  return (
    <>
      {user.isAuthenticated ? (
        <>
          <ConversionButton
            className="hidden sm:inline-flex"
            guestMode="signIn"
            label="Go to Dashboard"
            to="/dashboard"
            variant="ghost"
          />
          <div className="rounded-full border border-white/12 bg-white/[0.06] p-1">
            <UserButton />
          </div>
        </>
      ) : (
        <>
          <div className="hidden items-center gap-2 sm:flex">
            <SignInButton mode="modal">
              <button
                className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
                type="button"
              >
                Sign in
              </button>
            </SignInButton>
            <Link
              className="rounded-full bg-white px-4 py-2 text-sm font-medium !text-slate-950 transition hover:bg-emerald-50 hover:!text-slate-950 visited:!text-slate-950"
              to="/subscription?plan=free"
            >
              Start Free Trial
            </Link>
          </div>
          <Show when="signed-in">
            <div className="rounded-full border border-white/12 bg-white/[0.06] p-1">
              <UserButton />
            </div>
          </Show>
        </>
      )}
    </>
  )
}
