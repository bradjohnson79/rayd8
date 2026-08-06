import { and, eq, inArray, isNull, lt } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { activeSessions, usageSessions } from '../../db/schema.js'

/** Conservative default: heartbeat older than 60 minutes is stale. */
export const DEFAULT_STALE_HEARTBEAT_MINUTES = 60

export type StaleSessionCandidate = {
  id: string
  userId: string
  lastHeartbeat: Date
  startedAt: Date
  kind: 'usage_open' | 'active_row'
}

export type ReconcileStaleSessionsOptions = {
  staleHeartbeatMinutes?: number
  batchLimit?: number
  dryRun?: boolean
  now?: Date
}

export type ReconcileStaleSessionsResult = {
  dryRun: boolean
  staleHeartbeatMinutes: number
  batchLimit: number
  openUsageCandidates: number
  activeRowCandidates: number
  usageEnded: number
  activeDeleted: number
  scannedAt: string
}

export function isHeartbeatStale(lastHeartbeat: Date, now: Date, staleHeartbeatMinutes: number) {
  const thresholdMs = staleHeartbeatMinutes * 60_000
  return now.getTime() - lastHeartbeat.getTime() >= thresholdMs
}

export async function classifyStaleSessions(input: {
  staleHeartbeatMinutes?: number
  batchLimit?: number
  now?: Date
}): Promise<{ openUsage: StaleSessionCandidate[]; activeRows: StaleSessionCandidate[] }> {
  if (!db) {
    return { openUsage: [], activeRows: [] }
  }

  const staleHeartbeatMinutes = input.staleHeartbeatMinutes ?? DEFAULT_STALE_HEARTBEAT_MINUTES
  const batchLimit = input.batchLimit ?? 500
  const now = input.now ?? new Date()
  const cutoff = new Date(now.getTime() - staleHeartbeatMinutes * 60_000)

  const openUsageRows = await db
    .select({
      id: usageSessions.id,
      userId: usageSessions.userId,
      lastHeartbeat: usageSessions.lastHeartbeat,
      startedAt: usageSessions.startedAt,
    })
    .from(usageSessions)
    .where(and(isNull(usageSessions.endedAt), lt(usageSessions.lastHeartbeat, cutoff)))
    .limit(batchLimit)

  const activeRows = await db
    .select({
      id: activeSessions.id,
      userId: activeSessions.userId,
      lastHeartbeat: activeSessions.lastHeartbeat,
      startedAt: activeSessions.startedAt,
    })
    .from(activeSessions)
    .where(lt(activeSessions.lastHeartbeat, cutoff))
    .limit(batchLimit)

  return {
    openUsage: openUsageRows.map((row) => ({ ...row, kind: 'usage_open' as const })),
    activeRows: activeRows.map((row) => ({ ...row, kind: 'active_row' as const })),
  }
}

/**
 * Soft-reconcile clearly stale active/open rows for one user before a new start.
 * Does not block start; never touches fresh heartbeats; does not add watch-time.
 */
export async function softReconcileUserStaleActives(input: {
  userId: string
  staleHeartbeatMinutes?: number
  now?: Date
}) {
  if (!db) {
    return { deleted: 0, closed: 0 }
  }

  const staleHeartbeatMinutes = input.staleHeartbeatMinutes ?? DEFAULT_STALE_HEARTBEAT_MINUTES
  const now = input.now ?? new Date()
  const cutoff = new Date(now.getTime() - staleHeartbeatMinutes * 60_000)

  const openStale = await db
    .select({ id: usageSessions.id })
    .from(usageSessions)
    .where(
      and(
        eq(usageSessions.userId, input.userId),
        isNull(usageSessions.endedAt),
        lt(usageSessions.lastHeartbeat, cutoff),
      ),
    )

  let closed = 0
  if (openStale.length > 0) {
    const ids = openStale.map((row) => row.id)
    await db
      .update(usageSessions)
      .set({
        endedAt: now,
      })
      .where(and(eq(usageSessions.userId, input.userId), isNull(usageSessions.endedAt), inArray(usageSessions.id, ids)))
    closed = ids.length
  }

  const deleteResult = await db
    .delete(activeSessions)
    .where(and(eq(activeSessions.userId, input.userId), lt(activeSessions.lastHeartbeat, cutoff)))
    .returning({ id: activeSessions.id })

  return { deleted: deleteResult.length, closed }
}

export async function reconcileStaleSessions(
  options: ReconcileStaleSessionsOptions = {},
): Promise<ReconcileStaleSessionsResult> {
  const dryRun = options.dryRun !== false
  const staleHeartbeatMinutes = options.staleHeartbeatMinutes ?? DEFAULT_STALE_HEARTBEAT_MINUTES
  const batchLimit = options.batchLimit ?? 500
  const now = options.now ?? new Date()

  const classified = await classifyStaleSessions({
    staleHeartbeatMinutes,
    batchLimit,
    now,
  })

  let usageEnded = 0
  let activeDeleted = 0

  if (!dryRun && db) {
    const openIds = classified.openUsage.map((row) => row.id)
    if (openIds.length > 0) {
      await db
        .update(usageSessions)
        .set({
          endedAt: now,
        })
        .where(and(isNull(usageSessions.endedAt), inArray(usageSessions.id, openIds)))
      usageEnded = openIds.length
    }

    const activeIds = classified.activeRows.map((row) => row.id)
    if (activeIds.length > 0) {
      await db.delete(activeSessions).where(inArray(activeSessions.id, activeIds))
      activeDeleted = activeIds.length

      await db
        .update(usageSessions)
        .set({
          endedAt: now,
        })
        .where(and(isNull(usageSessions.endedAt), inArray(usageSessions.id, activeIds)))
    }
  }

  return {
    dryRun,
    staleHeartbeatMinutes,
    batchLimit,
    openUsageCandidates: classified.openUsage.length,
    activeRowCandidates: classified.activeRows.length,
    usageEnded: dryRun ? 0 : usageEnded,
    activeDeleted: dryRun ? 0 : activeDeleted,
    scannedAt: now.toISOString(),
  }
}
