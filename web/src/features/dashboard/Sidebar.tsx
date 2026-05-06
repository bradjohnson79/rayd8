import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AuthUser } from '../../app/types'
import { useUpgradeNavigation } from '../auth/useUpgradeNavigation'
import { dashboardSectionIds, type DashboardSectionId } from './dashboardSections'
import { getSidebarItems } from './sidebarItems'

interface SidebarProps {
  user: AuthUser
  open: boolean
  onClose: () => void
}

export function Sidebar({ user, open, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const navigateToUpgrade = useUpgradeNavigation()
  const items = getSidebarItems(user.plan)
  const [observerActiveSection, setObserverActiveSection] =
    useState<DashboardSectionId>('expansion')
  const [isMdBreakpoint, setIsMdBreakpoint] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false,
  )

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
    const mediaQuery = window.matchMedia('(min-width: 768px)')

    const handleChange = () => {
      setIsMdBreakpoint(mediaQuery.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

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
      void navigateToUpgrade()
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

  const mobileDrawerClosed = !isMdBreakpoint && !open

  return (
    <>
      {open ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onClose}
          type="button"
        />
      ) : null}

      <aside
        aria-hidden={mobileDrawerClosed}
        className={[
          'fixed inset-y-0 left-0 z-30 flex w-72 flex-col bg-[rgba(7,12,16,0.82)] shadow-[0_18px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-[transform,visibility] duration-300',
          open ? 'translate-x-0' : '-translate-x-full',
          mobileDrawerClosed ? 'max-md:invisible max-md:pointer-events-none' : '',
          'md:w-[25vw] md:bg-transparent md:shadow-none md:backdrop-blur-0 md:translate-x-0',
        ].join(' ')}
        inert={mobileDrawerClosed ? true : undefined}
      >
        <div className="px-5 py-6 md:px-4 md:py-8">
          <p className="text-2xl uppercase tracking-[0.24em] text-emerald-200/80 md:text-[22px] md:leading-[1.4rem]">
            RAYD8®
          </p>
          <p className="mt-3 text-2xl uppercase leading-[1.4rem] tracking-[0.24em] text-slate-400 md:text-[22px]">
            {user.plan}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6 md:px-3 md:pb-10">
          <ul className="w-full space-y-2">
            {items.map((item) => (
              <li key={item.to}>
                <button
                  className={[
                    'flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-xs uppercase tracking-[0.24em] transition-colors md:min-h-[4.5rem] md:flex-col md:items-start md:justify-center md:gap-2 md:px-4 md:py-3.5 md:leading-[1.15rem] md:text-[11px]',
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
                          : 'bg-white/20 opacity-0 md:opacity-40',
                    ].join(' ')}
                  />
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-3 pb-6 md:px-3 md:pb-8">
          <button
            className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.24em] text-white transition-colors hover:bg-white/[0.08]"
            onClick={handleBackToHome}
            type="button"
          >
            Back To Home
          </button>
        </div>
      </aside>
    </>
  )
}
