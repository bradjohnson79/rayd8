import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'

interface MobileMenuItem {
  href: string
  label: string
}

interface MobileMenuProps {
  isAuthenticated: boolean
  items: MobileMenuItem[]
  onClose: () => void
  onSignIn: () => void
  onSignUp: () => void
  open: boolean
}

export function MobileMenu({
  isAuthenticated,
  items,
  onClose,
  onSignIn,
  onSignUp,
  open,
}: MobileMenuProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            animate={{ opacity: 1 }}
            aria-label="Close navigation menu"
            className="fixed inset-0 z-50 bg-[rgba(3,6,10,0.7)] backdrop-blur-md"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={onClose}
            type="button"
          />
          <motion.aside
            animate={{ opacity: 1, x: 0 }}
            className="fixed inset-y-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col rounded-[2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(8,13,20,0.96),rgba(4,7,12,0.98))] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.42),0_0_0_1px_rgba(167,243,208,0.06)] backdrop-blur-2xl"
            exit={{ opacity: 0, x: 28 }}
            initial={{ opacity: 0, x: 28 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-emerald-200/65">Navigation</p>
                <p className="mt-2 text-sm text-white/72">Move through RAYD8 quickly on mobile.</p>
              </div>
              <button
                aria-label="Close navigation menu"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 transition hover:border-emerald-200/35 hover:text-white"
                onClick={onClose}
                type="button"
              >
                <span aria-hidden className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>

            <nav className="mt-8 flex flex-col gap-2">
              {items.map((item) => (
                <a
                  className="rounded-2xl border border-transparent px-4 py-3 text-left text-base text-white/84 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                  href={item.href}
                  key={item.href}
                  onClick={onClose}
                >
                  {item.label}
                </a>
              ))}
              <Link
                className="rounded-2xl border border-transparent px-4 py-3 text-left text-base text-white/84 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
                onClick={onClose}
                to="/subscription?plan=regen"
              >
                Subscription
              </Link>
            </nav>

            <div className="mt-auto border-t border-white/10 pt-5">
              <div className="grid gap-3">
                {isAuthenticated ? (
                  <Link
                    className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.92),rgba(59,130,246,0.9))] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_55px_rgba(15,118,110,0.28)] transition hover:brightness-105"
                    onClick={onClose}
                    to="/dashboard"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/84 transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white"
                      onClick={() => {
                        onClose()
                        onSignIn()
                      }}
                      type="button"
                    >
                      Sign In
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.92),rgba(59,130,246,0.9))] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_55px_rgba(15,118,110,0.28)] transition hover:brightness-105"
                      onClick={() => {
                        onClose()
                        onSignUp()
                      }}
                      type="button"
                    >
                      Sign Up / Get Started
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
