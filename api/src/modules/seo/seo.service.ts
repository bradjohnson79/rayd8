import { desc, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { seoActions, seoAudits, seoRouteMetadata } from '../../db/schema.js'
import { getSeoRouteManifestEntry, listSeoRouteManifestPaths, normalizeSeoPath, toFallbackSeoMetadata } from './seo.config.js'
import { generateSeoOptimizations } from './seo.ai.service.js'
import { runSeoAudit } from './seo.audit.service.js'
import { generateAndStoreSeoReport, listSeoReports } from './seo.report.service.js'
import type {
  EffectiveSeoMetadata,
  SeoActionRecord,
  SeoAuditResult,
  SeoOpenGraph,
  SeoOptimizationSuggestion,
} from './seo.types.js'

function requireSeoDb() {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  return db
}

function normalizeKeywords(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function normalizeOpenGraph(value: SeoOpenGraph | Record<string, unknown> | undefined) {
  return {
    description: typeof value?.description === 'string' ? value.description : undefined,
    image: typeof value?.image === 'string' ? value.image : undefined,
    title: typeof value?.title === 'string' ? value.title : undefined,
    type: typeof value?.type === 'string' ? value.type : undefined,
    url: typeof value?.url === 'string' ? value.url : undefined,
  } satisfies SeoOpenGraph
}

function mapRouteMetadataRow(row: typeof seoRouteMetadata.$inferSelect): EffectiveSeoMetadata {
  return {
    canonicalUrl: row.canonicalUrl,
    description: row.description,
    follow: row.follow,
    index: row.index,
    keywords: row.keywords,
    openGraph: normalizeOpenGraph(row.openGraph),
    path: row.path,
    priority: row.priority,
    routeType: row.routeType,
    title: row.title,
  }
}

function toEffectiveSeoMetadata(value: Record<string, unknown>): EffectiveSeoMetadata {
  const path = typeof value.path === 'string' ? normalizeSeoPath(value.path) : '/'
  const fallback = toFallbackSeoMetadata(path)

  return {
    canonicalUrl: typeof value.canonicalUrl === 'string' ? value.canonicalUrl : fallback.canonicalUrl,
    description: typeof value.description === 'string' ? value.description : fallback.description,
    follow: typeof value.follow === 'boolean' ? value.follow : fallback.follow,
    index: typeof value.index === 'boolean' ? value.index : fallback.index,
    keywords: Array.isArray(value.keywords)
      ? normalizeKeywords(value.keywords.filter((entry): entry is string => typeof entry === 'string'))
      : fallback.keywords,
    openGraph: {
      ...fallback.openGraph,
      ...normalizeOpenGraph(
        value.openGraph && typeof value.openGraph === 'object'
          ? (value.openGraph as Record<string, unknown>)
          : undefined,
      ),
    },
    path,
    priority: typeof value.priority === 'number' ? value.priority : fallback.priority,
    routeType:
      value.routeType === 'landing' || value.routeType === 'conversion' || value.routeType === 'support'
        ? value.routeType
        : fallback.routeType,
    title: typeof value.title === 'string' ? value.title : fallback.title,
  }
}

function mapSeoActionRow(row: typeof seoActions.$inferSelect): SeoActionRecord {
  return {
    actionType: row.actionType,
    afterSnapshot: toEffectiveSeoMetadata(row.afterSnapshot),
    beforeSnapshot: toEffectiveSeoMetadata(row.beforeSnapshot),
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    initiatedBy: row.initiatedBy,
    pageUrl: row.pageUrl,
    reasoning: row.reasoning,
  }
}

function mapSeoAuditRow(row: typeof seoAudits.$inferSelect): SeoAuditResult {
  const payload = row.issues as {
    issuesBySeverity: SeoAuditResult['issuesBySeverity']
    pages: SeoAuditResult['pages']
  }

  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    issuesBySeverity: payload.issuesBySeverity,
    pages: payload.pages,
    score: row.score,
    targetScope: row.targetScope,
  }
}

export async function getEffectiveSeoMetadataForPath(path: string) {
  const normalizedPath = normalizeSeoPath(path)
  const fallback = toFallbackSeoMetadata(normalizedPath)

  if (!db) {
    return fallback
  }

  const row = await db.query.seoRouteMetadata.findFirst({
    where: eq(seoRouteMetadata.path, normalizedPath),
  })

  if (!row) {
    return fallback
  }

  const override = mapRouteMetadataRow(row)

  return {
    ...fallback,
    ...override,
    keywords: override.keywords.length > 0 ? override.keywords : fallback.keywords,
    openGraph: {
      ...fallback.openGraph,
      ...override.openGraph,
    },
  }
}

async function saveSeoMetadataOverride(metadata: EffectiveSeoMetadata) {
  const database = requireSeoDb()

  await database
    .insert(seoRouteMetadata)
    .values({
      canonicalUrl: metadata.canonicalUrl,
      description: metadata.description,
      follow: metadata.follow,
      index: metadata.index,
      keywords: metadata.keywords,
      openGraph: metadata.openGraph,
      path: metadata.path,
      priority: metadata.priority,
      routeType: metadata.routeType,
      title: metadata.title,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: seoRouteMetadata.path,
      set: {
        canonicalUrl: metadata.canonicalUrl,
        description: metadata.description,
        follow: metadata.follow,
        index: metadata.index,
        keywords: metadata.keywords,
        openGraph: metadata.openGraph,
        priority: metadata.priority,
        routeType: metadata.routeType,
        title: metadata.title,
        updatedAt: new Date(),
      },
    })
}

function resolveSeoPaths(input?: { fullSite?: boolean; paths?: string[] }) {
  const requestedPaths = (input?.paths ?? []).map(normalizeSeoPath).filter(Boolean)

  if (input?.fullSite || requestedPaths.length === 0) {
    return listSeoRouteManifestPaths()
  }

  return Array.from(new Set(requestedPaths.filter((path) => Boolean(getSeoRouteManifestEntry(path)))))
}

export async function createAndStoreSeoAudit(input?: {
  fullSite?: boolean
  initiatedBy?: string | null
  paths?: string[]
}) {
  const database = requireSeoDb()
  const paths = resolveSeoPaths(input)
  const audit = await runSeoAudit(paths)
  const [row] = await database
    .insert(seoAudits)
    .values({
      initiatedBy: input?.initiatedBy ?? null,
      issues: {
        issuesBySeverity: audit.issuesBySeverity,
        pages: audit.pages,
      },
      paths,
      score: audit.score,
      targetScope: input?.fullSite || !input?.paths?.length ? 'full_site' : 'selected_paths',
    })
    .returning()

  return mapSeoAuditRow(row)
}

export async function listSeoAudits(limit = 10) {
  const database = requireSeoDb()
  const rows = await database.select().from(seoAudits).orderBy(desc(seoAudits.createdAt)).limit(limit)
  return rows.map(mapSeoAuditRow)
}

export async function getLatestSeoAudit() {
  const database = requireSeoDb()
  const row = await database.query.seoAudits.findFirst({
    orderBy: desc(seoAudits.createdAt),
  })
  return row ? mapSeoAuditRow(row) : null
}

export async function generateSeoOptimizationPreview(input?: { fullSite?: boolean; paths?: string[] }) {
  const paths = resolveSeoPaths(input)
  const audit = await runSeoAudit(paths)
  const pages = await Promise.all(
    audit.pages.map(async (page) => ({
      metadata: await getEffectiveSeoMetadataForPath(page.path),
      notes: page.issues.map((issue) => `${issue.severity}: ${issue.message}`),
    })),
  )

  const response = await generateSeoOptimizations({ pages })
  const allowedPaths = new Set(paths)

  return {
    ...response,
    actions: response.actions
      .map((action) => {
        const normalizedPath = normalizeSeoPath(action.path)
        const manifestEntry = getSeoRouteManifestEntry(normalizedPath) ?? toFallbackSeoMetadata(normalizedPath)

        return {
          ...manifestEntry,
          ...action,
          keywords: normalizeKeywords(action.keywords),
          openGraph: {
            ...manifestEntry.openGraph,
            ...normalizeOpenGraph(action.openGraph),
          },
          path: normalizedPath,
        } satisfies SeoOptimizationSuggestion
      })
      .filter((action) => allowedPaths.has(action.path)),
  }
}

async function createSeoAction(input: {
  actionType: 'apply' | 'rollback'
  afterSnapshot: EffectiveSeoMetadata
  beforeSnapshot: EffectiveSeoMetadata
  initiatedBy?: string | null
  pageUrl: string
  reasoning: string
}) {
  const database = requireSeoDb()
  const values: typeof seoActions.$inferInsert = {
    actionType: input.actionType,
    afterSnapshot: input.afterSnapshot as unknown as Record<string, unknown>,
    beforeSnapshot: input.beforeSnapshot as unknown as Record<string, unknown>,
    initiatedBy: input.initiatedBy ?? null,
    pageUrl: input.pageUrl,
    reasoning: input.reasoning,
  }

  const [row] = await database
    .insert(seoActions)
    .values(values)
    .returning()

  return mapSeoActionRow(row)
}

export async function applySeoChanges(input: {
  changes: SeoOptimizationSuggestion[]
  initiatedBy?: string | null
}) {
  const actions: SeoActionRecord[] = []

  for (const change of input.changes) {
    const normalizedPath = normalizeSeoPath(change.path)
    const beforeSnapshot = await getEffectiveSeoMetadataForPath(normalizedPath)
    const manifestEntry = getSeoRouteManifestEntry(normalizedPath) ?? beforeSnapshot
    const afterSnapshot: EffectiveSeoMetadata = {
      ...manifestEntry,
      ...beforeSnapshot,
      ...change,
      keywords: normalizeKeywords(change.keywords),
      openGraph: {
        ...beforeSnapshot.openGraph,
        ...normalizeOpenGraph(change.openGraph),
      },
      path: normalizedPath,
    }

    await saveSeoMetadataOverride(afterSnapshot)

    actions.push(
      await createSeoAction({
        actionType: 'apply',
        afterSnapshot,
        beforeSnapshot,
        initiatedBy: input.initiatedBy,
        pageUrl: normalizedPath,
        reasoning: change.reason,
      }),
    )
  }

  let report = null
  let reportError: string | null = null

  if (actions.length > 0) {
    try {
      report = await generateAndStoreSeoReport(actions)
    } catch (error) {
      reportError = error instanceof Error ? error.message : 'Unable to generate SEO report.'
    }
  }

  return {
    actions,
    report,
    reportError,
  }
}

export async function rollbackSeoAction(actionId: string, initiatedBy?: string | null) {
  const database = requireSeoDb()
  const originalAction = await database.query.seoActions.findFirst({
    where: eq(seoActions.id, actionId),
  })

  if (!originalAction) {
    throw new Error('SEO action not found.')
  }

  const restoredSnapshot = toEffectiveSeoMetadata(originalAction.beforeSnapshot)
  const currentSnapshot = await getEffectiveSeoMetadataForPath(originalAction.pageUrl)

  await saveSeoMetadataOverride(restoredSnapshot)

  const rollbackAction = await createSeoAction({
    actionType: 'rollback',
    afterSnapshot: restoredSnapshot,
    beforeSnapshot: currentSnapshot,
    initiatedBy,
    pageUrl: originalAction.pageUrl,
    reasoning: `Rolled back action ${actionId}.`,
  })

  let report = null
  let reportError: string | null = null

  try {
    report = await generateAndStoreSeoReport([rollbackAction])
  } catch (error) {
    reportError = error instanceof Error ? error.message : 'Unable to generate SEO report.'
  }

  return {
    action: rollbackAction,
    report,
    reportError,
  }
}

export async function getSeoOverview() {
  const latestAudit = await getLatestSeoAudit()
  const recentReports = await listSeoReports(5)

  return {
    latestAudit,
    managedRoutes: listSeoRouteManifestPaths().length,
    recentReports,
    seoScore: latestAudit?.score ?? 0,
  }
}
