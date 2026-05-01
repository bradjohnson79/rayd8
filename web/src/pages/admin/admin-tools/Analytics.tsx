import { useEffect, useMemo, useState } from 'react'
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

const RANGE_OPTIONS: Array<{ durationMs: number; id: RangePreset; label: string }> = [
  { id: '24h', label: 'Last 24h', durationMs: 24 * 60 * 60 * 1000 },
  { id: '7d', label: 'Last 7 days', durationMs: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: 'Last 30 days', durationMs: 30 * 24 * 60 * 60 * 1000 },
]

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

export function AdminAnalyticsPage() {
  const getAuthToken = useAuthToken()
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

      {loading ? (
        <LoadingSurface label="Loading top page performance..." />
      ) : pages.length ? (
        <section className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Top pages</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Traffic leaders</h2>
            </div>
            <p className="text-sm text-slate-300">
              Ranked by page views for the selected range.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
              <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Visitors</th>
                  <th className="px-4 py-3">Sessions</th>
                  <th className="px-4 py-3">Bounce</th>
                  <th className="px-4 py-3">Avg time</th>
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
        </section>
      ) : (
        <EmptySurface
          message="No page-performance rows are available for the selected range yet."
          title="Top pages"
        />
      )}
    </AdminPageShell>
  )
}
