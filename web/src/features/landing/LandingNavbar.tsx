import { lazy, memo, Suspense, useEffect, useState } from 'react'
import { useClerk } from '@clerk/react'
import { Link } from 'react-router-dom'
import { MobileMenu } from '../../components/MobileMenu'
import { useAuthUser } from '../dashboard/useAuthUser'

const NavbarAuthCluster = lazy(() => import('./NavbarAuthCluster'))

/** Same order and labels for desktop nav and mobile drawer. */
const navigationItems = [
  { href: '/#teaser', label: 'Use RAYD8® Now' },
  { href: '/#affiliate-program', label: 'Affiliate Program' },
  { href: '#about', label: 'About RAYD8®' },
  { href: '#testimonials', label: 'Testimonials' },
  { href: '/#contact-form', label: 'Contact' },
]

function AuthClusterFallback() {
  return (
    <div
      aria-hidden
      className="flex min-h-11 min-w-[10rem] items-center justify-end gap-2 sm:min-w-[14rem]"
    >
      <div className="hidden h-10 flex-1 max-w-[13rem] animate-pulse rounded-full bg-white/[0.06] sm:block" />
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-white/[0.06] sm:hidden" />
    </div>
  )
}

export const LandingNavbar = memo(function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mountAuthCluster, setMountAuthCluster] = useState(false)
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

  useEffect(() => {
    const kick = () => setMountAuthCluster(true)
    const w = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (handle: number) => void
    }

    let idleHandle: number | undefined
    let timeoutHandle: number | undefined

    if (w.requestIdleCallback) {
      idleHandle = w.requestIdleCallback(kick, { timeout: 2800 })
    } else {
      timeoutHandle = window.setTimeout(kick, 1500)
    }

    const onEarlyInteraction = () => kick()
    window.addEventListener('pointerdown', onEarlyInteraction, { capture: true, passive: true })
    window.addEventListener('scroll', onEarlyInteraction, { capture: true, passive: true })

    return () => {
      if (idleHandle !== undefined && w.cancelIdleCallback) {
        w.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== undefined) {
        window.clearTimeout(timeoutHandle)
      }
      window.removeEventListener('pointerdown', onEarlyInteraction, true)
      window.removeEventListener('scroll', onEarlyInteraction, true)
    }
  }, [])

  return (
    <header
      className={[
        'relative z-40 w-full shrink-0 border-b border-white/10 bg-[#06080c]',
        scrolled ? 'shadow-[0_12px_32px_rgba(0,0,0,0.45)]' : '',
      ].join(' ')}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-8">
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
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/82 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition hover:border-emerald-200/35 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_28px_rgba(16,185,129,0.22)] lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
            type="button"
          >
            <span aria-hidden className="flex flex-col gap-1.5">
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
              <span className="block h-0.5 w-5 rounded-full bg-current" />
            </span>
          </button>
          {mountAuthCluster ? (
            <Suspense fallback={<AuthClusterFallback />}>
              <NavbarAuthCluster />
            </Suspense>
          ) : (
            <AuthClusterFallback />
          )}
        </div>
      </div>
      <MobileMenu
        isAuthenticated={user.isAuthenticated}
        items={navigationItems}
        onClose={() => setMobileMenuOpen(false)}
        onSignIn={() => void openSignIn()}
        onSignUp={() => void openSignUp()}
        open={mobileMenuOpen}
      />
    </header>
  )
})
