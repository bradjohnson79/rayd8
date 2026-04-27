import { useEffect, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import { getAdminOrders, type AdminStripeRecord } from '../../../services/admin'

export function AdminOrdersPage() {
  const getAuthToken = useAuthToken()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<AdminStripeRecord[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadOrders() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for orders.')
        }

        const response = await getAdminOrders(token)

        if (!cancelled) {
          setOrders(response.orders)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load orders.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadOrders()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  return (
    <AdminPageShell
      description="Orders are read from secure backend Stripe admin endpoints. This page exposes the subscription fields needed for renewals, access review, and support visibility."
      eyebrow="Admin tools"
      title="Orders"
    >
      {error ? (
        <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
            <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Plan type</th>
                <th className="px-5 py-4">Created</th>
                <th className="px-5 py-4">Period end</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-slate-400" colSpan={5}>
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length ? (
                orders.map((order) => (
                  <tr key={order.stripe_subscription_id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{order.email}</p>
                      <p className="mt-1 text-xs text-slate-500">{order.clerk_user_id}</p>
                      <p className="mt-1 text-xs text-slate-500">{order.stripe_customer_id}</p>
                    </td>
                    <td className="px-5 py-4 capitalize">{order.status}</td>
                    <td className="px-5 py-4 capitalize">{order.plan_type}</td>
                    <td className="px-5 py-4">{new Date(order.created_at).toLocaleString()}</td>
                    <td className="px-5 py-4">
                      {order.current_period_end
                        ? new Date(order.current_period_end).toLocaleString()
                        : 'Not available'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-6 text-slate-400" colSpan={5}>
                    No orders available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminPageShell>
  )
}
