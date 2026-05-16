import type { Experience } from '../../app/types'

export type AdminGlobalPlayerId = Experience | 'hamsa' | 'amrita'
export type AdminGlobalPlayerKind = 'rayd8' | 'iframe'

export interface AdminGlobalPlayer {
  adminAccess: 'unlimited'
  description: string
  id: AdminGlobalPlayerId
  kind: AdminGlobalPlayerKind
  label: string
  route: string
  tone: 'cyan' | 'emerald' | 'violet'
}

export const ADMIN_GLOBAL_PLAYERS: AdminGlobalPlayer[] = [
  {
    adminAccess: 'unlimited',
    description: 'Open the baseline RAYD8 resonance environment with admin unrestricted playback.',
    id: 'expansion',
    kind: 'rayd8',
    label: 'RAYD8® Expansion',
    route: '/admin/global-players/expansion',
    tone: 'cyan',
  },
  {
    adminAccess: 'unlimited',
    description: 'Review Premium scalar and color-frequency playback without subscription gating.',
    id: 'premium',
    kind: 'rayd8',
    label: 'RAYD8® Premium',
    route: '/admin/global-players/premium',
    tone: 'violet',
  },
  {
    adminAccess: 'unlimited',
    description: 'Validate the full REGEN environment, audio, and fullscreen playback unrestricted.',
    id: 'regen',
    kind: 'rayd8',
    label: 'RAYD8® REGEN',
    route: '/admin/global-players/regen',
    tone: 'emerald',
  },
  {
    adminAccess: 'unlimited',
    description: 'Launch HAMSA for internal QA, content review, and operational oversight.',
    id: 'hamsa',
    kind: 'iframe',
    label: 'HAMSA',
    route: '/admin/global-players/hamsa',
    tone: 'emerald',
  },
]

export function getAdminGlobalPlayer(id: string | undefined) {
  return ADMIN_GLOBAL_PLAYERS.find((player) => player.id === id) ?? null
}
