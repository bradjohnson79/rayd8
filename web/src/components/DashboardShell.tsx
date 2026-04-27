import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import type { PropsWithChildren, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { AuthUser } from '../app/types'
import { Rayd8Background } from './Rayd8Background'

const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)

interface DashboardShellProps extends PropsWithChildren {
  accent: 'emerald' | 'violet'
  desktopSidebarOffsetClass: string
  description: string
  eyebrow: string
  menuButtonClassName: string
  menuButtonLabel: string
  onOpenSidebar: () => void
  presentation?: 'immersive' | 'standard'
  sidebar: ReactNode
  user: AuthUser
  withGuestActions?: boolean
}

export function DashboardShell({
  accent,
  children,
  desktopSidebarOffsetClass,
  description,
  eyebrow,
  menuButtonClassName,
  menuButtonLabel,
  onOpenSidebar,
  presentation = 'standard',
  sidebar,
  user,
  withGuestActions = false,
}: DashboardShellProps) {
  const location = useLocation()
  const accentCopy =
    accent === 'emerald'
      ? {
          badge: 'text-emerald-200/60',
          button: 'border-emerald-300/20 bg-emerald-300/10 hover:bg-emerald-300/20',
        }
      : {
          badge: 'text-violet-200/60',
          button: 'border-violet-300/20 bg-violet-300/10 hover:bg-violet-300/20',
        }

  const hideImmersiveIdentityCluster =
    presentation === 'immersive' && location.pathname === '/dashboard'

  return (
    <Rayd8Background>
      {sidebar}

      <div
        className={[
          'relative z-10',
          presentation === 'immersive' ? `h-screen ${desktopSidebarOffsetClass}` : `min-h-screen ${desktopSidebarOffsetClass}`,
        ].join(' ')}
      >
        {presentation === 'immersive' ? (
          <>
            <div className="fixed left-4 top-4 z-50 md:hidden">
              <button
                aria-label={menuButtonLabel}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/12 bg-white/10 text-white shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl ${menuButtonClassName}`}
                onClick={onOpenSidebar}
                type="button"
              >
                <span className="text-lg">≡</span>
              </button>
            </div>

            {!hideImmersiveIdentityCluster ? (
              <div className="fixed right-4 top-4 z-50 flex items-center gap-3 pointer-events-auto sm:right-6 sm:top-6">
                <div className="hidden rounded-[1.4rem] bg-[rgba(5,7,12,0.42)] px-4 py-3 text-right shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-2xl sm:block">
                  <p className={`text-[10px] uppercase tracking-[0.32em] ${accentCopy.badge}`}>{eyebrow}</p>
                  <p className="mt-2 text-sm font-medium text-white">{user.email}</p>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">
                    {user.plan} {user.role === 'admin' ? '• admin' : ''}
                  </p>
                </div>

                {user.role === 'admin' ? (
                  <Link
                    className={`hidden rounded-2xl border px-4 py-2 text-sm font-medium text-white shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl transition md:inline-flex ${accentCopy.button}`}
                    to={accent === 'violet' ? '/dashboard' : '/admin'}
                  >
                    {accent === 'violet' ? 'Member dashboard' : 'Admin console'}
                  </Link>
                ) : null}

                {clerkEnabled ? (
                  <div className="flex items-center gap-2">
                    <Show when="signed-in">
                      <div className="rounded-full bg-[rgba(5,7,12,0.42)] p-1 shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-2xl">
                        <UserButton />
                      </div>
                    </Show>
                    {withGuestActions ? (
                      <Show when="signed-out">
                        <SignInButton mode="modal">
                          <button
                            className={`rounded-2xl border px-4 py-2 text-sm font-medium text-white shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl transition ${accentCopy.button}`}
                            type="button"
                          >
                            Sign in
                          </button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                          <button
                            className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl transition hover:bg-white/10"
                            type="button"
                          >
                            Sign up
                          </button>
                        </SignUpButton>
                      </Show>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-amber-100">
                    Demo mode
                  </div>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[rgba(5,7,12,0.44)] backdrop-blur-2xl">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  aria-label={menuButtonLabel}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] text-white shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl ${menuButtonClassName}`}
                  onClick={onOpenSidebar}
                  type="button"
                >
                  <span className="text-lg">≡</span>
                </button>
                <div>
                  <p className={`text-xs uppercase tracking-[0.32em] ${accentCopy.badge}`}>{eyebrow}</p>
                  <p className="mt-1 text-sm text-slate-300">{description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2 text-right shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:block">
                  <p className="text-sm font-medium text-white">{user.email}</p>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    {user.role} • {user.plan}
                  </p>
                </div>

                {user.role === 'admin' ? (
                  <Link
                    className={`hidden rounded-2xl border px-4 py-2 text-sm font-medium text-white shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl transition md:inline-flex ${accentCopy.button}`}
                    to={accent === 'violet' ? '/dashboard' : '/admin'}
                  >
                    {accent === 'violet' ? 'Member dashboard' : 'Admin console'}
                  </Link>
                ) : null}

                {clerkEnabled ? (
                  <div className="flex items-center gap-2">
                    <Show when="signed-in">
                      <div className="rounded-full border border-white/12 bg-white/[0.06] p-1 shadow-[0_8px_30px_rgba(0,0,0,0.16)] backdrop-blur-xl">
                        <UserButton />
                      </div>
                    </Show>
                    {withGuestActions ? (
                      <Show when="signed-out">
                        <SignInButton mode="modal">
                          <button
                            className={`rounded-2xl border px-4 py-2 text-sm font-medium text-white shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl transition ${accentCopy.button}`}
                            type="button"
                          >
                            Sign in
                          </button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                          <button
                            className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white shadow-[0_10px_36px_rgba(0,0,0,0.16)] backdrop-blur-xl transition hover:bg-white/10"
                            type="button"
                          >
                            Sign up
                          </button>
                        </SignUpButton>
                      </Show>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-amber-100">
                    Demo mode
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        <main
          className={
            presentation === 'immersive'
              ? 'h-screen overflow-hidden bg-transparent'
              : 'mx-auto max-w-6xl bg-transparent px-4 py-8 sm:px-6 lg:px-8'
          }
        >
          {children}
        </main>
      </div>
    </Rayd8Background>
  )
}
