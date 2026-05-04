import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  archiveAdminPromoCode,
  createAdminPromoCode,
  deactivateAdminPromoCode,
  getAdminPromoCodeDetails,
  getAdminPromoCodes,
  recreateAdminPromoCodeIfMissing,
  updateAdminPromoCode,
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

const defaultEditFormState = {
  appliesToPlan: 'regen' as AdminPromoCodePlan,
  description: '',
  isActive: true,
  name: '',
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

function HelpTooltip({ label, text }: { label: string; text: string }) {
  const tooltipId = useId()

  return (
    <span className="group/help relative inline-flex">
      <button
        aria-describedby={tooltipId}
        aria-label={`Help for ${label}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 bg-white/[0.07] text-[10px] font-semibold leading-none text-slate-300 shadow-[0_0_14px_rgba(167,139,250,0.12)] outline-none transition hover:border-violet-200/50 hover:bg-violet-200/12 hover:text-white focus-visible:border-violet-200/70 focus-visible:bg-violet-200/15 focus-visible:text-white focus-visible:ring-2 focus-visible:ring-violet-300/25"
        type="button"
      >
        <svg aria-hidden="true" className="h-2.5 w-2.5" viewBox="0 0 16 16">
          <path
            d="M7.9 10.9a.8.8 0 0 1-.8-.8c0-1.5.9-2.1 1.6-2.6.6-.4 1-.7 1-1.4 0-.8-.6-1.3-1.6-1.3-.8 0-1.4.3-1.9.9a.8.8 0 1 1-1.2-1.1 4 4 0 0 1 3.2-1.4c1.9 0 3.2 1.1 3.2 2.8 0 1.5-.9 2.1-1.6 2.6-.6.4-1 .7-1 1.4a.8.8 0 0 1-.9.9Zm.1 2.7a1 1 0 1 1 0-2.1 1 1 0 0 1 0 2.1Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <span
        className="pointer-events-none absolute left-1/2 top-6 z-30 w-[min(17rem,calc(100vw-3rem))] -translate-x-1/2 rounded-2xl border border-white/12 bg-slate-950/90 px-3 py-2 text-left text-xs font-normal leading-5 text-slate-200 opacity-0 shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-xl transition duration-150 group-hover/help:opacity-100 group-focus-within/help:opacity-100 sm:left-0 sm:translate-x-0"
        id={tooltipId}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  )
}

function FieldWithHelp({
  children,
  className = '',
  help,
  label,
}: {
  children: ReactNode
  className?: string
  help: string
  label: string
}) {
  return (
    <div className={['space-y-2', className].filter(Boolean).join(' ')}>
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">{label}</span>
        <HelpTooltip label={label} text={help} />
      </div>
      {children}
    </div>
  )
}

export function AdminPromoCodesPage() {
  const getAuthToken = useAuthToken()
  const [activePromoCode, setActivePromoCode] = useState<AdminPromoCodeRecord | null>(null)
  const [creating, setCreating] = useState(false)
  const [editFormState, setEditFormState] = useState(defaultEditFormState)
  const [editingPromoCode, setEditingPromoCode] = useState<AdminPromoCodeRecord | null>(null)
  const [editSaving, setEditSaving] = useState(false)
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

  function openEditModal(promoCode: AdminPromoCodeRecord) {
    setEditingPromoCode(promoCode)
    setEditFormState({
      appliesToPlan: promoCode.applies_to_plan,
      description: promoCode.description ?? '',
      isActive: promoCode.is_active,
      name: promoCode.name,
    })
    setError(null)
    setStatusMessage(null)
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingPromoCode) {
      return
    }

    setEditSaving(true)
    setError(null)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for promo code update.')
      }

      const response = await updateAdminPromoCode(
        editingPromoCode.id,
        {
          appliesToPlan: editFormState.appliesToPlan,
          description: editFormState.description || null,
          isActive: editFormState.isActive,
          name: editFormState.name,
        },
        token,
      )

      setEditingPromoCode(null)
      setStatusMessage(
        `${response.promoCode.code} was updated locally and synced to Stripe where Stripe allows changes.`,
      )
      await loadPromoCodes()

      if (activePromoCode?.id === editingPromoCode.id) {
        await loadDetails(response.promoCode)
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update promo code.')
    } finally {
      setEditSaving(false)
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

      {editingPromoCode ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-md sm:items-center">
          <form
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/12 bg-slate-950/88 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
            onSubmit={(event) => void handleSaveEdit(event)}
          >
            <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-violet-200/65">Edit Promo Code</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{editingPromoCode.code}</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {formatDiscount(editingPromoCode)} • {editingPromoCode.duration}
                  {editingPromoCode.duration_in_months ? ` • ${editingPromoCode.duration_in_months} months` : ''}
                </p>
              </div>
              <button
                className="rounded-2xl border border-white/12 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                onClick={() => setEditingPromoCode(null)}
                type="button"
              >
                Cancel
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
              Stripe does not allow promo code text, discount type, discount value, or duration to be safely changed after creation.
              Archive this code and create a new one if one of those values needs to change.
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <FieldWithHelp help="Internal or display name for this promo code." label="Name">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
                  onChange={(event) => setEditFormState((value) => ({ ...value, name: event.target.value }))}
                  required
                  value={editFormState.name}
                />
              </FieldWithHelp>
              <FieldWithHelp help="Set whether Stripe should currently accept this promotion code." label="Active Status">
                <select
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
                  onChange={(event) => setEditFormState((value) => ({ ...value, isActive: event.target.value === 'true' }))}
                  value={String(editFormState.isActive)}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </FieldWithHelp>
              <FieldWithHelp help="Local plan association used for admin organization and Stripe metadata." label="Product / Plan">
                <select
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
                  onChange={(event) =>
                    setEditFormState((value) => ({
                      ...value,
                      appliesToPlan: event.target.value as AdminPromoCodePlan,
                    }))
                  }
                  value={editFormState.appliesToPlan}
                >
                  <option value="regen">REGEN</option>
                  <option value="amrita">AMRITA future</option>
                  <option value="all">All future plans</option>
                </select>
              </FieldWithHelp>
              <FieldWithHelp help="Stripe does not allow max redemptions to be changed after creation in this integration." label="Max Redemptions">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400 outline-none disabled:opacity-70"
                  disabled
                  value={editingPromoCode.max_redemptions ?? 'Unlimited'}
                />
              </FieldWithHelp>
              <FieldWithHelp help="Stripe does not allow redeem-by date to be changed after creation in this integration." label="Redeem By">
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-400 outline-none disabled:opacity-70"
                  disabled
                  value={formatDate(editingPromoCode.expires_at)}
                />
              </FieldWithHelp>
              <FieldWithHelp help="Optional internal notes about campaign details or contributor tier." label="Description / Campaign Notes" className="md:col-span-2">
                <textarea
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
                  onChange={(event) => setEditFormState((value) => ({ ...value, description: event.target.value }))}
                  value={editFormState.description}
                />
              </FieldWithHelp>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300 md:grid-cols-2">
              <p>Stripe coupon ID: {editingPromoCode.stripe_coupon_id ?? 'Missing'}</p>
              <p>Stripe promotion ID: {editingPromoCode.stripe_promotion_code_id ?? 'Missing'}</p>
              <p>Code: {editingPromoCode.code}</p>
              <p>Duration: {editingPromoCode.duration}</p>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                className="rounded-2xl border border-white/12 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
                onClick={() => setEditingPromoCode(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-2xl border border-emerald-200/30 bg-emerald-300/16 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/22 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={editSaving}
                type="submit"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
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
        <FieldWithHelp
          help="The actual promo code customers will enter at checkout. This must be unique."
          label="Code"
        >
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
            onChange={(event) => updateFormField('code', event.target.value)}
            placeholder="Code, e.g. REGEN25"
            required
            value={formState.code}
          />
        </FieldWithHelp>
        <FieldWithHelp
          help="Internal or display name for this promo code. Useful for organization and tracking."
          label="Name"
        >
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
            onChange={(event) => updateFormField('name', event.target.value)}
            placeholder="Name"
            required
            value={formState.name}
          />
        </FieldWithHelp>
        <FieldWithHelp
          help="Choose whether this code gives a percentage discount or a fixed dollar amount discount."
          label="Discount Type"
        >
          <select
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
            onChange={(event) => updateFormField('discountType', event.target.value as AdminPromoCodeDiscountType)}
            value={formState.discountType}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Fixed amount off</option>
          </select>
        </FieldWithHelp>
        <FieldWithHelp
          help="Enter the discount amount. For percentage, use a number like 10 or 100. For fixed discounts, enter the dollar amount."
          label="Discount Value"
        >
          {formState.discountType === 'percent' ? (
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
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
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
              min="0.01"
              onChange={(event) => updateFormField('amountOffDollars', event.target.value)}
              placeholder="Dollars off, e.g. 5"
              required
              step="0.01"
              type="number"
              value={formState.amountOffDollars}
            />
          )}
        </FieldWithHelp>
        <FieldWithHelp
          help="Controls how long the discount applies: once, repeating for a set number of months, or forever."
          label="Duration"
        >
          <select
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
            onChange={(event) => updateFormField('duration', event.target.value as AdminPromoCodeDuration)}
            value={formState.duration}
          >
            <option value="once">Once</option>
            <option value="repeating">Repeating</option>
            <option value="forever">Forever</option>
          </select>
        </FieldWithHelp>
        <FieldWithHelp
          help="Used only for repeating discounts. Enter how many billing cycles the discount should remain active."
          label="Duration in Months"
        >
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60 disabled:opacity-45"
            disabled={formState.duration !== 'repeating'}
            min="1"
            onChange={(event) => updateFormField('durationInMonths', event.target.value)}
            placeholder="Duration months"
            required={formState.duration === 'repeating'}
            type="number"
            value={formState.durationInMonths}
          />
        </FieldWithHelp>
        <FieldWithHelp
          help="Maximum number of times this promo code can be used. Leave blank if unlimited is supported."
          label="Max Redemptions"
        >
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
            min="1"
            onChange={(event) => updateFormField('maxRedemptions', event.target.value)}
            placeholder="Max redemptions"
            type="number"
            value={formState.maxRedemptions}
          />
        </FieldWithHelp>
        <FieldWithHelp
          help="Optional expiration date and time. After this point, the promo code can no longer be redeemed."
          label="Redeem By"
        >
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
            onChange={(event) => updateFormField('expiresAt', event.target.value)}
            type="datetime-local"
            value={formState.expiresAt}
          />
        </FieldWithHelp>
        <FieldWithHelp
          help="Select which product this promo code applies to, such as REGEN or Amrita."
          label="Product / Plan"
        >
          <select
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
            onChange={(event) => updateFormField('appliesToPlan', event.target.value as AdminPromoCodePlan)}
            value={formState.appliesToPlan}
          >
            <option value="regen">REGEN</option>
            <option value="amrita">AMRITA future</option>
            <option value="all">All future plans</option>
          </select>
        </FieldWithHelp>
        <FieldWithHelp
          className="lg:col-span-3"
          help="Optional internal notes about the purpose of the code, campaign details, or contributor tier."
          label="Description or Campaign Notes"
        >
          <textarea
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
            onChange={(event) => updateFormField('description', event.target.value)}
            placeholder="Description or campaign notes"
            value={formState.description}
          />
        </FieldWithHelp>
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
          <FieldWithHelp help="Search promo codes by code, name, or description." label="Search">
            <input
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-200/60"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search code, name, description"
              value={query}
            />
          </FieldWithHelp>
          <FieldWithHelp
            help="Filter promo codes by status, such as active or needs review."
            label="Status Filter"
          >
            <select
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
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
          </FieldWithHelp>
          <FieldWithHelp
            help="Sort promo codes by created date or other available sorting options."
            label="Sort"
          >
            <select
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-violet-200/60"
              onChange={(event) => setSort(event.target.value)}
              value={sort}
            >
              <option value="created">Created date</option>
              <option value="expires">Expiration</option>
              <option value="redemptions">Redemptions</option>
              <option value="status">Sync status</option>
            </select>
          </FieldWithHelp>
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
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => openEditModal(promoCode)} type="button">Edit</button>
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('validate', promoCode)} type="button">Validate</button>
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('refresh', promoCode)} type="button">Refresh</button>
                        <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('repair', promoCode)} type="button">Repair</button>
                        {(!promoCode.stripe_coupon_id || !promoCode.stripe_promotion_code_id || promoCode.stripe_sync_status === 'missing') ? (
                          <button className="rounded-xl border border-white/12 px-3 py-2 text-xs text-white hover:bg-white/10" onClick={() => void runAction('recreate', promoCode)} type="button">Recreate</button>
                        ) : null}
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
