import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AuthUser } from '../../app/types'
import { useUpgradeNavigation } from '../auth/useUpgradeNavigation'
import { dashboardSectionIds, type DashboardSectionId } from './dashboardSections'
import { getSidebarItems } from './sidebarItems'
import type { ExpressShellMode } from './useExpressNavigation'

interface SidebarProps {
  isMembershipLoading?: boolean
  user: AuthUser
  open: boolean
  onClose: () => void
  shellMode: ExpressShellMode
}

export function Sidebar({ isMembershipLoading = false, user, open, onClose, shellMode }: SidebarProps) {
  if (shellMode === 'drawer' && !open) {
    return null
  }

  if (shellMode === 'drawer') {
    return <DrawerSidebar isMembershipLoading={Boolean(isMembershipLoading)} onClose={onClose} user={user} />
  }

  if (shellMode === 'persistent') {
    return <PersistentSidebar isMembershipLoading={Boolean(isMembershipLoading)} onClose={onClose} user={user} />
  }

  return null
}

function DrawerSidebar({
  isMembershipLoading,
  user,
  onClose,
}: Pick<SidebarProps, 'isMembershipLoading' | 'user' | 'onClose'>) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setEntered(true)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <>
      <button
        aria-label="Close navigation"
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-[min(18rem,75vw)] flex-col bg-[rgba(7,12,16,0.82)] shadow-[0_18px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-transform duration-300',
          entered ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <button
          aria-label="Close navigation"
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-slate-100 shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-white/[0.1]"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
            <path
              d="m6 6 12 12M18 6 6 18"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </button>

        <SidebarPanelContent
          isMembershipLoading={Boolean(isMembershipLoading)}
          mode="drawer"
          onClose={onClose}
          user={user}
        />
      </aside>
    </>
  )
}

function PersistentSidebar({
  isMembershipLoading,
  user,
  onClose,
}: Pick<SidebarProps, 'isMembershipLoading' | 'user' | 'onClose'>) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[25vw] flex-col bg-transparent">
      <SidebarPanelContent
        isMembershipLoading={Boolean(isMembershipLoading)}
        mode="persistent"
        onClose={onClose}
        user={user}
      />
    </aside>
  )
}

function SidebarPanelContent({
  isMembershipLoading = false,
  mode,
  onClose,
  user,
}: Pick<SidebarProps, 'isMembershipLoading' | 'user' | 'onClose'> & { mode: ExpressShellMode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const navigateToUpgrade = useUpgradeNavigation()
  const items = isMembershipLoading ? getSidebarItems({ ...user, plan: 'premium' }) : getSidebarItems(user)
  const [observerActiveSection, setObserverActiveSection] =
    useState<DashboardSectionId>('expansion')

  const isDashboardRoute = location.pathname === '/dashboard'

  const hashSyncedSection = useMemo((): DashboardSectionId | null => {
    if (!isDashboardRoute) {
      return null
    }

    const nextHash = location.hash.replace('#', '') as DashboardSectionId

    return dashboardSectionIds.includes(nextHash) ? nextHash : null
  }, [isDashboardRoute, location.hash])

  const activeSection = hashSyncedSection ?? observerActiveSection

  useEffect(() => {
    if (!isDashboardRoute) {
      return
    }

    let observer: IntersectionObserver | null = null
    let frameId = 0

    const connectObserver = () => {
      const rootElement = document.getElementById('member-dashboard-scroll')
      const sectionElements = dashboardSectionIds
        .map((sectionId) => document.getElementById(sectionId))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)

      if (!rootElement || sectionElements.length === 0) {
        frameId = window.requestAnimationFrame(connectObserver)
        return
      }

      observer = new IntersectionObserver(
        (entries) => {
          const visibleEntries = entries
            .filter((entry) => entry.isIntersecting)
            .sort((entryA, entryB) => entryB.intersectionRatio - entryA.intersectionRatio)

          if (visibleEntries.length === 0) {
            return
          }

          const topEntry = visibleEntries[0]
          const nextSection = topEntry.target.id as DashboardSectionId
          setObserverActiveSection(nextSection)
        },
        {
          root: rootElement,
          rootMargin: '-18% 0px -45% 0px',
          threshold: [0.25, 0.5, 0.75],
        },
      )

      sectionElements.forEach((element) => observer?.observe(element))
    }

    frameId = window.requestAnimationFrame(connectObserver)

    return () => {
      window.cancelAnimationFrame(frameId)
      observer?.disconnect()
    }
  }, [isDashboardRoute])

  const settingsRouteActive = useMemo(
    () => location.pathname === '/dashboard/settings',
    [location.pathname],
  )

  function isItemActive(item: (typeof items)[number]) {
    if (item.kind === 'route') {
      if (item.to === '/dashboard/settings') {
        return settingsRouteActive
      }

      return location.pathname + location.search === item.to || location.pathname === item.to
    }

    return isDashboardRoute && activeSection === item.sectionId
  }

  function handleNavigation(item: (typeof items)[number]) {
    if (item.emphasis === 'upgrade') {
      void navigateToUpgrade({ targetPath: item.to })
      onClose()
      return
    }

    if (item.kind === 'route') {
      navigate(item.to)
      onClose()
      return
    }

    const sectionId = item.sectionId ?? 'expansion'
    const targetPath = item.to
    setObserverActiveSection(sectionId)

    if (location.pathname !== '/dashboard') {
      navigate(targetPath)
      onClose()
      return
    }

    const targetElement = document.getElementById(sectionId)

    if (targetElement) {
      navigate(targetPath, { replace: false })
      targetElement.scrollIntoView({ behavior: 'auto', block: 'start' })
    } else {
      navigate(targetPath)
    }

    onClose()
  }

  function handleBackToHome() {
    navigate('/')
    onClose()
  }

  const isPersistent = mode === 'persistent'
  const headerClassName = isPersistent ? 'px-4 py-8' : 'px-5 py-6 pr-16'
  const titleClassName = isPersistent
    ? 'text-[22px] uppercase leading-[1.4rem] tracking-[0.24em] text-emerald-200/80'
    : 'text-2xl uppercase tracking-[0.24em] text-emerald-200/80'
  const planClassName = isPersistent
    ? 'mt-3 text-[22px] uppercase leading-[1.4rem] tracking-[0.24em] text-slate-400'
    : 'mt-3 text-2xl uppercase leading-[1.4rem] tracking-[0.24em] text-slate-400'
  const navClassName = isPersistent
    ? 'flex-1 overflow-y-auto px-3 pb-10'
    : 'flex-1 overflow-y-auto px-3 pb-6'
  const itemClassName = isPersistent
    ? 'flex min-h-[4.5rem] w-full flex-col items-start justify-center gap-2 rounded-2xl px-4 py-3.5 text-left text-[11px] uppercase leading-[1.15rem] tracking-[0.24em] transition-colors'
    : 'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-xs uppercase tracking-[0.24em] transition-colors'
  const inactiveDotClassName = isPersistent ? 'bg-white/20 opacity-40' : 'bg-white/20 opacity-0'
  const footerClassName = isPersistent ? 'px-3 pb-8' : 'px-3 pb-6'

  return (
    <>
      <div className={headerClassName}>
        <p className={titleClassName}>RAYD8®</p>
        <p className={planClassName}>
          {isMembershipLoading ? 'checking' : user.plan}
        </p>
      </div>

      <nav className={navClassName}>
        <ul className="w-full space-y-2">
          {items.map((item) => (
            <li key={item.to}>
              <button
                className={[
                  itemClassName,
                  item.emphasis === 'upgrade'
                    ? 'border border-emerald-200/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(59,130,246,0.22))] text-white shadow-[0_14px_45px_rgba(16,185,129,0.18)] hover:border-emerald-200/30 hover:bg-[linear-gradient(135deg,rgba(16,185,129,0.3),rgba(59,130,246,0.28))]'
                    : isItemActive(item)
                    ? 'bg-white/[0.08] text-white shadow-[0_10px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-white hover:backdrop-blur-xl',
                ].join(' ')}
                onClick={() => handleNavigation(item)}
                type="button"
              >
                <span className="max-w-full whitespace-normal break-words text-left">
                  {item.label}
                </span>
                <span
                  className={[
                    'h-1.5 w-1.5 shrink-0 rounded-full transition-opacity',
                    item.emphasis === 'upgrade'
                      ? 'bg-emerald-200 opacity-100 shadow-[0_0_12px_rgba(167,243,208,0.8)]'
                      : isItemActive(item)
                        ? 'bg-emerald-300 opacity-100'
                        : inactiveDotClassName,
                  ].join(' ')}
                />
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className={footerClassName}>
        <button
          className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.24em] text-white transition-colors hover:bg-white/[0.08]"
          onClick={handleBackToHome}
          type="button"
        >
          Back To Home
        </button>
      </div>
    </>
  )
}
