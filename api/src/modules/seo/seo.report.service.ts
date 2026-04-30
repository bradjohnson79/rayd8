import { desc, eq } from 'drizzle-orm'
import puppeteer from 'puppeteer'
import { db } from '../../db/client.js'
import { seoReports } from '../../db/schema.js'
import { generateSeoReport } from './seo.ai.service.js'
import type { EffectiveSeoMetadata, SeoActionRecord, SeoReportRecord, SeoStructuredReport } from './seo.types.js'

function requireSeoDb() {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  return db
}

function toSeoStructuredReport(value: Record<string, unknown>): SeoStructuredReport | Record<string, unknown> {
  return value
}

function mapReportRow(row: typeof seoReports.$inferSelect): SeoReportRecord {
  return {
    createdAt: row.createdAt.toISOString(),
    error: row.error,
    fullReportJson: toSeoStructuredReport(row.fullReportJson),
    id: row.id,
    relatedActionIds: row.relatedActionIds,
    status: row.status,
    summary: row.summary,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderMetadataSummary(label: string, metadata: EffectiveSeoMetadata) {
  return `
    <section>
      <h4>${escapeHtml(label)}</h4>
      <p><strong>Title:</strong> ${escapeHtml(metadata.title)}</p>
      <p><strong>Description:</strong> ${escapeHtml(metadata.description)}</p>
      <p><strong>Canonical:</strong> ${escapeHtml(metadata.canonicalUrl ?? 'Not set')}</p>
      <p><strong>Robots:</strong> ${metadata.index ? 'index' : 'noindex'}, ${metadata.follow ? 'follow' : 'nofollow'}</p>
      <p><strong>Keywords:</strong> ${escapeHtml(metadata.keywords.join(', ') || 'None')}</p>
    </section>
  `
}

function renderReportHtml(report: SeoReportRecord) {
  const structured = report.fullReportJson as SeoStructuredReport
  const actionBlocks = Array.isArray(structured.actions)
    ? structured.actions
        .map(
          (action) => `
          <article class="action-card">
            <h3>${escapeHtml(action.page)}</h3>
            <p><strong>Reason:</strong> ${escapeHtml(action.reason)}</p>
            <div class="grid">
              ${renderMetadataSummary('Before', action.before)}
              ${renderMetadataSummary('After', action.after)}
            </div>
          </article>
        `,
        )
        .join('')
    : ''

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>RAYD8 SEO Optimization Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
        h1 { font-size: 28px; margin-bottom: 6px; }
        h2 { font-size: 18px; margin-top: 24px; }
        h3 { font-size: 16px; margin-bottom: 8px; }
        h4 { font-size: 14px; margin-bottom: 8px; }
        p { line-height: 1.5; margin: 6px 0; }
        .eyebrow { text-transform: uppercase; letter-spacing: 0.3em; color: #475569; font-size: 11px; }
        .panel { border: 1px solid #cbd5e1; border-radius: 18px; padding: 18px; margin-top: 18px; }
        .action-card { border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; margin-top: 16px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
      </style>
    </head>
    <body>
      <p class="eyebrow">RAYD8 SEO Optimization Report</p>
      <h1>RAYD8 SEO Optimization Report</h1>
      <p><strong>Status:</strong> ${escapeHtml(report.status)}</p>
      <p><strong>Created:</strong> ${escapeHtml(new Date(report.createdAt).toLocaleString())}</p>
      <div class="panel">
        <h2>Summary</h2>
        <p>${escapeHtml(structured.summary ?? report.summary)}</p>
        <p><strong>Reasoning:</strong> ${escapeHtml(structured.reasoning ?? 'Not available')}</p>
        <p><strong>Keyword alignment:</strong> ${escapeHtml(structured.keywordAlignment ?? 'Not available')}</p>
        <p><strong>Expected SEO impact:</strong> ${escapeHtml(structured.impact ?? 'Not available')}</p>
        <p><strong>Confidence:</strong> ${escapeHtml(String(structured.confidence ?? 'N/A'))}</p>
      </div>
      <h2>Actions</h2>
      ${actionBlocks || '<p>No applied actions recorded.</p>'}
    </body>
  </html>`
}

export async function listSeoReports(limit = 25) {
  const database = requireSeoDb()
  const safeLimit = Math.min(Math.max(limit, 1), 50)
  const rows = await database.select().from(seoReports).orderBy(desc(seoReports.createdAt)).limit(safeLimit)
  return rows.map(mapReportRow)
}

export async function getSeoReportById(reportId: string) {
  const database = requireSeoDb()
  const row = await database.query.seoReports.findFirst({
    where: eq(seoReports.id, reportId),
  })

  return row ? mapReportRow(row) : null
}

export async function createPendingSeoReport(actionIds: string[]) {
  const database = requireSeoDb()
  const [row] = await database
    .insert(seoReports)
    .values({
      relatedActionIds: actionIds,
      status: 'pending',
      summary: 'Generating SEO report...',
    })
    .returning()

  return mapReportRow(row)
}

export async function completeSeoReport(reportId: string, report: SeoStructuredReport) {
  const database = requireSeoDb()
  const [row] = await database
    .update(seoReports)
    .set({
      error: null,
      fullReportJson: report as unknown as Record<string, unknown>,
      status: 'complete',
      summary: report.summary,
      updatedAt: new Date(),
    })
    .where(eq(seoReports.id, reportId))
    .returning()

  return mapReportRow(row)
}

export async function failSeoReport(reportId: string, error: string) {
  const database = requireSeoDb()
  const [row] = await database
    .update(seoReports)
    .set({
      error,
      status: 'failed',
      updatedAt: new Date(),
    })
    .where(eq(seoReports.id, reportId))
    .returning()

  return mapReportRow(row)
}

export async function generateAndStoreSeoReport(actions: SeoActionRecord[]) {
  const pendingReport = await createPendingSeoReport(actions.map((action) => action.id))

  try {
    const report = await generateSeoReport({
      actions: actions.map((action) => ({
        after: action.afterSnapshot,
        before: action.beforeSnapshot,
        page: action.pageUrl,
        reason: action.reasoning,
      })),
    })

    return await completeSeoReport(pendingReport.id, report)
  } catch (error) {
    await failSeoReport(
      pendingReport.id,
      error instanceof Error ? error.message : 'Unable to generate SEO report.',
    )
    throw error
  }
}

export async function generateSeoReportPdf(reportId: string) {
  const report = await getSeoReportById(reportId)

  if (!report) {
    throw new Error('SEO report not found.')
  }

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(renderReportHtml(report), { waitUntil: 'load' })
    return await page.pdf({
      format: 'A4',
      margin: {
        bottom: '18mm',
        left: '14mm',
        right: '14mm',
        top: '16mm',
      },
      printBackground: true,
    })
  } finally {
    await browser.close()
  }
}
