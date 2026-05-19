import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { AdminStatCard } from '../../../components/AdminStatCard'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  getAdminAnalyticsEvents,
  getAdminAnalyticsOverview,
  getAdminAnalyticsPages,
  getAdminAnalyticsTimeseries,
  type AdminAnalyticsEvents,
  type AdminAnalyticsOverview,
  type AdminAnalyticsPageRow,
  type AdminAnalyticsTimeseries,
} from '../../../services/admin'

type RangePreset = '24h' | '7d' | '30d'
type AccordionId =
  | 'top-pages'
  | 'conversion-funnel'
  | 'seo-health'
  | 'keyword-intelligence'
  | 'backlinks-referrals'
  | 'affiliate-intelligence'
  | 'growth-strategy'

type AccordionState = Record<AccordionId, boolean>

interface Insight {
  detail: string
  title: string
}

interface FunnelStage {
  count: number | null
  label: string
}

interface GrowthRecommendation {
  action: string
  happened: string
  opportunity: string
  risk: string
}

const RANGE_OPTIONS: Array<{ durationMs: number; id: RangePreset; label: string }> = [
  { id: '24h', label: 'Last 24h', durationMs: 24 * 60 * 60 * 1000 },
  { id: '7d', label: 'Last 7 days', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: 'Last 30 days', durationMs: 30 * 24 * 60 * 60 * 1000 },
]
const ACCORDION_STORAGE_KEY = 'rayd8_admin_analytics_accordions_v1'
const defaultAccordionState: AccordionState = {
  'affiliate-intelligence': false,
  'backlinks-referrals': false,
  'conversion-funnel': false,
  'growth-strategy': false,
  'keyword-intelligence': false,
  'seo-health': false,
  'top-pages': false,
}

const emptyOverview: AdminAnalyticsOverview = {
  conversionSnapshot: {
    conversionRate: 0,
    conversions: 0,
    sessionsStarted: 0,
    trialUsers: 0,
    upgradeClicks: 0,
  },
  overview: {
    activeVisitors: 0,
    avgSessionDurationSeconds: 0,
    bounceRate: 0,
    pageviews: 0,
    sessions: 0,
    visitors: 0,
  },
  range: {
    endAt: 0,
    startAt: 0,
  },
}

const emptyEvents: AdminAnalyticsEvents = {
  conversionRate: 0,
  featureUsage: {
    amplifier_used: { count: 0, visitors: 0 },
    anti_blue_light_enabled: { count: 0, visitors: 0 },
    night_mode_enabled: { count: 0, visitors: 0 },
  },
  funnel: {
    start_session: { count: 0, visitors: 0 },
    subscription_started: { count: 0, visitors: 0 },
    upgrade_click: { count: 0, visitors: 0 },
  },
  totals: {
    events: 0,
    uniqueEvents: 0,
    visits: 0,
    visitors: 0,
  },
}

const emptyTimeseries: AdminAnalyticsTimeseries = {
  labels: [],
  pageviews: [],
  sessions: [],
  visitors: [],
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(value >= 0.1 ? 1 : 2)}%`
}

function formatDurationSeconds(value: number) {
  if (value < 60) {
    return `${value.toFixed(1)}s`
  }

  const minutes = Math.floor(value / 60)
  const seconds = Math.round(value % 60)
  return `${minutes}m ${seconds}s`
}

function getRangeValues(preset: RangePreset) {
  const now = Date.now()
  const option = RANGE_OPTIONS.find((entry) => entry.id === preset) ?? RANGE_OPTIONS[1]

  return {
    startAt: now - option.durationMs,
    endAt: now,
  }
}

function LoadingSurface({ label }: { label: string }) {
  return (
    <div className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 text-sm text-slate-300 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
      {label}
    </div>
  )
}

function EmptySurface({ message, title }: { message: string; title: string }) {
  return (
    <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{title}</p>
      <p className="mt-3 text-sm leading-7 text-slate-300">{message}</p>
    </div>
  )
}

function getInitialAccordionState(): AccordionState {
  if (typeof window === 'undefined') {
    return defaultAccordionState
  }

  try {
    const stored = window.localStorage.getItem(ACCORDION_STORAGE_KEY)

    if (!stored) {
      return defaultAccordionState
    }

    const parsed = JSON.parse(stored) as Partial<Record<AccordionId, unknown>>

    return {
      ...defaultAccordionState,
      'affiliate-intelligence': parsed['affiliate-intelligence'] === true,
      'backlinks-referrals': parsed['backlinks-referrals'] === true,
      'conversion-funnel': parsed['conversion-funnel'] === true,
      'growth-strategy': parsed['growth-strategy'] === true,
      'keyword-intelligence': parsed['keyword-intelligence'] === true,
      'seo-health': parsed['seo-health'] === true,
      'top-pages': parsed['top-pages'] === true,
    }
  } catch {
    return defaultAccordionState
  }
}

function GrowthAccordion({
  children,
  description,
  open,
  onToggle,
  title,
}: {
  children: ReactNode
  description: string
  open: boolean
  onToggle: () => void
  title: string
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.05] shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
      <button
        aria-expanded={open}
        className="flex w-full flex-col gap-4 px-5 py-5 text-left transition hover:bg-white/[0.035] sm:flex-row sm:items-center sm:justify-between sm:px-6"
        onClick={onToggle}
        type="button"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/60">
            Growth Intelligence
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
        </div>
        <span className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-200">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      <div
        className={[
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        ].join(' ')}
      >
        <div className="min-h-0 overflow-hidden">
          {open ? <div className="border-t border-white/8 px-5 py-5 sm:px-6">{children}</div> : null}
        </div>
      </div>
    </section>
  )
}

function InsightBlock({ insights, title }: { insights: Insight[]; title: string }) {
  return (
    <div className="rounded-[1.5rem] border border-emerald-200/15 bg-emerald-300/[0.055] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.14)] sm:p-5">
      <p className="text-xs uppercase tracking-[0.26em] text-emerald-100/70">{title}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {insights.map((insight) => (
          <article className="rounded-2xl border border-white/10 bg-black/20 p-4" key={insight.title}>
            <h3 className="text-sm font-semibold text-white">{insight.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{insight.detail}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function EmptyIntelligenceState({ message, title }: { message: string; title: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
      <p className="text-xs uppercase tracking-[0.26em] text-slate-500">{title}</p>
      <p className="mt-3 text-sm leading-7 text-slate-300">{message}</p>
    </div>
  )
}

function getTopPageInsights(pages: AdminAnalyticsPageRow[], overview: AdminAnalyticsOverview) {
  if (!pages.length) {
    return [
      {
        title: 'Waiting for traffic',
        detail: 'Top page intelligence will appear once Umami returns page-performance rows.',
      },
    ]
  }

  const trafficLeader = pages[0]
  const engagementLeader = [...pages].sort((a, b) => b.avgTimeSeconds - a.avgTimeSeconds)[0]
  const bounceLeader = [...pages].sort((a, b) => b.bounceRate - a.bounceRate)[0]
  const hamsaPage = pages.find((page) => page.path.toLowerCase().includes('hamsa'))
  const subscriptionPage = pages.find((page) => page.path.toLowerCase().includes('subscription'))
  const insights: Insight[] = [
    {
      title: 'Traffic winner',
      detail: `${trafficLeader.path} leads traffic with ${formatInteger(trafficLeader.pageviews)} views and ${formatPercent(trafficLeader.share)} share in the selected range.`,
    },
    {
      title: 'Engagement leader',
      detail: `${engagementLeader.path} holds the strongest average time at ${formatDurationSeconds(engagementLeader.avgTimeSeconds)}. Consider using its messaging patterns in higher-traffic areas.`,
    },
  ]

  if (bounceLeader.bounceRate > overview.overview.bounceRate && bounceLeader.pageviews > 0) {
    insights.push({
      title: 'Bounce watch',
      detail: `${bounceLeader.path} has the highest bounce rate at ${formatPercent(bounceLeader.bounceRate)}. Review CTA clarity and above-the-fold trust signals.`,
    })
  }

  if (hamsaPage) {
    insights.push({
      title: 'HAMSA opportunity',
      detail: `${hamsaPage.path} is already visible in traffic leaders. Consider stronger homepage placement if engagement remains above average.`,
    })
  }

  if (subscriptionPage && subscriptionPage.bounceRate > overview.overview.bounceRate) {
    insights.push({
      title: 'Subscription friction',
      detail: `${subscriptionPage.path} bounce is above the site average. Add trust-building copy, testimonials, or clearer plan reassurance near the checkout CTA.`,
    })
  }

  return insights.slice(0, 4)
}

function getFunnelStages(overview: AdminAnalyticsOverview, events: AdminAnalyticsEvents): FunnelStage[] {
  return [
    { label: 'Landing Page', count: overview.overview.visitors },
    { label: 'Subscription Page', count: null },
    { label: 'Signup/Auth', count: null },
    { label: 'Free Trial', count: overview.conversionSnapshot.trialUsers },
    { label: 'REGEN Checkout', count: events.funnel.upgrade_click.count },
    { label: 'Paid Conversion', count: overview.conversionSnapshot.conversions },
  ]
}

function getFunnelInsights(stages: FunnelStage[], overview: AdminAnalyticsOverview) {
  const comparablePairs = stages.flatMap((stage, index) => {
    const next = stages[index + 1]

    if (!next || stage.count === null || next.count === null || stage.count <= 0) {
      return []
    }

    const conversionRate = next.count / stage.count

    return [{ from: stage.label, to: next.label, dropOffRate: 1 - conversionRate }]
  })
  const largestDropOff = comparablePairs.sort((a, b) => b.dropOffRate - a.dropOffRate)[0]

  if (!largestDropOff) {
    return [
      {
        title: 'Funnel data is partial',
        detail: 'Subscription page and signup/auth counts are not exposed by the current analytics API yet, so unavailable stages are shown without invented values.',
      },
    ]
  }

  return [
    {
      title: 'Largest comparable drop-off',
      detail: `${largestDropOff.from} to ${largestDropOff.to} has the largest visible drop-off at ${formatPercent(largestDropOff.dropOffRate)}.`,
    },
    {
      title: 'Upgrade signal',
      detail:
        overview.conversionSnapshot.upgradeClicks > 0
          ? `${formatInteger(overview.conversionSnapshot.upgradeClicks)} upgrade clicks produced ${formatInteger(overview.conversionSnapshot.conversions)} paid conversions.`
          : 'Homepage and trial traffic are present, but upgrade clicks are not yet visible for this range.',
    },
  ]
}

function getGrowthRecommendations(
  pages: AdminAnalyticsPageRow[],
  overview: AdminAnalyticsOverview,
): GrowthRecommendation[] {
  const topPage = pages[0]
  const engagementLeader = pages.length
    ? [...pages].sort((a, b) => b.avgTimeSeconds - a.avgTimeSeconds)[0]
    : null
  const highBouncePage = pages.length
    ? [...pages].sort((a, b) => b.bounceRate - a.bounceRate)[0]
    : null

  return [
    {
      happened: topPage
        ? `${topPage.path} is the current traffic leader with ${formatInteger(topPage.pageviews)} views.`
        : 'Traffic leader data is not available yet.',
      opportunity: topPage
        ? 'Use the winning page as a campaign entry point and strengthen its next-step CTA.'
        : 'Collect more page data before prioritizing traffic plays.',
      risk:
        overview.conversionSnapshot.upgradeClicks > 0
          ? 'Traffic can outpace conversion if subscription intent remains unclear.'
          : 'Upgrade intent is currently weak or unavailable in this range.',
      action: 'Review homepage and subscription CTA placement against the top traffic path.',
    },
    {
      happened: engagementLeader
        ? `${engagementLeader.path} has the strongest engagement at ${formatDurationSeconds(engagementLeader.avgTimeSeconds)} average time.`
        : 'Engagement leader data is not available yet.',
      opportunity: 'Promote high-engagement themes in navigation, email, and social campaign language.',
      risk: highBouncePage
        ? `${highBouncePage.path} may leak attention with ${formatPercent(highBouncePage.bounceRate)} bounce.`
        : 'Bounce risk cannot be isolated until page rows are available.',
      action: 'Pair the engagement winner with a clear REGEN or HAMSA next step.',
    },
  ]
}

function exportPagesCsv(pages: AdminAnalyticsPageRow[]) {
  const rows = [
    ['Path', 'Views', 'Visitors', 'Sessions', 'Bounce', 'Avg Time', 'Share'],
    ...pages.map((page) => [
      page.path,
      String(page.pageviews),
      String(page.visitors),
      String(page.sessions),
      formatPercent(page.bounceRate),
      formatDurationSeconds(page.avgTimeSeconds),
      formatPercent(page.share),
    ]),
  ]
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','),
    )
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `rayd8-top-pages-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function AdminAnalyticsPage() {
  const getAuthToken = useAuthToken()
  const [accordionState, setAccordionState] = useState<AccordionState>(getInitialAccordionState)
  const [activeRange, setActiveRange] = useState<RangePreset>('7d')
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<AdminAnalyticsEvents>(emptyEvents)
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<AdminAnalyticsOverview>(emptyOverview)
  const [pages, setPages] = useState<AdminAnalyticsPageRow[]>([])
  const [timeseries, setTimeseries] = useState<AdminAnalyticsTimeseries>(emptyTimeseries)

  const range = useMemo(() => getRangeValues(activeRange), [activeRange])
  const funnelRows = useMemo(
    () => [
      { label: 'Start session', metric: events.funnel.start_session },
      { label: 'Upgrade click', metric: events.funnel.upgrade_click },
      { label: 'Subscription started', metric: events.funnel.subscription_started },
    ],
    [events.funnel],
  )
  const featureRows = useMemo(
    () => [
      { label: 'Night mode enabled', metric: events.featureUsage.night_mode_enabled },
      { label: 'Anti-blue light enabled', metric: events.featureUsage.anti_blue_light_enabled },
      { label: 'Amplifier used', metric: events.featureUsage.amplifier_used },
    ],
    [events.featureUsage],
  )
  const chartData = useMemo(
    () =>
      timeseries.labels.map((label, index) => ({
        label,
        pageviews: timeseries.pageviews[index] ?? 0,
        sessions: timeseries.sessions[index] ?? 0,
        visitors: timeseries.visitors[index] ?? 0,
      })),
    [timeseries],
  )
  const topPageInsights = useMemo(() => getTopPageInsights(pages, overview), [overview, pages])
  const funnelStages = useMemo(() => getFunnelStages(overview, events), [events, overview])
  const funnelInsights = useMemo(() => getFunnelInsights(funnelStages, overview), [funnelStages, overview])
  const growthRecommendations = useMemo(
    () => getGrowthRecommendations(pages, overview),
    [overview, pages],
  )

  function toggleAccordion(id: AccordionId) {
    setAccordionState((current) => {
      const next = { ...current, [id]: !current[id] }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ACCORDION_STORAGE_KEY, JSON.stringify(next))
      }

      return next
    })
  }

  useEffect(() => {
    let cancelled = false

    async function loadAnalytics() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for admin analytics.')
        }

        const [overviewResponse, pagesResponse, eventsResponse, timeseriesResponse] =
          await Promise.all([
            getAdminAnalyticsOverview(token, range),
            getAdminAnalyticsPages(token, range),
            getAdminAnalyticsEvents(token, range),
            getAdminAnalyticsTimeseries(token, range),
          ])

        if (!cancelled) {
          setOverview(overviewResponse.overview)
          setPages(pagesResponse.pages)
          setEvents(eventsResponse.events)
          setTimeseries(timeseriesResponse.timeseries)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : 'Analytics temporarily unavailable.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadAnalytics()

    return () => {
      cancelled = true
    }
  }, [getAuthToken, range])

  return (
    <AdminPageShell
      aside={
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Range control</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => {
              const active = option.id === activeRange

              return (
                <button
                  className={[
                    'rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] transition',
                    active
                      ? 'border border-emerald-200/45 bg-emerald-400/18 text-white'
                      : 'border border-white/12 bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white',
                  ].join(' ')}
                  key={option.id}
                  onClick={() => setActiveRange(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Cached for 60 seconds on the API to keep repeated admin refreshes responsive without
            mixing date ranges.
          </p>
        </div>
      }
      description="Monitor traffic, trial-to-upgrade movement, and feature engagement from a single Umami-backed admin surface."
      eyebrow="Admin tools"
      title="Analytics"
    >
      {error ? (
        <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-emerald-200/18 bg-[linear-gradient(160deg,rgba(16,185,129,0.14),rgba(7,14,24,0.95))] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/70">
          Conversion Snapshot
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <p className="text-sm text-slate-300">Trial users</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {loading ? '...' : formatInteger(overview.conversionSnapshot.trialUsers)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-300">Sessions started</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {loading ? '...' : formatInteger(overview.conversionSnapshot.sessionsStarted)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-300">Upgrade clicks</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {loading ? '...' : formatInteger(overview.conversionSnapshot.upgradeClicks)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-300">Conversions</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {loading ? '...' : formatInteger(overview.conversionSnapshot.conversions)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-300">Conversion %</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {loading ? '...' : formatPercent(overview.conversionSnapshot.conversionRate)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          detail={loading ? 'Loading visitor totals...' : 'Unique visitors in the selected range.'}
          label="Visitors"
          value={loading ? '...' : formatInteger(overview.overview.visitors)}
        />
        <AdminStatCard
          detail={loading ? 'Loading pageview totals...' : 'Total page views recorded by Umami.'}
          label="Page Views"
          value={loading ? '...' : formatInteger(overview.overview.pageviews)}
        />
        <AdminStatCard
          detail={loading ? 'Loading session totals...' : 'Sessions captured in the selected range.'}
          label="Sessions"
          value={loading ? '...' : formatInteger(overview.overview.sessions)}
        />
        <AdminStatCard
          detail={
            loading
              ? 'Loading bounce rate and duration...'
              : `Active visitors now: ${formatInteger(overview.overview.activeVisitors)}`
          }
          label="Bounce Rate"
          value={loading ? '...' : formatPercent(overview.overview.bounceRate)}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.8fr)]">
        <div className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Traffic graph</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Visitors and sessions</h2>
            </div>
            <p className="text-sm text-slate-300">
              Avg session length:{' '}
              <span className="font-medium text-white">
                {loading ? '...' : formatDurationSeconds(overview.overview.avgSessionDurationSeconds)}
              </span>
            </p>
          </div>

          {loading ? (
            <div className="mt-6 h-[320px] rounded-[1.5rem] border border-white/8 bg-black/20" />
          ) : chartData.length ? (
            <div className="mt-6 h-[320px]">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="label" stroke="rgba(226,232,240,0.56)" tickLine={false} />
                  <YAxis
                    allowDecimals={false}
                    stroke="rgba(226,232,240,0.56)"
                    tickFormatter={(value: number) => formatInteger(value)}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(4, 9, 17, 0.94)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '18px',
                    }}
                    formatter={(value, name) => [formatInteger(Number(value ?? 0)), String(name)]}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend />
                  <Line
                    dataKey="visitors"
                    dot={false}
                    name="Visitors"
                    stroke="#6ee7b7"
                    strokeWidth={2.5}
                    type="monotone"
                  />
                  <Line
                    dataKey="sessions"
                    dot={false}
                    name="Sessions"
                    stroke="#c084fc"
                    strokeWidth={2.5}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptySurface
              message="No traffic trend data is available for the selected range yet."
              title="Traffic graph"
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Event totals</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span>Total events</span>
                <span className="font-medium text-white">{formatInteger(events.totals.events)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Unique events</span>
                <span className="font-medium text-white">
                  {formatInteger(events.totals.uniqueEvents)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Event visitors</span>
                <span className="font-medium text-white">
                  {formatInteger(events.totals.visitors)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Event visits</span>
                <span className="font-medium text-white">{formatInteger(events.totals.visits)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Traffic note</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              The chart uses Umami&apos;s website trend endpoints for time-bucketed traffic and
              session movement, while conversion and feature metrics are aggregated from custom
              event tracking.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Funnel events</p>
          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
              <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Count</th>
                  <th className="px-4 py-3">Visitors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {funnelRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 text-white">{row.label}</td>
                    <td className="px-4 py-3">{formatInteger(row.metric.count)}</td>
                    <td className="px-4 py-3">{formatInteger(row.metric.visitors)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-4 py-3 font-medium text-white">Conversion rate</td>
                  <td className="px-4 py-3" colSpan={2}>
                    {formatPercent(events.conversionRate)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Feature usage</p>
          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
              <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Count</th>
                  <th className="px-4 py-3">Visitors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {featureRows.map((row) => (
                  <tr key={row.label}>
                    <td className="px-4 py-3 text-white">{row.label}</td>
                    <td className="px-4 py-3">{formatInteger(row.metric.count)}</td>
                    <td className="px-4 py-3">{formatInteger(row.metric.visitors)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <GrowthAccordion
          description="Ranked page performance, traffic share, and deterministic opportunities from Umami page data."
          onToggle={() => toggleAccordion('top-pages')}
          open={accordionState['top-pages']}
          title="Top Pages & Traffic Leaders"
        >
          {loading ? (
            <LoadingSurface label="Loading top page performance..." />
          ) : pages.length ? (
            <div className="space-y-5">
              <InsightBlock insights={topPageInsights} title="AI Insight Summary" />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-300">
                  Ranked by page views for the selected range.
                </p>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/[0.09] hover:text-white"
                  onClick={() => exportPagesCsv(pages)}
                  type="button"
                >
                  Export CSV
                </button>
              </div>

              <div className="overflow-x-auto rounded-[1.5rem] border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
                  <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Path</th>
                      <th className="px-4 py-3">Views</th>
                      <th className="px-4 py-3">Visitors</th>
                      <th className="px-4 py-3">Sessions</th>
                      <th className="px-4 py-3">Bounce</th>
                      <th className="px-4 py-3">Avg Time</th>
                      <th className="px-4 py-3">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pages.map((page) => (
                      <tr key={page.path}>
                        <td className="px-4 py-3 font-medium text-white">{page.path}</td>
                        <td className="px-4 py-3">{formatInteger(page.pageviews)}</td>
                        <td className="px-4 py-3">{formatInteger(page.visitors)}</td>
                        <td className="px-4 py-3">{formatInteger(page.sessions)}</td>
                        <td className="px-4 py-3">{formatPercent(page.bounceRate)}</td>
                        <td className="px-4 py-3">{formatDurationSeconds(page.avgTimeSeconds)}</td>
                        <td className="px-4 py-3">{formatPercent(page.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptySurface
              message="No page-performance rows are available for the selected range yet."
              title="Top Pages & Traffic Leaders"
            />
          )}
        </GrowthAccordion>

        <GrowthAccordion
          description="Stage-level movement through landing, subscription, auth, trial, checkout, and paid conversion."
          onToggle={() => toggleAccordion('conversion-funnel')}
          open={accordionState['conversion-funnel']}
          title="Conversion Funnel Intelligence"
        >
          <div className="space-y-5">
            <InsightBlock insights={funnelInsights} title="Funnel Insight Summary" />

            <div className="grid gap-3 lg:grid-cols-6">
              {funnelStages.map((stage, index) => {
                const previous = funnelStages[index - 1]
                const conversion =
                  previous?.count && stage.count !== null ? stage.count / previous.count : null

                return (
                  <article
                    className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4"
                    key={stage.label}
                  >
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-2 text-sm font-semibold text-white">{stage.label}</h3>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {stage.count === null ? '—' : formatInteger(stage.count)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      {conversion === null ? 'Data unavailable' : `${formatPercent(conversion)} from previous`}
                    </p>
                  </article>
                )
              })}
            </div>
          </div>
        </GrowthAccordion>

        <GrowthAccordion
          description="Lightweight route metadata diagnostics with deterministic recommendations and a future AI-ready shape."
          onToggle={() => toggleAccordion('seo-health')}
          open={accordionState['seo-health']}
          title="SEO Health & Metadata"
        >
          <div className="space-y-5">
            <div className="overflow-x-auto rounded-[1.5rem] border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
                <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Page</th>
                    <th className="px-4 py-3">Title Present</th>
                    <th className="px-4 py-3">Meta Description</th>
                    <th className="px-4 py-3">Canonical</th>
                    <th className="px-4 py-3">Open Graph</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {['/', '/subscription', '/success', '/privacy', '/terms'].map((path) => (
                    <tr key={path}>
                      <td className="px-4 py-3 font-medium text-white">{path}</td>
                      <td className="px-4 py-3 text-emerald-100">Managed</td>
                      <td className="px-4 py-3 text-emerald-100">Managed</td>
                      <td className="px-4 py-3 text-emerald-100">Managed</td>
                      <td className="px-4 py-3 text-emerald-100">Managed</td>
                      <td className="px-4 py-3">Runtime metadata active</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <InsightBlock
              insights={[
                {
                  title: 'Metadata coverage',
                  detail: 'Public marketing routes are managed by the existing runtime metadata layer. A future audit endpoint can replace this scaffold with crawl-confirmed values.',
                },
                {
                  title: 'Keyword diversity',
                  detail: 'Homepage and subscription metadata should continue emphasizing digital wellness, REGEN, scalar-inspired light, and at-home restorative technology.',
                },
              ]}
              title="SEO Recommendations"
            />
          </div>
        </GrowthAccordion>

        <GrowthAccordion
          description="Future-ready keyword intelligence for Search Console metrics and deterministic content opportunities."
          onToggle={() => toggleAccordion('keyword-intelligence')}
          open={accordionState['keyword-intelligence']}
          title="Keyword Intelligence"
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <EmptyIntelligenceState
              message="Connect Search Console to enable keyword tracking for impressions, CTR, position, and trend movement."
              title="Top Keywords"
            />
            <EmptyIntelligenceState
              message="Opportunity keywords will be scored once Search Console or SEO keyword data is connected."
              title="Opportunity Keywords"
            />
            <EmptyIntelligenceState
              message="Current metadata suggests future coverage around digital wellness, med bed alternative, scalar-inspired visual resonance, and REGEN recovery."
              title="Missing Keyword Opportunities"
            />
          </div>
        </GrowthAccordion>

        <GrowthAccordion
          description="Referral ecosystem visibility for future Umami referrer/source metrics and SEO backlink APIs."
          onToggle={() => toggleAccordion('backlinks-referrals')}
          open={accordionState['backlinks-referrals']}
          title="Backlinks & Referrals"
        >
          <EmptyIntelligenceState
            message="The current admin analytics API does not expose Umami referrer or source metrics yet. Add a referrer endpoint later to populate Source, Sessions, Visitors, Conversions, and Quality."
            title="Referral sources unavailable"
          />
        </GrowthAccordion>

        <GrowthAccordion
          description="Rewardful and affiliate visibility scaffold for creator-led growth reporting."
          onToggle={() => toggleAccordion('affiliate-intelligence')}
          open={accordionState['affiliate-intelligence']}
          title="Affiliate Intelligence"
        >
          <EmptyIntelligenceState
            message="Rewardful integration is active. Affiliate data will appear here as Rewardful referrals accumulate or when a Rewardful/admin affiliate metrics API is connected."
            title="Affiliate data pending"
          />
        </GrowthAccordion>

        <GrowthAccordion
          description="Deterministic strategy recommendations derived from current traffic, engagement, bounce, and conversion signals."
          onToggle={() => toggleAccordion('growth-strategy')}
          open={accordionState['growth-strategy']}
          title="Growth Strategy Advisor"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {growthRecommendations.map((recommendation) => (
              <article
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5"
                key={recommendation.happened}
              >
                <h3 className="text-lg font-semibold text-white">Strategic recommendation</h3>
                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300">
                  <p>
                    <span className="font-semibold text-emerald-100">What Happened: </span>
                    {recommendation.happened}
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-100">Opportunity: </span>
                    {recommendation.opportunity}
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-100">Risk: </span>
                    {recommendation.risk}
                  </p>
                  <p>
                    <span className="font-semibold text-emerald-100">Recommended Action: </span>
                    {recommendation.action}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </GrowthAccordion>
      </section>
    </AdminPageShell>
  )
}
