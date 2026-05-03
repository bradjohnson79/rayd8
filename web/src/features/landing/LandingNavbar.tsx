import { memo } from 'react'
import { Show, SignInButton, UserButton, useClerk } from '@clerk/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MobileMenu } from '../../components/MobileMenu'
import { useAuthUser } from '../dashboard/useAuthUser'
import { ConversionButton } from './components/ConversionButton'

const navigationItems = [
  { href: '/#teaser', label: 'Use RAYD8® Now' },
  { href: '#about', label: 'About RAYD8®' },
  { href: '#testimonials', label: 'Testimonials' },
  { href: '/#contact-form', label: 'Contact' },
]

const mobileNavigationItems = [
  { href: '#hero', label: 'Home' },
  { href: '#about', label: 'About' },
  { href: '#testimonials', label: 'Testimonials' },
  { href: '/#contact-form', label: 'Contact' },
]

export const LandingNavbar = memo(function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { openSignIn, openSignUp } = useClerk()
  const user = useAuthUser()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[rgba(6,10,14,0.94)] shadow-[0_16px_44px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div
          className={[
            'mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border px-5 py-3 transition-all duration-300',
            scrolled
              ? 'border-white/12 bg-[rgba(8,14,20,0.92)] shadow-[0_18px_50px_rgba(0,0,0,0.22)]'
              : 'border-white/10 bg-[rgba(8,14,20,0.88)] shadow-[0_12px_36px_rgba(0,0,0,0.16)]',
          ].join(' ')}
        >
          <Link
            className="group flex shrink-0 items-center transition hover:opacity-95"
            title="RAYD8® Amrita"
            to="/"
          >
            <img
              alt="RAYD8®"
              className="h-[84px] w-[84px] sm:h-24 sm:w-24"
              decoding="async"
              draggable={false}
              height={96}
              src="/rayd8-mark.png"
              width={96}
            />
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {navigationItems.map((item) => (
              <a
                className="group relative text-sm text-white/72 transition hover:text-white"
                href={item.href}
                key={item.href}
              >
                {item.label}
                <span className="absolute inset-x-0 -bottom-2 h-px origin-left scale-x-0 bg-[linear-gradient(90deg,rgba(16,185,129,0.88),rgba(59,130,246,0.88))] transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              aria-expanded={mobileMenuOpen}
              aria-label="Open navigation menu"
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/82 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition hover:border-emerald-200/35 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_28px_rgba(16,185,129,0.22)] lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              type="button"
            >
              <span aria-hidden className="flex flex-col gap-1.5">
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
                <span className="block h-0.5 w-5 rounded-full bg-current" />
              </span>
            </button>
            {user.isAuthenticated ? (
              <>
                <ConversionButton
                  className="hidden sm:inline-flex"
                  guestMode="signIn"
                  label="Go to Dashboard"
                  to="/dashboard"
                  variant="ghost"
                />
                <div className="rounded-full border border-white/12 bg-white/[0.06] p-1 backdrop-blur-xl">
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
                  <div className="rounded-full border border-white/12 bg-white/[0.06] p-1 backdrop-blur-xl">
                    <UserButton />
                  </div>
                </Show>
              </>
            )}
          </div>
        </div>
      </div>
      <MobileMenu
        isAuthenticated={user.isAuthenticated}
        items={mobileNavigationItems}
        onClose={() => setMobileMenuOpen(false)}
        onSignIn={() => void openSignIn()}
        onSignUp={() => void openSignUp()}
        open={mobileMenuOpen}
      />
    </header>
  )
})
