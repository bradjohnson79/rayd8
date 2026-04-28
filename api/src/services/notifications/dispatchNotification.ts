import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { notificationsLog, users } from '../../db/schema.js'
import { isNotificationServiceConfigured, sendNotificationEmail } from './notificationService.js'
import { type NotificationEvent, getNotificationEntityId, getNotificationRecipientType, type NotificationRequest } from './notificationEvents.js'
import { getNotificationSettingsState, isNotificationEnabled, normalizeEmailList } from './notificationSettings.js'
import { renderNotificationTemplate } from './renderTemplate.js'

interface DispatchOptions {
  dryRun?: boolean
  force?: boolean
  recipientOverride?: string[]
}

export interface NotificationDispatchResult {
  delivered: number
  html?: string
  recipients: string[]
  skipped: number
  subject?: string
  success: boolean
}

function toStoredPayload(value: unknown) {
  return value as unknown as Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function extractPayloadEmail(payload: unknown) {
  if (!isRecord(payload)) {
    return null
  }

  for (const key of ['userEmail', 'email', 'recipientEmail']) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase()
    }
  }

  return null
}

async function resolveUserRecipientEmail(input: { payload: unknown; userId?: string | null }) {
  const payloadEmail = extractPayloadEmail(input.payload)

  if (payloadEmail) {
    return payloadEmail
  }

  if (!db || !input.userId) {
    return null
  }

  const [record] = await db.select({ email: users.email }).from(users).where(eq(users.id, input.userId)).limit(1)
  return record?.email?.trim().toLowerCase() ?? null
}

async function resolveRecipients(
  request: NotificationRequest,
  recipientOverride?: string[],
) {
  if (recipientOverride && recipientOverride.length > 0) {
    return normalizeEmailList(recipientOverride)
  }

  if (getNotificationRecipientType(request.event) === 'admin') {
    const settings = await getNotificationSettingsState()
    return settings.effectiveAdminRecipients
  }

  const userRecipient = await resolveUserRecipientEmail({
    payload: request.payload,
    userId: request.userId,
  })

  return userRecipient ? [userRecipient] : []
}

async function hasSentNotification(event: NotificationEvent, entityId: string, recipient: string, type: 'user' | 'admin') {
  if (!db) {
    return false
  }

  const [record] = await db
    .select({ id: notificationsLog.id })
    .from(notificationsLog)
    .where(
      and(
        eq(notificationsLog.event, event),
        eq(notificationsLog.entityId, entityId),
        eq(notificationsLog.recipient, recipient),
        eq(notificationsLog.type, type),
        eq(notificationsLog.status, 'sent'),
      ),
    )
    .orderBy(desc(notificationsLog.createdAt))
    .limit(1)

  return Boolean(record)
}

async function insertNotificationLog(input: {
  entityId: string
  error?: string | null
  event: NotificationEvent
  payload: Record<string, unknown>
  recipient: string
  status: 'pending' | 'sent' | 'failed' | 'skipped_duplicate'
  type: 'user' | 'admin'
  userId?: string | null
}) {
  if (!db) {
    return
  }

  await db.insert(notificationsLog).values({
    entityId: input.entityId,
    error: input.error ?? null,
    event: input.event,
    payload: input.payload,
    recipient: input.recipient,
    sentAt: input.status === 'sent' ? new Date() : null,
    status: input.status,
    type: input.type,
    updatedAt: new Date(),
    userId: input.userId ?? null,
  })
}

export async function dispatchNotification(
  request: NotificationRequest,
  options: DispatchOptions = {},
): Promise<NotificationDispatchResult> {
  const enabled = await isNotificationEnabled(request.event)
  const entityId = getNotificationEntityId(request.event, request.payload)
  const type = getNotificationRecipientType(request.event)
  const recipients = await resolveRecipients(request, options.recipientOverride)
  const rendered = renderNotificationTemplate(request.event, request.payload)

  if (options.dryRun) {
    return {
      delivered: 0,
      html: rendered.html,
      recipients,
      skipped: 0,
      subject: rendered.subject,
      success: true,
    }
  }

  if (!enabled && !options.force) {
    return {
      delivered: 0,
      recipients,
      skipped: recipients.length,
      subject: rendered.subject,
      success: true,
    }
  }

  if (recipients.length === 0) {
    throw new Error(`No recipients resolved for notification event ${request.event}.`)
  }

  if (!isNotificationServiceConfigured()) {
    throw new Error('Notifications email service is not configured.')
  }

  let delivered = 0
  let skipped = 0

  for (const recipient of recipients) {
    if (!options.force && (await hasSentNotification(request.event, entityId, recipient, type))) {
      skipped += 1
      await insertNotificationLog({
        entityId,
        event: request.event,
        payload: toStoredPayload(request.payload),
        recipient,
        status: 'skipped_duplicate',
        type,
        userId: request.userId,
      })
      continue
    }

    try {
      await sendNotificationEmail({
        html: rendered.html,
        subject: rendered.subject,
        to: recipient,
      })

      delivered += 1
      await insertNotificationLog({
        entityId,
        event: request.event,
        payload: toStoredPayload(request.payload),
        recipient,
        status: 'sent',
        type,
        userId: request.userId,
      })
    } catch (error) {
      await insertNotificationLog({
        entityId,
        error: error instanceof Error ? error.message : 'Unknown notification error.',
        event: request.event,
        payload: toStoredPayload(request.payload),
        recipient,
        status: 'failed',
        type,
        userId: request.userId,
      })
      throw error
    }
  }

  return {
    delivered,
    recipients,
    skipped,
    subject: rendered.subject,
    success: delivered > 0 || skipped > 0,
  }
}
