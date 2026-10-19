import type { PilotSigil } from './catalog.js'
import { claimLanguageIssues } from './catalog.js'
import type { SigilDomain } from './svg.js'

export const DOMAIN_TARGETS: Record<SigilDomain, number> = {
  physical: 100,
  emotional: 79,
  mental: 78,
  causal: 117,
}

export const FULL_CATALOG_TARGET = 374

export interface ManifestIssue {
  code: string
  message: string
}

const FILLER_NAME = /^(placeholder|filler|untitled|tbd)\b/i

export function validateSigilManifest(entries: PilotSigil[]): ManifestIssue[] {
  const issues: ManifestIssue[] = []
  const codes = new Set<string>()
  const names = new Set<string>()

  for (const entry of entries) {
    if (codes.has(entry.publicCode)) {
      issues.push({ code: entry.publicCode, message: 'Duplicate public code.' })
    }
    codes.add(entry.publicCode)

    const normalized = entry.name.trim().toLowerCase()
    if (names.has(normalized)) {
      issues.push({ code: entry.publicCode, message: 'Duplicate canonical name.' })
    }
    names.add(normalized)

    if (FILLER_NAME.test(entry.name)) {
      issues.push({ code: entry.publicCode, message: 'Filler name is not allowed.' })
    }

    if (entry.primaryKeywords.length === 0) {
      issues.push({ code: entry.publicCode, message: 'Primary keywords are required.' })
    }

    if (entry.assumptionStatement.length < 8) {
      issues.push({ code: entry.publicCode, message: 'Assumption statement is required.' })
    }

    const claims = claimLanguageIssues(`${entry.description} ${entry.assumptionStatement}`)
    if (claims.length > 0) {
      issues.push({ code: entry.publicCode, message: 'Unsupported outcome claim language.' })
    }

    for (const related of entry.relatedCodes) {
      if (!entries.some((candidate) => candidate.publicCode === related)) {
        issues.push({ code: entry.publicCode, message: `Related sigil ${related} is missing.` })
      }
    }
  }

  return issues
}

export function validateFullCatalogCounts(entries: PilotSigil[]): ManifestIssue[] {
  const issues = validateSigilManifest(entries)
  if (entries.length !== FULL_CATALOG_TARGET) {
    issues.push({
      code: 'catalog',
      message: `Full catalog has ${entries.length} names. The reviewed target is ${FULL_CATALOG_TARGET}. Bulk generation stays closed.`,
    })
    return issues
  }

  for (const domain of Object.keys(DOMAIN_TARGETS) as SigilDomain[]) {
    const count = entries.filter((entry) => entry.domain === domain).length
    if (count !== DOMAIN_TARGETS[domain]) {
      issues.push({
        code: domain,
        message: `${domain} has ${count} names. The target is ${DOMAIN_TARGETS[domain]}.`,
      })
    }
  }

  return issues
}
