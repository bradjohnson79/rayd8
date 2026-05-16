import puppeteer from 'puppeteer'
import { env } from '../../env.js'
import type {
  SeoAuditCapture,
  SeoAuditDegradedCapture,
  SeoAuditDiagnostic,
  SeoAuditIssue,
  SeoAuditPageResult,
  SeoSeverity,
} from './seo.types.js'

const AUDIT_BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
] as const
const AUDIT_NAVIGATION_TIMEOUT_MS = 15_000
const AUDIT_SELECTOR_TIMEOUT_MS = 5_000
const AUDIT_SETTLE_DELAY_MS = 350
const DEGRADED_AUDIT_MESSAGE = 'SEO browser capture temporarily unavailable.'

interface RawSeoPageSnapshot {
  canonicalUrl: string | null
  description: string
  h1: string | null
  h2: string | null
  openGraph: {
    description?: string
    image?: string
    title?: string
    type?: string
    url?: string
  }
  path: string
  robots: string | null
  title: string
}

function createIssue(
  code: string,
  severity: SeoSeverity,
  message: string,
  currentValue?: string | null,
): SeoAuditIssue {
  return { code, currentValue, message, severity }
}

function calculatePageScore(issues: SeoAuditIssue[]) {
  const penalty = issues.reduce((total, issue) => {
    if (issue.severity === 'critical') {
      return total + 16
    }

    if (issue.severity === 'improve') {
      return total + 7
    }

    return total
  }, 0)

  return Math.max(0, 100 - penalty)
}

function toDiagnostic(
  stage: SeoAuditDiagnostic['stage'],
  error: unknown,
  path?: string,
): SeoAuditDiagnostic {
  if (error instanceof Error) {
    return {
      message: error.message,
      path,
      stack: error.stack,
      stage,
    }
  }

  return {
    message: String(error),
    path,
    stage,
  }
}

function groupIssues(pageResults: SeoAuditPageResult[]) {
  const grouped = pageResults.flatMap((page) => page.issues)

  return {
    critical: grouped.filter((issue) => issue.severity === 'critical'),
    good: grouped.filter((issue) => issue.severity === 'good'),
    improve: grouped.filter((issue) => issue.severity === 'improve'),
  }
}

function getAverageScore(pageResults: SeoAuditPageResult[]) {
  return pageResults.length > 0
    ? Math.round(pageResults.reduce((total, page) => total + page.score, 0) / pageResults.length)
    : 0
}

function getPuppeteerExecutablePath() {
  if (env.PUPPETEER_EXECUTABLE_PATH?.trim()) {
    return env.PUPPETEER_EXECUTABLE_PATH.trim()
  }

  return undefined
}

export function getSeoAuditRuntimeConfig() {
  return {
    args: [...AUDIT_BROWSER_ARGS],
    executablePath: getPuppeteerExecutablePath() ?? 'puppeteer-managed-chromium',
    headless: true,
    navigationTimeoutMs: AUDIT_NAVIGATION_TIMEOUT_MS,
  }
}

function createDegradedCapture(
  partialResults: SeoAuditPageResult[],
  diagnostics: SeoAuditDiagnostic[],
): SeoAuditDegradedCapture {
  return {
    diagnostics,
    issuesBySeverity: groupIssues(partialResults),
    message: DEGRADED_AUDIT_MESSAGE,
    partialResults,
    status: 'degraded',
  }
}

function analyzeSnapshot(snapshot: RawSeoPageSnapshot) {
  const issues: SeoAuditIssue[] = []

  if (!snapshot.title.trim()) {
    issues.push(createIssue('missing_title', 'critical', 'Meta title is missing.'))
  } else if (snapshot.title.trim().length < 25) {
    issues.push(
      createIssue(
        'short_title',
        'improve',
        'Meta title is shorter than recommended for strong keyword alignment.',
        snapshot.title,
      ),
    )
  }

  if (!snapshot.description.trim()) {
    issues.push(createIssue('missing_description', 'critical', 'Meta description is missing.'))
  } else if (snapshot.description.trim().length < 80) {
    issues.push(
      createIssue(
        'short_description',
        'improve',
        'Meta description is shorter than recommended for search snippets.',
        snapshot.description,
      ),
    )
  }

  if (!snapshot.h1?.trim()) {
    issues.push(createIssue('missing_h1', 'critical', 'Primary H1 heading is missing.'))
  }

  if (!snapshot.h2?.trim()) {
    issues.push(createIssue('missing_h2', 'improve', 'Secondary H2 heading is missing.'))
  }

  if (!snapshot.openGraph.title?.trim()) {
    issues.push(createIssue('missing_og_title', 'critical', 'Open Graph title is missing.'))
  }

  if (!snapshot.openGraph.description?.trim()) {
    issues.push(
      createIssue('missing_og_description', 'critical', 'Open Graph description is missing.'),
    )
  }

  if (!snapshot.canonicalUrl?.trim()) {
    issues.push(createIssue('missing_canonical', 'improve', 'Canonical URL is missing.'))
  }

  return issues
}

function applyDuplicateChecks(pages: SeoAuditPageResult[]) {
  const titleMap = new Map<string, string[]>()
  const descriptionMap = new Map<string, string[]>()

  for (const page of pages) {
    const titleKey = page.title.trim().toLowerCase()
    const descriptionKey = page.description.trim().toLowerCase()

    if (titleKey) {
      titleMap.set(titleKey, [...(titleMap.get(titleKey) ?? []), page.path])
    }

    if (descriptionKey) {
      descriptionMap.set(descriptionKey, [...(descriptionMap.get(descriptionKey) ?? []), page.path])
    }
  }

  for (const page of pages) {
    const duplicateTitles = titleMap.get(page.title.trim().toLowerCase()) ?? []
    const duplicateDescriptions = descriptionMap.get(page.description.trim().toLowerCase()) ?? []

    if (duplicateTitles.length > 1) {
      page.issues.push(
        createIssue(
          'duplicate_title',
          'critical',
          `Meta title is duplicated across ${duplicateTitles.join(', ')}.`,
          page.title,
        ),
      )
    }

    if (duplicateDescriptions.length > 1) {
      page.issues.push(
        createIssue(
          'duplicate_description',
          'improve',
          `Meta description is duplicated across ${duplicateDescriptions.join(', ')}.`,
          page.description,
        ),
      )
    }

    page.score = calculatePageScore(page.issues)
  }
}

export async function runSeoAudit(paths: string[]): Promise<SeoAuditCapture> {
  const launchOptions = {
    args: [...AUDIT_BROWSER_ARGS],
    executablePath: getPuppeteerExecutablePath(),
    headless: true,
  }

  let browser

  try {
    browser = await puppeteer.launch(launchOptions)
  } catch (error) {
    return createDegradedCapture([], [toDiagnostic('browser_launch', error)])
  }

  try {
    const pageResults: SeoAuditPageResult[] = []
    const diagnostics: SeoAuditDiagnostic[] = []

    for (const path of paths) {
      const page = await browser.newPage()

      try {
        page.setDefaultNavigationTimeout(AUDIT_NAVIGATION_TIMEOUT_MS)
        page.setDefaultTimeout(AUDIT_SELECTOR_TIMEOUT_MS)
        await page.goto(new URL(path, env.APP_URL).toString(), {
          timeout: AUDIT_NAVIGATION_TIMEOUT_MS,
          waitUntil: 'domcontentloaded',
        })
        await page.waitForSelector('body', { timeout: AUDIT_SELECTOR_TIMEOUT_MS })
        await page.waitForFunction(() => document.readyState !== 'loading', {
          timeout: AUDIT_SELECTOR_TIMEOUT_MS,
        })
        await new Promise((resolve) => setTimeout(resolve, AUDIT_SETTLE_DELAY_MS))

        const snapshot = (await page.evaluate((currentPath: string) => {
          const description =
            document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? ''
          const og = {
            description:
              document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
              undefined,
            image:
              document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ??
              undefined,
            title:
              document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ?? undefined,
            type:
              document.querySelector<HTMLMetaElement>('meta[property="og:type"]')?.content ?? undefined,
            url:
              document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content ?? undefined,
          }

          const robots =
            document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? null

          return {
            canonicalUrl:
              document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
            description,
            h1: document.querySelector('h1')?.textContent?.trim() ?? null,
            h2: document.querySelector('h2')?.textContent?.trim() ?? null,
            openGraph: og,
            path: currentPath,
            robots,
            title: document.title ?? '',
          }
        }, path)) as RawSeoPageSnapshot

        const issues = analyzeSnapshot(snapshot)

        if (snapshot.robots?.toLowerCase().includes('noindex')) {
          issues.push(
            createIssue(
              'route_noindex',
              'good',
              'Page is intentionally excluded from indexing through robots metadata.',
              snapshot.robots,
            ),
          )
        }

        pageResults.push({
          description: snapshot.description,
          h1: snapshot.h1,
          h2: snapshot.h2,
          issues,
          openGraph: snapshot.openGraph,
          path: snapshot.path,
          score: calculatePageScore(issues),
          title: snapshot.title,
        })
      } catch (error) {
        diagnostics.push(toDiagnostic('page_capture', error, path))
      } finally {
        await page.close().catch(() => undefined)
      }
    }

    applyDuplicateChecks(pageResults)

    if (diagnostics.length > 0) {
      return createDegradedCapture(pageResults, diagnostics)
    }

    return {
      issuesBySeverity: groupIssues(pageResults),
      pages: pageResults,
      score: getAverageScore(pageResults),
      status: 'complete',
    }
  } finally {
    await browser.close()
  }
}
