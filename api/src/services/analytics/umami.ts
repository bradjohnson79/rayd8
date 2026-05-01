import { env } from '../../env.js'

const CACHE_TTL_MS = 60_000
const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000
const KNOWN_FUNNEL_EVENTS = ['start_session', 'upgrade_click', 'subscription_started'] as const
const KNOWN_FEATURE_EVENTS = [
  'night_mode_enabled',
  'anti_blue_light_enabled',
  'amplifier_used',
] as const
const KNOWN_EVENT_NAMES = [...KNOWN_FUNNEL_EVENTS, ...KNOWN_FEATURE_EVENTS] as const

type FunnelEventName = (typeof KNOWN_FUNNEL_EVENTS)[number]
type FeatureEventName = (typeof KNOWN_FEATURE_EVENTS)[number]
type KnownEventName = (typeof KNOWN_EVENT_NAMES)[number]
type TimeUnit = 'hour' | 'day' | 'month' | 'year'

interface CachedValue<T> {
  expiresAt: number
  value: Promise<T>
}

interface AnalyticsRangeInput {
  endAt?: number
  startAt?: number
}

interface AnalyticsRange {
  endAt: number
  startAt: number
  timezone: string
  unit: TimeUnit
}

interface UmamiStatsResponse {
  bounces: number
  pageviews: number
  totaltime: number
  visits: number
  visitors: number
}

interface UmamiPageviewsResponse {
  pageviews: Array<{ x: string; y: number }>
  sessions: Array<{ x: string; y: number }>
}

interface UmamiExpandedMetricRow {
  bounces: number
  name: string
  pageviews: number
  totaltime: number
  visits: number
  visitors: number
}

interface UmamiMetricRow {
  x: string
  y: number
}

interface UmamiEventSeriesRow {
  t: string
  x: string
  y: number
}

interface UmamiEventStatsResponse {
  data: {
    events: number
    uniqueEvents: number
    visits: number
    visitors: number
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
  range: Pick<AnalyticsRange, 'endAt' | 'startAt'>
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
  featureUsage: Record<FeatureEventName, AdminAnalyticsEventMetric>
  funnel: Record<FunnelEventName, AdminAnalyticsEventMetric>
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

const cache = new Map<string, CachedValue<unknown>>()

export class AnalyticsUnavailableError extends Error {
  constructor(message = 'Analytics temporarily unavailable') {
    super(message)
    this.name = 'AnalyticsUnavailableError'
  }
}

export class AnalyticsRangeError extends Error {
  constructor(message = 'Invalid analytics date range.') {
    super(message)
    this.name = 'AnalyticsRangeError'
  }
}

function getTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function getCacheKey(endpoint: string, params?: Record<string, unknown>) {
  return `${endpoint}:${JSON.stringify(params ?? {})}`
}

function getBaseUrl() {
  const baseUrl = env.UMAMI_BASE_URL?.trim()

  if (!baseUrl) {
    throw new AnalyticsUnavailableError()
  }

  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

function getWebsiteId() {
  const websiteId = env.UMAMI_WEBSITE_ID?.trim()

  if (!websiteId) {
    throw new AnalyticsUnavailableError()
  }

  return websiteId
}

function getApiKey() {
  const apiKey = env.UMAMI_API_KEY?.trim()

  if (!apiKey) {
    throw new AnalyticsUnavailableError()
  }

  return apiKey
}

function resolveRange(input: AnalyticsRangeInput = {}): AnalyticsRange {
  const endAt = Number.isFinite(input.endAt) ? Number(input.endAt) : Date.now()
  const startAt = Number.isFinite(input.startAt)
    ? Number(input.startAt)
    : Math.max(0, endAt - DEFAULT_RANGE_MS)

  if (startAt <= 0 || endAt <= 0 || endAt <= startAt) {
    throw new AnalyticsRangeError()
  }

  const diffMs = endAt - startAt
  let unit: TimeUnit = 'day'

  if (diffMs <= 2 * 24 * 60 * 60 * 1000) {
    unit = 'hour'
  } else if (diffMs > 180 * 24 * 60 * 60 * 1000 && diffMs <= 730 * 24 * 60 * 60 * 1000) {
    unit = 'month'
  } else if (diffMs > 730 * 24 * 60 * 60 * 1000) {
    unit = 'year'
  }

  return {
    startAt,
    endAt,
    timezone: getTimezone(),
    unit,
  }
}

function normalizePercentage(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }

  return Number(value.toFixed(4))
}

function formatLabel(timestamp: string, unit: TimeUnit) {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return timestamp
  }

  const formatter =
    unit === 'hour'
      ? new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
        })
      : unit === 'month'
        ? new Intl.DateTimeFormat('en-US', {
            month: 'short',
            year: 'numeric',
          })
        : unit === 'year'
          ? new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
            })
          : new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
            })

  return formatter.format(date)
}

async function fetchUmami<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
  const cacheKey = getCacheKey(endpoint, params)
  const cached = cache.get(cacheKey) as CachedValue<T> | undefined

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const request = (async () => {
    const url = new URL(endpoint.replace(/^\//, ''), getBaseUrl())

    for (const [key, value] of Object.entries(params ?? {})) {
      if (value === undefined || value === null || value === '') {
        continue
      }

      url.searchParams.set(key, String(value))
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new AnalyticsUnavailableError()
    }

    return (await response.json()) as T
  })()

  cache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: request,
  })

  try {
    return await request
  } catch (error) {
    cache.delete(cacheKey)
    throw error
  }
}

function getKnownMetricMap(
  counts: Partial<Record<KnownEventName, number>>,
  visitors: Partial<Record<KnownEventName, number>>,
) {
  return KNOWN_EVENT_NAMES.reduce(
    (result, eventName) => ({
      ...result,
      [eventName]: {
        count: counts[eventName] ?? 0,
        visitors: visitors[eventName] ?? 0,
      },
    }),
    {} as Record<KnownEventName, AdminAnalyticsEventMetric>,
  )
}

export function isUmamiConfigured() {
  return Boolean(env.UMAMI_API_KEY && env.UMAMI_BASE_URL && env.UMAMI_WEBSITE_ID)
}

export async function getOverview(rangeInput?: AnalyticsRangeInput): Promise<AdminAnalyticsOverview> {
  const range = resolveRange(rangeInput)
  const websiteId = getWebsiteId()

  const [stats, activeVisitors, events] = await Promise.all([
    fetchUmami<UmamiStatsResponse>(`api/websites/${websiteId}/stats`, {
      startAt: range.startAt,
      endAt: range.endAt,
    }),
    fetchUmami<{ visitors: number }>(`api/websites/${websiteId}/active`),
    getEvents(range),
  ])

  return {
    range: {
      startAt: range.startAt,
      endAt: range.endAt,
    },
    overview: {
      activeVisitors: activeVisitors.visitors ?? 0,
      avgSessionDurationSeconds:
        stats.visits > 0 ? Math.round((stats.totaltime / stats.visits) * 10) / 10 : 0,
      bounceRate: normalizePercentage(stats.visits > 0 ? stats.bounces / stats.visits : 0),
      pageviews: stats.pageviews ?? 0,
      sessions: stats.visits ?? 0,
      visitors: stats.visitors ?? 0,
    },
    conversionSnapshot: {
      trialUsers: events.funnel.start_session.visitors,
      sessionsStarted: events.funnel.start_session.count,
      upgradeClicks: events.funnel.upgrade_click.count,
      conversions: events.funnel.subscription_started.count,
      conversionRate: events.conversionRate,
    },
  }
}

export async function getTopPages(rangeInput?: AnalyticsRangeInput): Promise<AdminAnalyticsPageRow[]> {
  const range = resolveRange(rangeInput)
  const websiteId = getWebsiteId()
  const [stats, pages] = await Promise.all([
    fetchUmami<UmamiStatsResponse>(`api/websites/${websiteId}/stats`, {
      startAt: range.startAt,
      endAt: range.endAt,
    }),
    fetchUmami<UmamiExpandedMetricRow[]>(`api/websites/${websiteId}/metrics/expanded`, {
      startAt: range.startAt,
      endAt: range.endAt,
      type: 'path',
      limit: 10,
    }),
  ])

  return pages.map((page) => ({
    path: page.name || '/',
    pageviews: page.pageviews ?? 0,
    visitors: page.visitors ?? 0,
    sessions: page.visits ?? 0,
    bounceRate: normalizePercentage(page.visits > 0 ? page.bounces / page.visits : 0),
    avgTimeSeconds: page.visits > 0 ? Math.round((page.totaltime / page.visits) * 10) / 10 : 0,
    share: normalizePercentage(stats.pageviews > 0 ? page.pageviews / stats.pageviews : 0),
  }))
}

export async function getEvents(rangeInput?: AnalyticsRangeInput): Promise<AdminAnalyticsEvents> {
  const range = resolveRange(rangeInput)
  const websiteId = getWebsiteId()

  const [eventSeries, eventVisitors, eventStats] = await Promise.all([
    fetchUmami<UmamiEventSeriesRow[]>(`api/websites/${websiteId}/events/series`, {
      startAt: range.startAt,
      endAt: range.endAt,
      unit: range.unit,
      timezone: range.timezone,
    }),
    fetchUmami<UmamiMetricRow[]>(`api/websites/${websiteId}/metrics`, {
      startAt: range.startAt,
      endAt: range.endAt,
      type: 'event',
      limit: 500,
    }),
    fetchUmami<UmamiEventStatsResponse>(`api/websites/${websiteId}/events/stats`, {
      startAt: range.startAt,
      endAt: range.endAt,
    }),
  ])

  const counts = eventSeries.reduce(
    (result, row) => {
      const eventName = row.x as KnownEventName

      if (KNOWN_EVENT_NAMES.includes(eventName)) {
        result[eventName] = (result[eventName] ?? 0) + (row.y ?? 0)
      }

      return result
    },
    {} as Partial<Record<KnownEventName, number>>,
  )

  const visitors = eventVisitors.reduce(
    (result, row) => {
      const eventName = row.x as KnownEventName

      if (KNOWN_EVENT_NAMES.includes(eventName)) {
        result[eventName] = row.y ?? 0
      }

      return result
    },
    {} as Partial<Record<KnownEventName, number>>,
  )

  const eventMetricMap = getKnownMetricMap(counts, visitors)
  const upgradeClicks = eventMetricMap.upgrade_click.count
  const conversions = eventMetricMap.subscription_started.count

  return {
    conversionRate: normalizePercentage(upgradeClicks > 0 ? conversions / upgradeClicks : 0),
    funnel: {
      start_session: eventMetricMap.start_session,
      upgrade_click: eventMetricMap.upgrade_click,
      subscription_started: eventMetricMap.subscription_started,
    },
    featureUsage: {
      night_mode_enabled: eventMetricMap.night_mode_enabled,
      anti_blue_light_enabled: eventMetricMap.anti_blue_light_enabled,
      amplifier_used: eventMetricMap.amplifier_used,
    },
    totals: {
      events: eventStats.data?.events ?? 0,
      uniqueEvents: eventStats.data?.uniqueEvents ?? 0,
      visits: eventStats.data?.visits ?? 0,
      visitors: eventStats.data?.visitors ?? 0,
    },
  }
}

export async function getTimeseries(
  rangeInput?: AnalyticsRangeInput,
): Promise<AdminAnalyticsTimeseries> {
  const range = resolveRange(rangeInput)
  const websiteId = getWebsiteId()
  const pageviews = await fetchUmami<UmamiPageviewsResponse>(`api/websites/${websiteId}/pageviews`, {
    startAt: range.startAt,
    endAt: range.endAt,
    unit: range.unit,
    timezone: range.timezone,
  })

  const labels = pageviews.pageviews.map((row) => formatLabel(row.x, range.unit))
  const visitorTrend = pageviews.pageviews.map((row) => row.y ?? 0)
  const sessionTrend = pageviews.sessions.map((row) => row.y ?? 0)

  return {
    labels,
    // Umami exposes pageview + session series here; we mirror pageviews into the visitor slot
    // so the frontend can render the requested two-line trend without extra client-side remapping.
    visitors: visitorTrend,
    pageviews: visitorTrend,
    sessions: sessionTrend,
  }
}
