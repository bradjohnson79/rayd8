import { useEffect, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import { getAdminSubscribers, type AdminStripeRecord } from '../../../services/admin'

export function AdminSubscribersPage() {
  const getAuthToken = useAuthToken()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribers, setSubscribers] = useState<AdminStripeRecord[]>([])

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
          setSubscribers(response.subscribers)
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
              key={subscriber.stripe_subscription_id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">{subscriber.email}</h2>
                  <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                    {subscriber.clerk_user_id}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">
                  {subscriber.status}
                </span>
              </div>

              <dl className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex justify-between gap-4">
                  <dt>Stripe customer</dt>
                  <dd className="text-right text-slate-100">{subscriber.stripe_customer_id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Stripe subscription</dt>
                  <dd className="text-right text-slate-100">
                    {subscriber.stripe_subscription_id}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>Plan</dt>
                  <dd className="text-right capitalize text-slate-100">
                    {subscriber.plan} • {subscriber.plan_type}
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
