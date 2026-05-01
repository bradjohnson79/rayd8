import { apiRequest } from './api'

export interface SettingsResponse {
  settings: {
    amplifierMode: 'off' | '5x' | '10x' | '20x'
    blueLightEnabled: boolean
    circadianEnabled: boolean
    hasSeenRayd8GuideAt: string | Date | null
    lastSpeedMode: 'standard' | 'fast' | 'superFast' | 'slow' | 'superSlow'
  }
}

export function markRayd8GuideSeen(token: string) {
  return apiRequest<SettingsResponse & { success: true }>(
    '/v1/settings/rayd8-guide-seen',
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    token,
  )
}
