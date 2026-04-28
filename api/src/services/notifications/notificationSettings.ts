import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { notificationSettings, users } from '../../db/schema.js'
import { env } from '../../env.js'
import {
  CONFIGURABLE_NOTIFICATION_EVENTS,
  type ConfigurableNotificationEvent,
  type NotificationEvent,
} from './notificationEvents.js'

const NOTIFICATION_SETTINGS_ID = 'default'

export type NotificationSettingsMap = Record<ConfigurableNotificationEvent, boolean>

export interface NotificationSettingsState {
  adminRecipientsOverride: string[]
  effectiveAdminRecipients: string[]
  enabledEvents: NotificationSettingsMap
}

export const DEFAULT_ENABLED_EVENTS: NotificationSettingsMap = {
  'payment.succeeded': true,
  'payment.failed': true,
  'subscription.created': true,
  'subscription.cancelled': true,
  'user.created': true,
  'stream.limit.reached': true,
  'admin.new.user': true,
  'admin.payment.received': true,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeEmailList(input: unknown) {
  if (!Array.isArray(input)) {
    return [] as string[]
  }

  return Array.from(
    new Set(
      input
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry)),
    ),
  )
}

function normalizeEnabledEvents(input: unknown): NotificationSettingsMap {
  const enabled = isRecord(input) ? input : {}
  return CONFIGURABLE_NOTIFICATION_EVENTS.reduce((acc, event) => {
    acc[event] = typeof enabled[event] === 'boolean' ? enabled[event] : DEFAULT_ENABLED_EVENTS[event]
    return acc
  }, {} as NotificationSettingsMap)
}

async function ensureNotificationSettingsRow() {
  if (!db) {
    return
  }

  await db
    .insert(notificationSettings)
    .values({
      adminRecipientsOverride: [],
      enabledEvents: DEFAULT_ENABLED_EVENTS,
      id: NOTIFICATION_SETTINGS_ID,
    })
    .onConflictDoNothing()
}

async function getAdminEmailsFromSourceOfTruth() {
  const sourceOfTruthEmails = (env.SOURCE_OF_TRUTH_ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)

  if (!db) {
    return Array.from(new Set(sourceOfTruthEmails))
  }

  const adminUsers = await db.select({ email: users.email }).from(users).where(eq(users.role, 'admin'))

  return Array.from(
    new Set([
      ...sourceOfTruthEmails,
      ...adminUsers.map((entry) => entry.email.trim().toLowerCase()).filter(Boolean),
    ]),
  )
}

export async function getNotificationSettingsState(): Promise<NotificationSettingsState> {
  const effectiveAdminRecipientsBase = await getAdminEmailsFromSourceOfTruth()

  if (!db) {
    return {
      adminRecipientsOverride: [],
      effectiveAdminRecipients: effectiveAdminRecipientsBase,
      enabledEvents: DEFAULT_ENABLED_EVENTS,
    }
  }

  await ensureNotificationSettingsRow()
  const [row] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.id, NOTIFICATION_SETTINGS_ID))
    .limit(1)

  if (!row) {
    throw new Error('Notification settings could not be loaded.')
  }

  const adminRecipientsOverride = normalizeEmailList(row.adminRecipientsOverride)

  return {
    adminRecipientsOverride,
    effectiveAdminRecipients:
      adminRecipientsOverride.length > 0 ? adminRecipientsOverride : effectiveAdminRecipientsBase,
    enabledEvents: normalizeEnabledEvents(row.enabledEvents),
  }
}

export async function updateNotificationSettingsState(input: {
  adminRecipientsOverride?: string[]
  enabledEvents?: Partial<NotificationSettingsMap>
}) {
  const current = await getNotificationSettingsState()

  if (!db) {
    return {
      ...current,
      adminRecipientsOverride: input.adminRecipientsOverride ?? current.adminRecipientsOverride,
      enabledEvents: {
        ...current.enabledEvents,
        ...(input.enabledEvents ?? {}),
      },
    }
  }

  const nextEnabledEvents: NotificationSettingsMap = {
    ...current.enabledEvents,
    ...(input.enabledEvents ?? {}),
  }
  const nextAdminRecipientsOverride = input.adminRecipientsOverride
    ? normalizeEmailList(input.adminRecipientsOverride)
    : current.adminRecipientsOverride

  await ensureNotificationSettingsRow()
  await db
    .update(notificationSettings)
    .set({
      adminRecipientsOverride: nextAdminRecipientsOverride,
      enabledEvents: nextEnabledEvents,
      updatedAt: new Date(),
    })
    .where(eq(notificationSettings.id, NOTIFICATION_SETTINGS_ID))

  return getNotificationSettingsState()
}

export async function isNotificationEnabled(event: NotificationEvent) {
  if (!CONFIGURABLE_NOTIFICATION_EVENTS.includes(event as ConfigurableNotificationEvent)) {
    return true
  }

  const settings = await getNotificationSettingsState()
  return settings.enabledEvents[event as ConfigurableNotificationEvent]
}
