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
  { kind: 'route', label: 'HAMSA', to: '/dashboard/hamsa' },
  { kind: 'route', label: 'AMRITA', to: '/dashboard/amrita' },
  { kind: 'route', label: 'Affiliate', to: '/dashboard/affiliate' },
  { kind: 'route', label: 'Settings', to: '/dashboard/settings' },
  { kind: 'route', label: 'Instructions', to: '/dashboard/instructions' },
]

export function getSidebarItems(user: AuthUser): SidebarItem[] {
  if (user.plan !== 'free') {
    return baseItems
  }

  return [
    { emphasis: 'upgrade', kind: 'route', label: 'Upgrade to REGEN', to: '/subscription?plan=regen' },
    ...baseItems,
  ]
}
