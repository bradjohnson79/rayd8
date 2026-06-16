import { useEffect, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  getAdminSubscribers,
  type AdminSubscriberRecord,
  type AdminSubscriberSummary,
  type AdminSubscriberSource,
} from '../../../services/admin'

const emptySummary: AdminSubscriberSummary = {
  amritaSubscribers: 0,
  freeSubscribers: 0,
  paidSubscribers: 0,
  regenSubscribers: 0,
  totalSubscribers: 0,
}

function buildSubscriberSummary(subscribers: AdminSubscriberRecord[]): AdminSubscriberSummary {
  return subscribers.reduce(
    (summary, subscriber) => ({
      amritaSubscribers:
        summary.amritaSubscribers + (subscriber.plan === 'amrita' ? 1 : 0),
      freeSubscribers: summary.freeSubscribers + (subscriber.plan === 'free' ? 1 : 0),
      paidSubscribers:
        summary.paidSubscribers +
        (subscriber.plan === 'regen' || subscriber.plan === 'amrita' ? 1 : 0),
      regenSubscribers: summary.regenSubscribers + (subscriber.plan === 'regen' ? 1 : 0),
      totalSubscribers: summary.totalSubscribers + 1,
    }),
    emptySummary,
  )
}

function getSubscriberSourceLabel(source: AdminSubscriberSource) {
  switch (source) {
    case 'amrita':
      return 'AMRITA'
    case 'free_trial':
      return 'Free Trial'
    case 'legacy_import':
      return 'Legacy Import'
    case 'premium':
      return 'Premium'
    case 'regen':
      return 'REGEN'
    default:
      return source
  }
}

function getSubscriberStatusLabel(subscriber: AdminSubscriberRecord) {
  if (subscriber.plan === 'free' && !subscriber.stripe_subscription_id) {
    return 'Free account'
  }

  if (subscriber.status === 'no_active_subscription') {
    return 'No active subscription'
  }

  return subscriber.status
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  tone?: 'default' | 'primary'
  value: number
}) {
  return (
    <div
      className={[
        'rounded-[1.75rem] border p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl',
        tone === 'primary'
          ? 'border-emerald-200/25 bg-emerald-300/[0.09]'
          : 'border-white/12 bg-white/[0.045]',
      ].join(' ')}
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value.toLocaleString()}</p>
    </div>
  )
}

export function AdminSubscribersPage() {
  const getAuthToken = useAuthToken()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribers, setSubscribers] = useState<AdminSubscriberRecord[]>([])
  const [summary, setSummary] = useState<AdminSubscriberSummary>(emptySummary)

  useEffect(() => {
    let cancelled = false

    async function loadSubscribers() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for subscribers.')
        }

        const response = await getAdminSubscribers(token)

        if (!cancelled) {
          const nextSubscribers = response.subscribers ?? []

          setSubscribers(nextSubscribers)
          setSummary(response.summary ?? buildSubscriberSummary(nextSubscribers))
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : 'Unable to load subscribers.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSubscribers()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  return (
    <AdminPageShell
      description="Subscribers are mapped through secure backend reads so the admin dashboard can track Clerk identity, Stripe customer data, status, and renewal timing together."
      eyebrow="Admin tools"
      title="Subscribers"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Subscribers" tone="primary" value={summary.totalSubscribers} />
        <SummaryCard label="Free Trial / Free Accounts" value={summary.freeSubscribers} />
        <SummaryCard label="REGEN" value={summary.regenSubscribers} />
        <SummaryCard label="AMRITA" value={summary.amritaSubscribers} />
      </div>

      {error ? (
        <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 text-sm text-slate-400 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            Loading subscribers...
          </div>
        ) : subscribers.length ? (
          subscribers.map((subscriber) => (
            <article
              className="rounded-[1.75rem] border border-white/12 bg-white/[0.05] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
              key={subscriber.stripe_subscription_id ?? subscriber.clerk_user_id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{subscriber.email}</h2>
                  <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                    {subscriber.clerk_user_id}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">
                  {getSubscriberStatusLabel(subscriber)}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">
                  {getSubscriberSourceLabel(
                    subscriber.subscriber_source ??
                      (subscriber.plan === 'free' ? 'free_trial' : subscriber.plan),
                  )}
                </span>
                {!subscriber.stripe_subscription_id ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300">
                    {subscriber.plan === 'free' ? 'Free account' : 'No Stripe subscription'}
                  </span>
                ) : null}
              </div>

              <dl className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex justify-between gap-4">
                  <dt>Stripe customer</dt>
                  <dd className="text-right text-slate-100">
                    {subscriber.stripe_customer_id ?? 'No Stripe customer'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Stripe subscription</dt>
                  <dd className="text-right text-slate-100">
                    {subscriber.stripe_subscription_id ?? 'No Stripe subscription'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Plan</dt>
                  <dd className="text-right capitalize text-slate-100">
                    {subscriber.plan} • {subscriber.plan_type ?? 'free account'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Current period end</dt>
                  <dd className="text-right text-slate-100">
                    {subscriber.current_period_end
                      ? new Date(subscriber.current_period_end).toLocaleString()
                      : 'Not available'}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 text-sm text-slate-400 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            No subscriber records available yet.
          </div>
        )}
      </div>
    </AdminPageShell>
  )
}
