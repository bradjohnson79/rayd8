import { useEffect, useMemo, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  archiveAdminOrders,
  getAdminOrders,
  type AdminStripeRecord,
} from '../../../services/admin'

export function AdminOrdersPage() {
  const getAuthToken = useAuthToken()
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<AdminStripeRecord[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const selectedOrderIdSet = useMemo(() => new Set(selectedOrderIds), [selectedOrderIds])
  const allVisibleSelected = orders.length > 0 && selectedOrderIds.length === orders.length

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
          setSelectedOrderIds([])
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

  function handleToggleOrder(stripeSubscriptionId: string) {
    setSelectedOrderIds((current) =>
      current.includes(stripeSubscriptionId)
        ? current.filter((id) => id !== stripeSubscriptionId)
        : [...current, stripeSubscriptionId],
    )
  }

  function handleToggleAllOrders() {
    setSelectedOrderIds(allVisibleSelected ? [] : orders.map((order) => order.stripe_subscription_id))
  }

  async function handleArchiveSelected() {
    if (selectedOrderIds.length === 0) {
      return
    }

    setArchiving(true)
    setError(null)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for archiving orders.')
      }

      const response = await archiveAdminOrders(selectedOrderIds, token)
      setOrders(response.orders)
      setSelectedOrderIds([])
      setStatusMessage(`Archived ${response.archived.length} order${response.archived.length === 1 ? '' : 's'}.`)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to archive selected orders.')
    } finally {
      setArchiving(false)
    }
  }

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

      {statusMessage ? (
        <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-4 text-sm text-slate-200 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          {statusMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-300">
            {selectedOrderIds.length
              ? `${selectedOrderIds.length} order${selectedOrderIds.length === 1 ? '' : 's'} selected`
              : 'Select orders to archive them from this admin view.'}
          </p>
          <button
            className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={archiving || selectedOrderIds.length === 0}
            onClick={() => void handleArchiveSelected()}
            type="button"
          >
            {archiving ? 'Archiving...' : 'Archive selected'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
            <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
              <tr>
                <th className="px-5 py-4">
                  <button
                    aria-label={allVisibleSelected ? 'Clear selected orders' : 'Select all orders'}
                    className={[
                      'flex h-5 w-5 items-center justify-center rounded-md border transition',
                      allVisibleSelected
                        ? 'border-cyan-200 bg-cyan-300/70 text-slate-950'
                        : 'border-white/20 bg-white/[0.04] text-transparent hover:border-white/40',
                    ].join(' ')}
                    disabled={loading || orders.length === 0}
                    onClick={handleToggleAllOrders}
                    type="button"
                  >
                    ✓
                  </button>
                </th>
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
                  <td className="px-5 py-6 text-slate-400" colSpan={6}>
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length ? (
                orders.map((order) => (
                  <tr key={order.stripe_subscription_id}>
                    <td className="px-5 py-4 align-top">
                      <button
                        aria-label={`Select order ${order.stripe_subscription_id}`}
                        className={[
                          'mt-1 flex h-5 w-5 items-center justify-center rounded-md border transition',
                          selectedOrderIdSet.has(order.stripe_subscription_id)
                            ? 'border-cyan-200 bg-cyan-300/70 text-slate-950'
                            : 'border-white/20 bg-white/[0.04] text-transparent hover:border-white/40',
                        ].join(' ')}
                        onClick={() => handleToggleOrder(order.stripe_subscription_id)}
                        type="button"
                      >
                        ✓
                      </button>
                    </td>
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
                  <td className="px-5 py-6 text-slate-400" colSpan={6}>
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
