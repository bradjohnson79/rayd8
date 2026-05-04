import { apiRequest } from './api'

export interface SettingsResponse {
  settings: {
    allowExtendedSessions: boolean
    amplifierMode: 'off' | '5x' | '10x' | '20x'
    blueLightEnabled: boolean
    circadianEnabled: boolean
    hasSeenRayd8GuideAt: string | Date | null
    lastSpeedMode: 'standard' | 'fast' | 'superFast' | 'slow' | 'superSlow'
  }
}

export type UserSettingsPayload = SettingsResponse['settings']

export function getSettings(token: string) {
  return apiRequest<SettingsResponse>('/v1/settings', undefined, token)
}

export function updateSettings(settings: UserSettingsPayload, token: string) {
  return apiRequest<SettingsResponse>(
    '/v1/settings',
    {
      method: 'PUT',
      body: JSON.stringify(settings),
    },
    token,
  )
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
