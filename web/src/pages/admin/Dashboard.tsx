import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminPageShell } from '../../components/AdminPageShell'
import { AdminStatCard } from '../../components/AdminStatCard'
import { useAuthToken } from '../../features/dashboard/useAuthToken'
import { useSession } from '../../features/session/SessionProvider'
import {
  getAdminMessages,
  getAdminMuxStats,
  getAdminOrders,
  getAdminOverview,
  getAdminUsers,
  type AdminMuxStats,
  type AdminOverview,
  type AdminStripeRecord,
  type AdminUserRecord,
  type ContactMessageRecord,
} from '../../services/admin'

const emptyOverview: AdminOverview = {
  totalUsers: 0,
  activeSubscribers: 0,
  currentStreamingSessions: 0,
  totalMinutesWatchedToday: 0,
  totalMinutesWatchedPast30Days: 0,
  averageVideoWatchTime: 0,
}

export function AdminDashboardPage() {
  const getAuthToken = useAuthToken()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState<AdminOverview>(emptyOverview)
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [orders, setOrders] = useState<AdminStripeRecord[]>([])
  const [messages, setMessages] = useState<ContactMessageRecord[]>([])
  const [muxStats, setMuxStats] = useState<AdminMuxStats>({
    configured: false,
    environment_key: null,
    total_assets: 0,
    ready_assets: 0,
    processing_assets: 0,
    total_duration_seconds: 0,
  })

  useEffect(() => {
    let cancelled = false

    async function loadOverview() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for admin overview.')
        }

        const [overviewResponse, userResponse, orderResponse, messageResponse, muxResponse] =
          await Promise.all([
            getAdminOverview(token),
            getAdminUsers(token),
            getAdminOrders(token),
            getAdminMessages(token),
            getAdminMuxStats(token),
          ])

        if (!cancelled) {
          setOverview(overviewResponse.overview)
          setUsers(userResponse.users)
          setOrders(orderResponse.orders)
          setMessages(messageResponse.messages)
          setMuxStats(muxResponse.stats)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : 'Unable to load admin overview.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOverview()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  return <AdminDashboardHome error={error} loading={loading} messages={messages} muxStats={muxStats} orders={orders} overview={overview} users={users} />
}

function AdminDashboardHome({
  error,
  loading,
  messages,
  muxStats,
  orders,
  overview,
  users,
}: {
  error: string | null
  loading: boolean
  messages: ContactMessageRecord[]
  muxStats: AdminMuxStats
  orders: AdminStripeRecord[]
  overview: AdminOverview
  users: AdminUserRecord[]
}) {
  const { startSession } = useSession()
  const latestUsers = useMemo(
    () =>
      [...users]
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
        .slice(0, 10),
    [users],
  )
  const latestOrders = useMemo(() => orders.slice(0, 10), [orders])
  const recentMessages = useMemo(() => messages.slice(0, 5), [messages])

  return (
    <section className="space-y-6">
      <AdminPageShell
        aside={
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Preview routes</p>
            <p className="mt-2 text-base font-semibold text-white">Stable admin previews</p>
            <p className="mt-2 text-sm text-slate-300">
              Open isolated preview dashboards for Free Trial or REGEN directly from the admin
              sidebar. AMRITA remains disabled until that surface is ready.
            </p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <Link
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 font-medium text-white transition hover:bg-white/10"
                to="/admin/preview/free"
              >
                Free Trial Preview
              </Link>
              <Link
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 font-medium text-white transition hover:bg-white/10"
                to="/admin/preview/regen"
              >
                REGEN Preview
              </Link>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 font-medium text-white/40 opacity-60">
                AMRITA Coming Soon
              </div>
            </div>
          </div>
        }
        description="Monitor platform health, watch-time behavior, contact messages, orders, and direct session launch from one admin command center."
        eyebrow="RAYD8® Operating System"
        title="Admin Command Center"
      >
        {error ? (
          <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AdminStatCard
            detail={loading ? 'Loading user totals...' : 'Total registered users in the platform database.'}
            label="Total users"
            value={overview.totalUsers}
          />
          <AdminStatCard
            detail={loading ? 'Loading subscriber counts...' : 'Users with currently active subscription status.'}
            label="Active subscribers"
            value={overview.activeSubscribers}
          />
          <AdminStatCard
            detail={loading ? 'Loading active sessions...' : 'Streaming sessions with recent heartbeat activity.'}
            label="Current streaming sessions"
            value={overview.currentStreamingSessions}
          />
          <AdminStatCard
            detail={loading ? 'Loading today watch time...' : 'Total watched minutes recorded for the current UTC day.'}
            label="Minutes watched today"
            value={overview.totalMinutesWatchedToday}
          />
          <AdminStatCard
            detail={loading ? 'Loading 30-day watch time...' : 'Total watched minutes across the last 30 days.'}
            label="Minutes watched past 30 days"
            value={overview.totalMinutesWatchedPast30Days}
          />
          <AdminStatCard
            detail={loading ? 'Loading average watch time...' : 'Average minutes watched per recorded session in the last 30 days.'}
            label="Avg Video Watch Time"
            value={`${overview.averageVideoWatchTime} min`}
          />
        </section>

        <section className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">Messages</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Latest contact requests</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Member messages route here after submission and are addressed to
                {' '}bradjohnson79@gmail.com.
              </p>
            </div>
            <Link
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              to="/admin/messages"
            >
              View all messages
            </Link>
          </div>

          <div className="mt-6 grid gap-3">
            {loading ? (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
                Loading messages...
              </div>
            ) : recentMessages.length ? (
              recentMessages.map((message) => (
                <article
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4"
                  key={message.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-white">{message.subject}</h3>
                      <p className="mt-1 text-sm text-slate-300">{message.email}</p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      {new Date(message.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{message.message}</p>
                </article>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-slate-400">
                No messages yet.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {[
            {
              description: 'Launch the shared fullscreen player with the Expansion session shell.',
              label: 'RAYD8® Expansion',
              type: 'expansion' as const,
            },
            {
              description: 'Launch the shared fullscreen player with the Premium session shell.',
              label: 'RAYD8® Premium',
              type: 'premium' as const,
            },
            {
              description: 'Launch the shared fullscreen player with the REGEN session shell.',
              label: 'RAYD8® REGEN',
              type: 'regen' as const,
            },
          ].map((card) => (
            <article
              className="rounded-[1.75rem] border border-white/12 bg-white/[0.05] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
              key={card.type}
            >
              <p className="text-xs uppercase tracking-[0.3em] text-violet-200/60">Session launch</p>
              <h2 className="mt-3 text-xl font-semibold text-white">{card.label}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{card.description}</p>
              <button
                className="mt-5 rounded-2xl bg-violet-300/20 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-300/30"
                onClick={() => startSession(card.type, { source: 'admin' })}
                type="button"
              >
                Open fullscreen player
              </button>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">New Members</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Top 10</h2>
              </div>
              <Link
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                to="/admin/subscribers"
              >
                View All
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-400">Loading members...</p>
              ) : latestUsers.length ? (
                latestUsers.map((user) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3"
                    key={user.id}
                  >
                    <div>
                      <p className="font-medium text-white">{user.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                        {user.plan} • {user.subscription_status}
                      </p>
                    </div>
                    <p className="text-sm text-slate-300">
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No members yet.</p>
              )}
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">New Orders</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Top 10</h2>
              </div>
              <Link
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                to="/admin/orders"
              >
                View All
              </Link>
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-400">Loading orders...</p>
              ) : latestOrders.length ? (
                latestOrders.map((order) => (
                  <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3"
                    key={order.stripe_subscription_id}
                  >
                    <div>
                      <p className="font-medium text-white">{order.email}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                        {order.plan} • {order.plan_type} • {order.status}
                      </p>
                    </div>
                    <p className="text-sm text-slate-300">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No orders yet.</p>
              )}
            </div>
          </article>
        </section>

        <section className="rounded-[2rem] border border-white/12 bg-white/[0.05] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-violet-200/60">Mux summary</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">Streaming environment</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                Snapshot of the current Mux environment used by the admin streaming control layer.
              </p>
            </div>
            <Link
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              to="/admin/mux"
            >
              Open Mux tools
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              detail={loading ? 'Loading asset totals...' : 'Assets visible from the current Mux environment.'}
              label="Total assets"
              value={muxStats.total_assets}
            />
            <AdminStatCard
              detail={loading ? 'Loading ready asset totals...' : 'Assets currently ready for playback.'}
              label="Ready assets"
              value={muxStats.ready_assets}
            />
            <AdminStatCard
              detail={loading ? 'Loading processing count...' : 'Assets still processing or awaiting readiness.'}
              label="Processing assets"
              value={muxStats.processing_assets}
            />
            <AdminStatCard
              detail={loading ? 'Loading environment key...' : `Environment: ${muxStats.environment_key ?? 'not configured'}`}
              label="Duration seconds"
              value={muxStats.total_duration_seconds}
            />
          </div>
        </section>
      </AdminPageShell>
    </section>
  )
}
