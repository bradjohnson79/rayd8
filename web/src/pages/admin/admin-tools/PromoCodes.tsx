import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  archiveAdminPromoCode,
  createAdminPromoCode,
  deactivateAdminPromoCode,
  getAdminPromoCodeDetails,
  getAdminPromoCodes,
  recreateAdminPromoCodeIfMissing,
  validateAdminPromoCode,
  refreshAdminPromoCodeFromStripe,
  repairAdminPromoCodeSync,
  type AdminPromoCodeCreatePayload,
  type AdminPromoCodeDiscountType,
  type AdminPromoCodeDuration,
  type AdminPromoCodePlan,
  type AdminPromoCodeRecord,
  type AdminPromoCodeRedemptionRecord,
} from '../../../services/admin'

const defaultFormState = {
  amountOffDollars: '',
  appliesToPlan: 'regen' as AdminPromoCodePlan,
  code: '',
  description: '',
  discountType: 'percent' as AdminPromoCodeDiscountType,
  duration: 'once' as AdminPromoCodeDuration,
  durationInMonths: '',
  expiresAt: '',
  maxRedemptions: '',
  name: '',
  percentOff: '',
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'No expiration'
}

function formatDiscount(promoCode: AdminPromoCodeRecord) {
  if (promoCode.discount_type === 'percent') {
    return `${promoCode.percent_off ?? 0}% off`
  }

  return `$${((promoCode.amount_off ?? 0) / 100).toFixed(2)} off`
}

function statusClass(status: string) {
  if (status === 'synced') {
    return 'border-emerald-200/30 bg-emerald-300/10 text-emerald-100'
  }

  if (['error', 'mismatch', 'missing'].includes(status)) {
    return 'border-rose-200/30 bg-rose-300/10 text-rose-100'
  }

  return 'border-amber-200/30 bg-amber-300/10 text-amber-100'
}

export function AdminPromoCodesPage() {
  const getAuthToken = useAuthToken()
  const [activePromoCode, setActivePromoCode] = useState<AdminPromoCodeRecord | null>(null)
  const [creating, setCreating] = useState(false)
  const [environment, setEnvironment] = useState('unknown')
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState(defaultFormState)
  const [loading, setLoading] = useState(true)
  const [promoCodes, setPromoCodes] = useState<AdminPromoCodeRecord[]>([])
  const [query, setQuery] = useState('')
  const [redemptions, setRedemptions] = useState<AdminPromoCodeRedemptionRecord[]>([])
  const [sort, setSort] = useState('created')
  const [status, setStatus] = useState('all')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [summary, setSummary] = useState({
    active: 0,
    archived: 0,
    errors: 0,
    expired: 0,
    inactive: 0,
    total: 0,
    totalRedemptions: 0,
  })

  const activePromoCodeId = activePromoCode?.id ?? null

  const loadPromoCodes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for promo codes.')
      }

      const response = await getAdminPromoCodes({ query, sort, status }, token)
      setEnvironment(response.environment)
      setPromoCodes(response.promoCodes)
      setSummary(response.summary)

      if (activePromoCodeId) {
        setActivePromoCode(response.promoCodes.find((promoCode) => promoCode.id === activePromoCodeId) ?? null)
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load promo codes.')
    } finally {
      setLoading(false)
    }
  }, [activePromoCodeId, getAuthToken, query, sort, status])

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadPromoCodes()
    }, 150)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [loadPromoCodes])

  const summaryCards = useMemo(
    () => [
      { label: 'Total codes', value: summary.total },
      { label: 'Active', value: summary.active },
      { label: 'Needs review', value: summary.errors },
      { label: 'Redemptions', value: summary.totalRedemptions },
    ],
    [summary],
  )

  function updateFormField<K extends keyof typeof defaultFormState>(
    key: K,
    value: (typeof defaultFormState)[K],
  ) {
    setFormState((currentValue) => ({ ...currentValue, [key]: value }))
  }

  function buildPayload(): AdminPromoCodeCreatePayload {
    const payload: AdminPromoCodeCreatePayload = {
      appliesToPlan: formState.appliesToPlan,
      code: formState.code,
      description: formState.description || null,
      discountType: formState.discountType,
      duration: formState.duration,
      expiresAt: formState.expiresAt ? new Date(formState.expiresAt).toISOString() : null,
      maxRedemptions: formState.maxRedemptions ? Number(formState.maxRedemptions) : null,
      name: formState.name,
    }

    if (formState.discountType === 'percent') {
      payload.percentOff = Number(formState.percentOff)
    } else {
      payload.amountOff = Math.round(Number(formState.amountOffDollars) * 100)
    }

    if (formState.duration === 'repeating') {
      payload.durationInMonths = Number(formState.durationInMonths)
    }

    return payload
  }

  async function handleCreatePromoCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError(null)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for promo code creation.')
      }

      const response = await createAdminPromoCode(buildPayload(), token)
      setFormState(defaultFormState)
      setStatusMessage(`Created ${response.promoCode.code} in Stripe and saved it locally.`)
      await loadPromoCodes()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to create promo code.')
    } finally {
      setCreating(false)
    }
  }

  async function loadDetails(promoCode: AdminPromoCodeRecord) {
    setActivePromoCode(promoCode)
    setRedemptions([])

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for promo code details.')
      }

      const response = await getAdminPromoCodeDetails(promoCode.id, token)
      setActivePromoCode(response.promoCode)
      setRedemptions(response.redemptions)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load promo code details.')
    }
  }

  async function runAction(
    action: 'archive' | 'deactivate' | 'recreate' | 'refresh' | 'repair' | 'validate',
    promoCode: AdminPromoCodeRecord,
  ) {
    setError(null)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for promo code action.')
      }

      if (action === 'validate') {
        const response = await validateAdminPromoCode(promoCode.id, token)
        setStatusMessage(response.validation.messages.join(' '))
      }

      if (action === 'refresh') {
        const response = await refreshAdminPromoCodeFromStripe(promoCode.id, token)
        setStatusMessage(`${response.promoCode.code} was refreshed from Stripe.`)
      }

      if (action === 'repair') {
        const response = await repairAdminPromoCodeSync(promoCode.id, token)
        setStatusMessage(`${response.promoCode.code} was repaired using Stripe as source of truth.`)
      }

      if (action === 'recreate') {
        const confirmed = window.confirm(
          `Recreate ${promoCode.code} in Stripe only if its existing Stripe coupon or promotion code is missing?`,
        )

        if (!confirmed) {
          return
        }

        const response = await recreateAdminPromoCodeIfMissing(promoCode.id, token)
        setStatusMessage(`${response.promoCode.code} now has active Stripe IDs.`)
      }

      if (action === 'deactivate') {
        const response = await deactivateAdminPromoCode(promoCode.id, token)
        setStatusMessage(`${response.promoCode.code} was deactivated in Stripe.`)
      }

      if (action === 'archive') {
        const response = await archiveAdminPromoCode(promoCode.id, token)
        setStatusMessage(`${response.promoCode.code} was archived locally.`)
      }

      await loadPromoCodes()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Promo code action failed.')
    }
  }

  return (
    <AdminPageShell
      description="Create, validate, and monitor Stripe-backed promotion codes for RAYD8 subscription checkout. Stripe remains the source of truth for applied discounts."
      eyebrow="Admin tools"
      title="Promo Codes"
    >
      <div className="flex flex-col gap-3 rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-violet-200/65">Stripe environment</p>
          <p className="mt-2 text-2xl font-semibold uppercase text-white">{environment}</p>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-slate-300">
          Codes created here become real Stripe coupons and promotion codes. Customers enter them in Stripe Checkout.
        </p>
      </div>

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

      <div className="grid gap-4 md:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            className="rounded-[1.5rem] border border-white/12 bg-white/[0.045] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
            key={card.label}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{card.value}</p>
          </article>
        ))}
      </div>

      <form
        className="grid gap-4 rounded-[2rem] border border-white/12 bg-white/[0.045] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl lg:grid-cols-4"
        onSubmit={(event) => void handleCreatePromoCode(event)}
      >
        <div className="lg:col-span-4">
          <h2 className="text-xl font-semibold text-white">Create Stripe Promo Code</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            REGEN is selected by default. Fixed amount discounts are entered as dollars and sent to Stripe as cents.
          </p>
        </div>
        <input
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
          onChange={(event) => updateFormField('code', event.target.value)}
          placeholder="Code, e.g. REGEN25"
          required
          value={formState.code}
        />
        <input
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
          onChange={(event) => updateFormField('name', event.target.value)}
          placeholder="Name"
          required
          value={formState.name}
        />
        <select
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
          onChange={(event) => updateFormField('discountType', event.target.value as AdminPromoCodeDiscountType)}
          value={formState.discountType}
        >
          <option value="percent">Percent off</option>
          <option value="amount">Fixed amount off</option>
        </select>
        {formState.discountType === 'percent' ? (
          <input
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
            min="1"
            max="100"
            onChange={(event) => updateFormField('percentOff', event.target.value)}
            placeholder="Percent, e.g. 25"
            required
            type="number"
            value={formState.percentOff}
          />
        ) : (
          <input
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
            min="0.01"
            onChange={(event) => updateFormField('amountOffDollars', event.target.value)}
            placeholder="Dollars off, e.g. 5"
            required
            step="0.01"
            type="number"
            value={formState.amountOffDollars}
          />
        )}
        <select
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
          onChange={(event) => updateFormField('duration', event.target.value as AdminPromoCodeDuration)}
          value={formState.duration}
        >
          <option value="once">Once</option>
          <option value="repeating">Repeating</option>
          <option value="forever">Forever</option>
        </select>
        <input
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60 disabled:opacity-45"
          disabled={formState.duration !== 'repeating'}
          min="1"
          onChange={(event) => updateFormField('durationInMonths', event.target.value)}
          placeholder="Duration months"
          required={formState.duration === 'repeating'}
          type="number"
          value={formState.durationInMonths}
        />
        <input
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
          min="1"
          onChange={(event) => updateFormField('maxRedemptions', event.target.value)}
          placeholder="Max redemptions"
          type="number"
          value={formState.maxRedemptions}
        />
        <input
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
          onChange={(event) => updateFormField('expiresAt', event.target.value)}
          type="datetime-local"
          value={formState.expiresAt}
        />
        <select
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
          onChange={(event) => updateFormField('appliesToPlan', event.target.value as AdminPromoCodePlan)}
          value={formState.appliesToPlan}
        >
          <option value="regen">REGEN</option>
          <option value="amrita">AMRITA future</option>
          <option value="all">All future plans</option>
        </select>
        <textarea
          className="min-h-24 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60 lg:col-span-3"
          onChange={(event) => updateFormField('description', event.target.value)}
          placeholder="Description or campaign notes"
          value={formState.description}
        />
        <button
          className="rounded-2xl border border-emerald-200/30 bg-emerald-300/16 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/22 disabled:cursor-not-allowed disabled:opacity-55"
          disabled={creating}
          type="submit"
        >
          {creating ? 'Creating...' : 'Create in Stripe'}
        </button>
      </form>

      <div className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <div className="grid gap-3 border-b border-white/10 px-5 py-4 md:grid-cols-3">
          <input
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search code, name, description"
            value={query}
          />
          <select
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="all">All active view</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="expired">Expired</option>
            <option value="synced">Synced</option>
            <option value="pending">Pending</option>
            <option value="mismatch">Mismatch</option>
            <option value="missing">Missing</option>
            <option value="error">Error</option>
            <option value="archived">Archived</option>
          </select>
          <select
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
            onChange={(event) => setSort(event.target.value)}
            value={sort}
          >
            <option value="created">Created date</option>
            <option value="expires">Expiration</option>
            <option value="redemptions">Redemptions</option>
            <option value="status">Sync status</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
            <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Code</th>
                <th className="px-5 py-4">Discount</th>
                <th className="px-5 py-4">Duration</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Redemptions</th>
                <th className="px-5 py-4">Expires</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td className="px-5 py-6 text-slate-400" colSpan={7}>Loading promo codes...</td></tr>
              ) : promoCodes.length ? (
                promoCodes.map((promoCode) => (
                  <tr key={promoCode.id}>
                    <td className="px-5 py-4">
                      <button className="text-left" onClick={() => void loadDetails(promoCode)} type="button">
                        <span className="font-semibold text-white">{promoCode.code}</span>
                        <span className="mt-1 block text-xs text-slate-500">{promoCode.name}</span>
                      </button>
                    </td>
                    <td className="px-5 py-4">{formatDiscount(promoCode)}</td>
                    <td className="px-5 py-4 capitalize">
                      {promoCode.duration}
                      {promoCode.duration_in_months ? ` • ${promoCode.duration_in_months} months` : ''}
                    </td>
                    <td className="px-5 py-4">
                      <span className={['rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]', statusClass(promoCode.stripe_sync_status)].join(' ')}>
                        {promoCode.stripe_sync_status}
                      </span>
                    </td>
                    <td className="px-5 py-4">{promoCode.times_redeemed}</td>
                    <td className="px-5 py-4">{formatDate(promoCode.expires_at)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('validate', promoCode)} type="button">Validate</button>
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('refresh', promoCode)} type="button">Refresh</button>
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('repair', promoCode)} type="button">Repair</button>
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('recreate', promoCode)} type="button">Recreate</button>
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('deactivate', promoCode)} type="button">Deactivate</button>
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('archive', promoCode)} type="button">Archive</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td className="px-5 py-6 text-slate-400" colSpan={7}>No promo codes found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activePromoCode ? (
        <div className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-violet-200/65">Selected code</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{activePromoCode.code}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{activePromoCode.description ?? 'No description provided.'}</p>
            </div>
            <div className="text-sm text-slate-300">
              <p>Coupon: {activePromoCode.stripe_coupon_id ?? 'Missing'}</p>
              <p className="mt-1">Promotion: {activePromoCode.stripe_promotion_code_id ?? 'Missing'}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {redemptions.length ? redemptions.map((redemption) => (
              <article className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300" key={redemption.id}>
                <p className="font-medium text-white">{new Date(redemption.created_at).toLocaleString()}</p>
                <p className="mt-2">Discount: ${((redemption.amount_discounted ?? 0) / 100).toFixed(2)}</p>
                <p className="mt-1 text-xs text-slate-500">{redemption.stripe_checkout_session_id ?? redemption.stripe_subscription_id ?? 'Stripe reference unavailable'}</p>
              </article>
            )) : (
              <p className="text-sm text-slate-400">No recorded redemptions yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </AdminPageShell>
  )
}
