import type { AuthUser } from '../../app/types'
import { toDashboardSectionHref, type DashboardSectionId } from './dashboardSections'

export interface SidebarItem {
  emphasis?: 'upgrade'
  kind: 'route' | 'section'
  label: string
  to: string
  sectionId?: DashboardSectionId
}

const baseItems: SidebarItem[] = [
  { kind: 'section', label: 'RAYD8® Expansion', sectionId: 'expansion', to: toDashboardSectionHref('expansion') },
  { kind: 'section', label: 'RAYD8® Premium', sectionId: 'premium', to: toDashboardSectionHref('premium') },
  { kind: 'section', label: 'RAYD8® REGEN', sectionId: 'regen', to: toDashboardSectionHref('regen') },
  { kind: 'route', label: 'AMRITA', to: '/dashboard/amrita' },
  { kind: 'route', label: 'Affiliate', to: '/dashboard/affiliate' },
  { kind: 'route', label: 'Settings', to: '/dashboard/settings' },
  { kind: 'route', label: 'Instructions', to: '/dashboard/instructions' },
]

export function getSidebarItems(user: AuthUser): SidebarItem[] {
  if (user.plan === 'regen' || user.plan === 'amrita') {
    return [
      ...baseItems.slice(0, 3),
      { kind: 'section', label: 'HAMSA', sectionId: 'hamsa', to: toDashboardSectionHref('hamsa') },
      ...baseItems.slice(3),
    ]
  }

  if (user.plan !== 'free') {
    return [
      ...baseItems.slice(0, 3),
      { kind: 'route', label: 'HAMSA', to: '/dashboard/hamsa' },
      ...baseItems.slice(3),
    ]
  }

  return [
    { emphasis: 'upgrade', kind: 'route', label: 'Upgrade to REGEN', to: '/subscription?plan=regen' },
    { emphasis: 'upgrade', kind: 'route', label: 'Upgrade to AMRITA', to: '/subscription?plan=amrita' },
    ...baseItems.slice(0, 3),
    { kind: 'route', label: 'HAMSA', to: '/dashboard/hamsa' },
    ...baseItems.slice(3),
  ]
}
