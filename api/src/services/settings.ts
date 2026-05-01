import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { userSettings } from '../db/schema.js'

export interface SettingsPayload {
  amplifierMode: 'off' | '5x' | '10x' | '20x'
  blueLightEnabled: boolean
  circadianEnabled: boolean
  hasSeenRayd8GuideAt: Date | null
  lastSpeedMode: 'standard' | 'fast' | 'superFast' | 'slow' | 'superSlow'
}

export const defaultSettings: SettingsPayload = {
  amplifierMode: 'off',
  blueLightEnabled: false,
  circadianEnabled: false,
  hasSeenRayd8GuideAt: null,
  lastSpeedMode: 'standard',
}

export async function getSettingsForUser(userId: string) {
  if (!db) {
    return defaultSettings
  }

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1)

  if (!settings) {
    return defaultSettings
  }

  return {
    amplifierMode: settings.amplifierMode,
    blueLightEnabled: settings.blueLightEnabled,
    circadianEnabled: settings.circadianEnabled,
    hasSeenRayd8GuideAt: settings.hasSeenRayd8GuideAt,
    lastSpeedMode: settings.lastSpeedMode,
  }
}

export async function upsertSettingsForUser(
  userId: string,
  settings: SettingsPayload,
) {
  if (!db) {
    return settings
  }

  await db
    .insert(userSettings)
    .values({
      userId,
      amplifierMode: settings.amplifierMode,
      blueLightEnabled: settings.blueLightEnabled,
      circadianEnabled: settings.circadianEnabled,
      hasSeenRayd8GuideAt: settings.hasSeenRayd8GuideAt,
      lastSpeedMode: settings.lastSpeedMode,
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        amplifierMode: settings.amplifierMode,
        blueLightEnabled: settings.blueLightEnabled,
        circadianEnabled: settings.circadianEnabled,
        hasSeenRayd8GuideAt: settings.hasSeenRayd8GuideAt,
        lastSpeedMode: settings.lastSpeedMode,
      },
    })

  return getSettingsForUser(userId)
}
