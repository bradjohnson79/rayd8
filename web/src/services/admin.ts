import { apiBaseUrl, apiRequest } from './api'

export interface AdminOverview {
  totalUsers: number
  activeSubscribers: number
  currentStreamingSessions: number
  totalMinutesWatchedToday: number
  totalMinutesWatchedPast30Days: number
  averageVideoWatchTime: number
}

export interface AdminStripeRecord {
  clerk_user_id: string
  email: string
  stripe_customer_id: string
  stripe_subscription_id: string
  status: string
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  plan_type: 'single' | 'multi'
  created_at: string
  current_period_end: string | null
}

export interface AdminMuxAsset {
  asset_id: string
  playback_id: string | null
  duration_seconds: number
  status: string
  title: string
}

export interface AdminMuxStats {
  configured: boolean
  environment_key: string | null
  total_assets: number
  ready_assets: number
  processing_assets: number
  total_duration_seconds: number
}

export interface AdminUserRecord {
  id: string
  email: string
  role: 'member' | 'admin'
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  created_at: string
  subscription_status: string
  device_count: number
  active_session_count: number
}

export type AffiliateCommissionStatus = 'pending' | 'approved' | 'paid'

export interface AdminAffiliateOverviewCard {
  approvedAmountUsd: number
  nextPayoutDate: string
  paidAmountUsd: number
  pendingAmountUsd: number
  totalAffiliates: number
  totalCommissions: number
  totalReferrals: number
}

export interface AdminAffiliatePerformanceRecord {
  createdAt: string
  email: string
  lastPayoutDate: string | null
  payoutEligible: boolean
  pendingBalanceUsd: number
  referralCode: string
  totalPaidUsd: number
  totalEarnedUsd: number
  totalReferrals: number
  userId: string
}

export interface AdminAffiliateSummaryResponse {
  cards: {
    nextPayoutDate: string
    totalAffiliateRevenueGeneratedUsd: number
    totalCommissionsOwedUsd: number
    totalPaidOutUsd: number
  }
  payoutSchedule: {
    cutoffDate: string
    daysUntilNextPayout: number
    minimumPayoutThresholdUsd: number
    nextPayoutDate: string
    payoutWindowLabel: string
  }
  tracking: {
    health: {
      label: string
      message: string
      status: 'green' | 'red' | 'yellow'
    }
    lastVerifiedAffiliateFlow: {
      message: string
      result: 'error' | 'success' | 'warning'
      verifiedAt: string | null
    }
    stripeSyncIntegrity: {
      attributedPayments: number
      commissionCreationRate: number
      metadataCoverageRate: number
      totalTrackedPayments: number
    }
  }
}

export type AdminAffiliateLeaderboardStatus = 'active' | 'rising' | 'top_performer'

export interface AdminAffiliateTopRecord {
  id: string
  lastPayoutDate: string | null
  maskedEmail: string
  payoutEligible: boolean
  pendingBalanceUsd: number
  rank: number
  referralCode: string
  status: AdminAffiliateLeaderboardStatus
  totalEarnedUsd: number
  totalPaidUsd: number
  totalReferrals: number
  userEmail: string
}

export interface AdminAffiliateCommissionRecord {
  affiliateEmail: string
  affiliateUserId: string
  amountUsd: number
  createdAt: string
  eventId: string
  id: string
  paidAt: string | null
  referredEmail: string
  referredUserId: string
  source: string
  status: AffiliateCommissionStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

export interface ContactMessageRecord {
  id: string
  user_id: string
  email: string
  subject: string
  message: string
  status: string
  created_at: string
}

export interface AdminNotificationEventInfo {
  event: string
  label: string
  recipientType: 'user' | 'admin'
  configurable: boolean
  enabled: boolean
}

export interface AdminNotificationSettings {
  adminRecipientsOverride: string[]
  effectiveAdminRecipients: string[]
  enabledEvents: Record<string, boolean>
}

export interface AdminNotificationEventsResponse {
  events: AdminNotificationEventInfo[]
  sample_payloads: Record<string, Record<string, unknown>>
  settings: AdminNotificationSettings
}

export interface AdminNotificationActivityRecord {
  id: string
  event: string
  entity_id: string
  recipient: string
  type: 'user' | 'admin'
  status: string
  error: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
  user_id: string | null
  payload: Record<string, unknown>
}

export interface AdminNotificationPreviewResponse {
  preview: {
    event: string
    html: string
    payload: Record<string, unknown>
    recipients: string[]
    subject: string
  }
}

export interface AdminNotificationTestResponse {
  result: {
    delivered: number
    recipients: string[]
    skipped: number
    subject?: string
    success: boolean
  }
}

export interface AdminNotificationRetryResponse {
  result: {
    results: Array<{ id: string; skipped?: boolean; success: boolean }>
    total: number
  }
}

export interface AdminAnalyticsOverview {
  conversionSnapshot: {
    conversionRate: number
    conversions: number
    sessionsStarted: number
    trialUsers: number
    upgradeClicks: number
  }
  overview: {
    activeVisitors: number
    avgSessionDurationSeconds: number
    bounceRate: number
    pageviews: number
    sessions: number
    visitors: number
  }
  range: {
    endAt: number
    startAt: number
  }
}

export interface AdminAnalyticsPageRow {
  avgTimeSeconds: number
  bounceRate: number
  pageviews: number
  path: string
  sessions: number
  share: number
  visitors: number
}

export interface AdminAnalyticsEventMetric {
  count: number
  visitors: number
}

export interface AdminAnalyticsEvents {
  conversionRate: number
  featureUsage: {
    amplifier_used: AdminAnalyticsEventMetric
    anti_blue_light_enabled: AdminAnalyticsEventMetric
    night_mode_enabled: AdminAnalyticsEventMetric
  }
  funnel: {
    start_session: AdminAnalyticsEventMetric
    subscription_started: AdminAnalyticsEventMetric
    upgrade_click: AdminAnalyticsEventMetric
  }
  totals: {
    events: number
    uniqueEvents: number
    visits: number
    visitors: number
  }
}

export interface AdminAnalyticsTimeseries {
  labels: string[]
  pageviews: number[]
  sessions: number[]
  visitors: number[]
}

function buildAnalyticsQuery(range?: { endAt?: number; startAt?: number }) {
  const searchParams = new URLSearchParams()

  if (range?.startAt) {
    searchParams.set('startAt', String(range.startAt))
  }

  if (range?.endAt) {
    searchParams.set('endAt', String(range.endAt))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function buildAffiliateQuery(filters?: {
  endAt?: string
  startAt?: string
  status?: 'all' | AffiliateCommissionStatus
}) {
  const searchParams = new URLSearchParams()

  if (filters?.startAt) {
    searchParams.set('startAt', filters.startAt)
  }

  if (filters?.endAt) {
    searchParams.set('endAt', filters.endAt)
  }

  if (filters?.status) {
    searchParams.set('status', filters.status)
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export async function getAdminOverview(token: string) {
  return apiRequest<{ overview: AdminOverview }>('/api/admin/users/overview', undefined, token)
}

export async function getAdminUsers(token: string) {
  return apiRequest<{ users: AdminUserRecord[] }>('/api/admin/users', undefined, token)
}

export async function getAdminOrders(token: string) {
  return apiRequest<{ orders: AdminStripeRecord[] }>(
    '/api/admin/stripe/orders',
    undefined,
    token,
  )
}

export async function archiveAdminOrders(stripeSubscriptionIds: string[], token: string) {
  return apiRequest<{
    archived: string[]
    orders: AdminStripeRecord[]
  }>(
    '/api/admin/stripe/orders/archive',
    {
      method: 'POST',
      body: JSON.stringify({ stripeSubscriptionIds }),
    },
    token,
  )
}

export async function getAdminSubscribers(token: string) {
  return apiRequest<{ subscribers: AdminStripeRecord[] }>(
    '/api/admin/stripe/subscribers',
    undefined,
    token,
  )
}

export async function getAdminAffiliatesOverview(
  token: string,
  filters?: {
    endAt?: string
    startAt?: string
    status?: 'all' | AffiliateCommissionStatus
  },
) {
  return apiRequest<{
    affiliates: AdminAffiliatePerformanceRecord[]
    overview: AdminAffiliateOverviewCard
  }>(`/api/admin/affiliates/overview${buildAffiliateQuery(filters)}`, undefined, token)
}

export async function getAdminAffiliateSummary(token: string) {
  return apiRequest<AdminAffiliateSummaryResponse>('/v1/admin/affiliates/summary', undefined, token)
}

export async function getAdminTopAffiliates(token: string) {
  return apiRequest<{ affiliates: AdminAffiliateTopRecord[] }>('/v1/admin/affiliates/top', undefined, token)
}

export async function getAdminAffiliateCommissions(
  token: string,
  filters?: {
    endAt?: string
    startAt?: string
    status?: 'all' | AffiliateCommissionStatus
  },
) {
  return apiRequest<{ commissions: AdminAffiliateCommissionRecord[] }>(
    `/api/admin/affiliates/commissions${buildAffiliateQuery(filters)}`,
    undefined,
    token,
  )
}

export async function markAdminAffiliateCommissionsPaid(commissionIds: string[], token: string) {
  return apiRequest<{
    commissions: AdminAffiliateCommissionRecord[]
    totalPayoutAmountUsd: number
    updatedIds: string[]
  }>(
    '/api/admin/affiliates/commissions/mark-paid',
    {
      method: 'POST',
      body: JSON.stringify({ commissionIds }),
    },
    token,
  )
}

export async function downloadAdminAffiliateCsv(
  token: string,
  filters?: {
    endAt?: string
    startAt?: string
    status?: 'all' | AffiliateCommissionStatus
  },
) {
  const response = await fetch(`${apiBaseUrl}/api/admin/affiliates/export.csv${buildAffiliateQuery(filters)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? 'Unable to download affiliate CSV.')
  }

  return response.blob()
}

export async function getAdminMuxAssets(token: string) {
  return apiRequest<{ assets: AdminMuxAsset[] }>('/api/admin/mux/assets', undefined, token)
}

export async function getAdminMuxStats(token: string) {
  return apiRequest<{ stats: AdminMuxStats }>('/api/admin/mux/stats', undefined, token)
}

export async function createAdminMuxUpload(token: string, title?: string) {
  return apiRequest<{
    upload: {
      upload_id: string
      upload_url: string | null
      status: string
    }
  }>(
    '/api/admin/mux/upload',
    {
      method: 'POST',
      body: JSON.stringify({ title }),
    },
    token,
  )
}

export async function getAdminMuxPlaybackToken(assetId: string, token: string) {
  return apiRequest<{
    playback: {
      asset_id: string
      playback_id: string
      expires_in_minutes: number
      signed_url: string
      token: string
    }
  }>(`/api/admin/mux/playback-token?assetId=${encodeURIComponent(assetId)}`, undefined, token)
}

export async function getAdminMessages(token: string) {
  return apiRequest<{ messages: ContactMessageRecord[] }>('/api/admin/messages', undefined, token)
}

export async function getAdminNotificationEvents(token: string) {
  return apiRequest<AdminNotificationEventsResponse>('/api/admin/notifications/events', undefined, token)
}

export async function getAdminNotificationActivity(token: string) {
  return apiRequest<{ activity: AdminNotificationActivityRecord[] }>(
    '/api/admin/notifications/activity',
    undefined,
    token,
  )
}

export async function getAdminAnalyticsOverview(
  token: string,
  range?: { endAt?: number; startAt?: number },
) {
  return apiRequest<{ overview: AdminAnalyticsOverview }>(
    `/api/admin/analytics/overview${buildAnalyticsQuery(range)}`,
    undefined,
    token,
  )
}

export async function getAdminAnalyticsPages(
  token: string,
  range?: { endAt?: number; startAt?: number },
) {
  return apiRequest<{ pages: AdminAnalyticsPageRow[] }>(
    `/api/admin/analytics/pages${buildAnalyticsQuery(range)}`,
    undefined,
    token,
  )
}

export async function getAdminAnalyticsEvents(
  token: string,
  range?: { endAt?: number; startAt?: number },
) {
  return apiRequest<{ events: AdminAnalyticsEvents }>(
    `/api/admin/analytics/events${buildAnalyticsQuery(range)}`,
    undefined,
    token,
  )
}

export async function getAdminAnalyticsTimeseries(
  token: string,
  range?: { endAt?: number; startAt?: number },
) {
  return apiRequest<{ timeseries: AdminAnalyticsTimeseries }>(
    `/api/admin/analytics/timeseries${buildAnalyticsQuery(range)}`,
    undefined,
    token,
  )
}

export async function previewAdminNotification(
  payload: {
    event: string
    payload?: Record<string, unknown>
    recipientOverride?: string[]
  },
  token: string,
) {
  return apiRequest<AdminNotificationPreviewResponse>(
    '/api/admin/notifications/preview',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function sendAdminNotificationTest(
  payload: {
    event: string
    messageOverride?: string
    payload?: Record<string, unknown>
    recipientOverride?: string[]
  },
  token: string,
) {
  return apiRequest<AdminNotificationTestResponse>(
    '/api/admin/notifications/test',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function retryAdminNotifications(payload: { ids?: string[] }, token: string) {
  return apiRequest<AdminNotificationRetryResponse>(
    '/api/admin/notifications/retry',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function updateAdminNotificationSettings(
  payload: {
    adminRecipientsOverride?: string[]
    enabledEvents?: Record<string, boolean>
  },
  token: string,
) {
  return apiRequest<{ settings: AdminNotificationSettings }>(
    '/api/admin/notifications/settings',
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function createContactMessage(
  payload: { email: string; message: string; name: string },
  token: string,
) {
  return apiRequest<{
    delivery_email: string
    emailDelivered: boolean
    message: ContactMessageRecord | null
    ok: true
  }>(
    '/api/contact',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export interface SeoMetadataPayload {
  canonicalUrl: string | null
  description: string
  follow: boolean
  index: boolean
  keywords: string[]
  og: {
    description?: string
    image?: string
    title?: string
    type?: string
    url?: string
  }
  path: string
  priority: number
  routeType: 'landing' | 'conversion' | 'support'
  title: string
}

export interface SeoAuditIssue {
  code: string
  currentValue?: string | null
  message: string
  severity: 'critical' | 'improve' | 'good'
}

export interface SeoAuditPageResult {
  description: string
  h1: string | null
  h2: string | null
  issues: SeoAuditIssue[]
  openGraph: SeoMetadataPayload['og']
  path: string
  score: number
  title: string
}

export interface SeoAuditResult {
  createdAt: string
  id: string
  issuesBySeverity: Record<'critical' | 'improve' | 'good', SeoAuditIssue[]>
  pages: SeoAuditPageResult[]
  score: number
  targetScope: string
}

export interface SeoOptimizationSuggestion extends Omit<SeoMetadataPayload, 'og'> {
  og: SeoMetadataPayload['og']
  reason: string
}

export interface SeoOptimizationResponse {
  actions: SeoOptimizationSuggestion[]
  confidence: number
  summary: string
}

export interface SeoActionRecord {
  actionType: 'apply' | 'rollback'
  afterSnapshot: SeoMetadataPayload
  beforeSnapshot: SeoMetadataPayload
  createdAt: string
  id: string
  initiatedBy: string | null
  pageUrl: string
  reasoning: string
}

export interface SeoReportRecord {
  createdAt: string
  error: string | null
  fullReportJson: {
    actions: Array<{
      after: SeoMetadataPayload
      before: SeoMetadataPayload
      page: string
      reason: string
    }>
    confidence: number
    impact: string
    keywordAlignment: string
    reasoning: string
    summary: string
  }
  id: string
  relatedActionIds: string[]
  status: 'pending' | 'complete' | 'failed'
  summary: string
  updatedAt: string
}

export interface SeoOverviewResponse {
  latestAudit: SeoAuditResult | null
  managedRoutes: number
  recentReports: SeoReportRecord[]
  seoScore: number
}

export async function getAdminSeoOverview(token: string) {
  return apiRequest<SeoOverviewResponse>('/api/admin/seo/overview', undefined, token)
}

export async function getAdminSeoAudits(token: string) {
  return apiRequest<{ audits: SeoAuditResult[] }>('/api/admin/seo/audits', undefined, token)
}

export async function getAdminSeoLatestAudit(token: string) {
  return apiRequest<{ audit: SeoAuditResult | null }>('/api/admin/seo/audits/latest', undefined, token)
}

export async function runAdminSeoAudit(
  payload: {
    fullSite?: boolean
    paths?: string[]
  },
  token: string,
) {
  return apiRequest<{ audit: SeoAuditResult }>(
    '/api/admin/seo/audit',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function optimizeAdminSeo(
  payload: {
    fullSite?: boolean
    paths?: string[]
  },
  token: string,
) {
  return apiRequest<SeoOptimizationResponse>(
    '/api/admin/seo/optimize',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function applyAdminSeoChanges(
  payload: {
    changes: SeoOptimizationSuggestion[]
  },
  token: string,
) {
  return apiRequest<{
    actions: SeoActionRecord[]
    report: SeoReportRecord | null
    reportError: string | null
  }>(
    '/api/admin/seo/apply',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token,
  )
}

export async function rollbackAdminSeoAction(actionId: string, token: string) {
  return apiRequest<{
    action: SeoActionRecord
    report: SeoReportRecord | null
    reportError: string | null
  }>(`/api/admin/seo/rollback/${encodeURIComponent(actionId)}`, { method: 'POST' }, token)
}

export async function getAdminSeoReports(token: string) {
  return apiRequest<{ reports: SeoReportRecord[] }>('/api/admin/seo/reports', undefined, token)
}

export async function getAdminSeoReport(reportId: string, token: string) {
  return apiRequest<{ report: SeoReportRecord }>(
    `/api/admin/seo/reports/${encodeURIComponent(reportId)}`,
    undefined,
    token,
  )
}

export async function downloadAdminSeoReportPdf(reportId: string, token: string) {
  const response = await fetch(`${apiBaseUrl}/api/admin/seo/reports/${encodeURIComponent(reportId)}/pdf`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(payload.error ?? 'Unable to download SEO report PDF.')
  }

  return response.blob()
}
