export const dashboardSectionIds = [
  'expansion',
  'premium',
  'regen',
  'hamsa',
  'amrita',
] as const

export type DashboardSectionId = (typeof dashboardSectionIds)[number]

export function toDashboardSectionHref(sectionId: DashboardSectionId) {
  return `/dashboard#${sectionId}`
}
