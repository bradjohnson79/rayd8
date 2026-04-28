import { desc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { notificationsLog } from '../../db/schema.js'
import { dispatchNotification } from './dispatchNotification.js'
import type { NotificationEvent, NotificationPayloadMap, NotificationRequest } from './notificationEvents.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export async function listNotificationActivity(limit = 50) {
  if (!db) {
    return []
  }

  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const rows = await db
    .select()
    .from(notificationsLog)
    .orderBy(desc(notificationsLog.createdAt))
    .limit(safeLimit)

  return rows.map((row) => ({
    created_at: row.createdAt.toISOString(),
    entity_id: row.entityId,
    error: row.error,
    event: row.event,
    id: row.id,
    payload: row.payload,
    recipient: row.recipient,
    sent_at: row.sentAt?.toISOString() ?? null,
    status: row.status,
    type: row.type,
    updated_at: row.updatedAt.toISOString(),
    user_id: row.userId,
  }))
}

export async function retryNotificationActivity(ids?: string[]) {
  if (!db) {
    return { results: [], total: 0 }
  }

  const rows = ids?.length
    ? await db.select().from(notificationsLog).where(inArray(notificationsLog.id, ids))
    : await db
        .select()
        .from(notificationsLog)
        .where(eq(notificationsLog.status, 'failed'))
        .orderBy(desc(notificationsLog.createdAt))
        .limit(10)

  const results: Array<{ id: string; skipped?: boolean; success: boolean }> = []

  for (const row of rows) {
    if (!isRecord(row.payload)) {
      results.push({ id: row.id, success: false })
      continue
    }

    try {
      const result = await dispatchNotification(
        {
          event: row.event as NotificationEvent,
          payload: row.payload as unknown as NotificationPayloadMap[NotificationEvent],
          userId: row.userId,
        } satisfies NotificationRequest,
        { force: true, recipientOverride: [row.recipient] },
      )

      results.push({
        id: row.id,
        skipped: result.skipped > 0,
        success: result.success,
      })
    } catch {
      results.push({ id: row.id, success: false })
    }
  }

  return {
    results,
    total: results.length,
  }
}
