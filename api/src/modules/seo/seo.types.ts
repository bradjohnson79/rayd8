export type SeoRouteType = 'landing' | 'conversion' | 'support'
export type SeoActionType = 'apply' | 'rollback'
export type SeoReportStatus = 'pending' | 'complete' | 'failed'
export type SeoSeverity = 'critical' | 'improve' | 'good'

export interface SeoOpenGraph {
  description?: string
  image?: string
  title?: string
  type?: string
  url?: string
}

export interface EffectiveSeoMetadata {
  canonicalUrl: string | null
  description: string
  follow: boolean
  index: boolean
  keywords: string[]
  openGraph: SeoOpenGraph
  path: string
  priority: number
  routeType: SeoRouteType
  title: string
}

export interface SeoRouteManifestEntry extends EffectiveSeoMetadata {}

export interface SeoAuditIssue {
  code: string
  currentValue?: string | null
  message: string
  severity: SeoSeverity
}

export interface SeoAuditPageResult {
  description: string
  h1: string | null
  h2: string | null
  issues: SeoAuditIssue[]
  openGraph: SeoOpenGraph
  path: string
  score: number
  title: string
}

export interface SeoAuditResult {
  createdAt: string
  id: string
  issuesBySeverity: Record<SeoSeverity, SeoAuditIssue[]>
  pages: SeoAuditPageResult[]
  score: number
  targetScope: string
}

export interface SeoOptimizationSuggestion extends EffectiveSeoMetadata {
  reason: string
}

export interface SeoOptimizeResult {
  actions: SeoOptimizationSuggestion[]
  confidence: number
  summary: string
}

export interface SeoActionRecord {
  actionType: SeoActionType
  afterSnapshot: EffectiveSeoMetadata
  beforeSnapshot: EffectiveSeoMetadata
  createdAt: string
  id: string
  initiatedBy: string | null
  pageUrl: string
  reasoning: string
}

export interface SeoReportActionSummary {
  after: EffectiveSeoMetadata
  before: EffectiveSeoMetadata
  page: string
  reason: string
}

export interface SeoStructuredReport {
  actions: SeoReportActionSummary[]
  confidence: number
  impact: string
  keywordAlignment: string
  reasoning: string
  summary: string
}

export interface SeoReportRecord {
  createdAt: string
  error: string | null
  fullReportJson: SeoStructuredReport | Record<string, unknown>
  id: string
  relatedActionIds: string[]
  status: SeoReportStatus
  summary: string
  updatedAt: string
}
