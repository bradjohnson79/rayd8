import puppeteer from 'puppeteer'
import { env } from '../../env.js'
import type { SeoAuditIssue, SeoAuditPageResult, SeoSeverity } from './seo.types.js'

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

export async function runSeoAudit(paths: string[]) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  })

  try {
    const pageResults: SeoAuditPageResult[] = []

    for (const path of paths) {
      const page = await browser.newPage()

      try {
        await page.goto(new URL(path, env.APP_URL).toString(), {
          waitUntil: 'networkidle2',
        })
        await page.waitForSelector('body', { timeout: 5_000 })
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5_000 })
        await new Promise((resolve) => setTimeout(resolve, 350))

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
      } finally {
        await page.close().catch(() => undefined)
      }
    }

    applyDuplicateChecks(pageResults)

    const grouped = pageResults.flatMap((page) => page.issues)
    const issuesBySeverity = {
      critical: grouped.filter((issue) => issue.severity === 'critical'),
      good: grouped.filter((issue) => issue.severity === 'good'),
      improve: grouped.filter((issue) => issue.severity === 'improve'),
    }

    const averageScore =
      pageResults.length > 0
        ? Math.round(pageResults.reduce((total, page) => total + page.score, 0) / pageResults.length)
        : 0

    return {
      issuesBySeverity,
      pages: pageResults,
      score: averageScore,
    }
  } finally {
    await browser.close()
  }
}
