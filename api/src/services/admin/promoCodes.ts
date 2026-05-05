import { and, count, desc, eq, or } from 'drizzle-orm'
import Stripe from 'stripe'
import { db } from '../../db/client.js'
import { rayd8PromoCodeRedemptions, rayd8PromoCodes } from '../../db/schema.js'
import { env } from '../../env.js'

const stripeClient = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as never,
    })
  : null

type PromoCodeDiscountType = 'amount' | 'percent'
type PromoCodeDuration = 'forever' | 'once' | 'repeating'
type PromoCodePlan = 'all' | 'amrita' | 'regen'
type PromoCodeSyncStatus = 'error' | 'inactive' | 'mismatch' | 'missing' | 'pending' | 'synced'

export interface AdminPromoCodeRecord {
  amount_off: number | null
  applies_to_plan: PromoCodePlan
  archived_at: string | null
  code: string
  created_at: string
  currency: string
  description: string | null
  discount_type: PromoCodeDiscountType
  duration: PromoCodeDuration
  duration_in_months: number | null
  expires_at: string | null
  id: string
  is_active: boolean
  max_redemptions: number | null
  name: string
  percent_off: number | null
  stripe_coupon_id: string | null
  stripe_environment: string
  stripe_promotion_code_id: string | null
  stripe_sync_error: string | null
  stripe_sync_status: PromoCodeSyncStatus
  times_redeemed: number
  updated_at: string
}

export interface AdminPromoCodeRedemptionRecord {
  amount_discounted: number | null
  code: string
  created_at: string
  currency: string
  customer_email: string | null
  id: string
  status: string
  stripe_checkout_session_id: string | null
  stripe_customer_id: string | null
  stripe_invoice_id: string | null
  stripe_subscription_id: string | null
  user_id: string | null
}

export interface AdminPromoCodeValidationResult {
  checkedAt: string
  messages: string[]
  status: PromoCodeSyncStatus
}

export interface CreatePromoCodeInput {
  amountOff?: number | null
  appliesToPlan?: PromoCodePlan
  code: string
  description?: string | null
  discountType: PromoCodeDiscountType
  duration: PromoCodeDuration
  durationInMonths?: number | null
  expiresAt?: string | null
  maxRedemptions?: number | null
  name: string
  percentOff?: number | null
}

export interface UpdatePromoCodeInput {
  appliesToPlan?: PromoCodePlan
  description?: string | null
  isActive?: boolean
  name?: string
}

export interface ListPromoCodesInput {
  query?: string
  sort?: 'created' | 'expires' | 'redemptions' | 'status'
  status?: 'active' | 'all' | 'archived' | 'expired' | 'inactive' | PromoCodeSyncStatus
}

const codePattern = /^[A-Z0-9_-]{3,40}$/

function stripeEnvironment() {
  if (!env.STRIPE_SECRET_KEY) {
    return 'not_configured'
  }

  if (env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
    return 'live'
  }

  if (env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    return 'test'
  }

  return 'unknown'
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase()
}

function toUnixSeconds(value: Date | null) {
  return value ? Math.floor(value.getTime() / 1000) : undefined
}

function fromUnixSeconds(value?: number | null) {
  return typeof value === 'number' ? new Date(value * 1000) : null
}

function parseDate(value?: string | null) {
  if (!value) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Expiration date is invalid.')
  }

  if (date <= new Date()) {
    throw new Error('Expiration date must be in the future.')
  }

  return date
}

function serializePromoCode(
  row: typeof rayd8PromoCodes.$inferSelect,
  redemptionCount = row.timesRedeemed,
): AdminPromoCodeRecord {
  return {
    amount_off: row.amountOff,
    applies_to_plan: row.appliesToPlan,
    archived_at: row.archivedAt?.toISOString() ?? null,
    code: row.code,
    created_at: row.createdAt.toISOString(),
    currency: row.currency,
    description: row.description,
    discount_type: row.discountType,
    duration: row.duration,
    duration_in_months: row.durationInMonths,
    expires_at: row.expiresAt?.toISOString() ?? null,
    id: row.id,
    is_active: row.isActive,
    max_redemptions: row.maxRedemptions,
    name: row.name,
    percent_off: row.percentOff,
    stripe_coupon_id: row.stripeCouponId,
    stripe_environment: row.stripeEnvironment,
    stripe_promotion_code_id: row.stripePromotionCodeId,
    stripe_sync_error: row.stripeSyncError,
    stripe_sync_status: row.stripeSyncStatus,
    times_redeemed: redemptionCount,
    updated_at: row.updatedAt.toISOString(),
  }
}

function serializeRedemption(
  row: typeof rayd8PromoCodeRedemptions.$inferSelect,
): AdminPromoCodeRedemptionRecord {
  return {
    amount_discounted: row.amountDiscounted,
    code: row.code,
    created_at: row.createdAt.toISOString(),
    currency: row.currency,
    customer_email: row.customerEmail,
    id: row.id,
    status: row.status,
    stripe_checkout_session_id: row.stripeCheckoutSessionId,
    stripe_customer_id: row.stripeCustomerId,
    stripe_invoice_id: row.stripeInvoiceId,
    stripe_subscription_id: row.stripeSubscriptionId,
    user_id: row.userId,
  }
}

function validateCreateInput(input: CreatePromoCodeInput) {
  const code = normalizeCode(input.code)
  const name = input.name.trim()

  if (!codePattern.test(code)) {
    throw new Error('Promo code must be 3-40 characters using letters, numbers, dashes, or underscores.')
  }

  if (!name) {
    throw new Error('Promo code name is required.')
  }

  if (input.discountType === 'percent') {
    if (!Number.isInteger(input.percentOff) || !input.percentOff || input.percentOff < 1 || input.percentOff > 100) {
      throw new Error('Percent discount must be a whole number from 1 to 100.')
    }
  } else if (!Number.isInteger(input.amountOff) || !input.amountOff || input.amountOff < 1) {
    throw new Error('Fixed amount discount must be at least 1 cent.')
  }

  if (input.duration === 'repeating') {
    if (!Number.isInteger(input.durationInMonths) || !input.durationInMonths || input.durationInMonths < 1) {
      throw new Error('Repeating promo codes require duration in months.')
    }
  }

  if (input.duration !== 'repeating' && input.durationInMonths) {
    throw new Error('Duration in months only applies to repeating promo codes.')
  }

  if (input.maxRedemptions != null && (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions < 1)) {
    throw new Error('Max redemptions must be a positive whole number.')
  }

  return {
    ...input,
    appliesToPlan: input.appliesToPlan ?? 'regen',
    code,
    currency: 'usd',
    expiresAtDate: parseDate(input.expiresAt),
    name,
  }
}

async function getPromoCodeByCode(code: string) {
  if (!db) {
    return null
  }

  const [record] = await db
    .select()
    .from(rayd8PromoCodes)
    .where(eq(rayd8PromoCodes.code, code))
    .limit(1)

  return record ?? null
}

async function getActiveStripePromotionCodeByCode(code: string) {
  if (!stripeClient) {
    return null
  }

  const promotionCodes = await stripeClient.promotionCodes.list({
    active: true,
    code,
    limit: 1,
  })

  return promotionCodes.data[0] ?? null
}

async function getRegenProductId() {
  if (!stripeClient || !env.STRIPE_REGEN_PRICE_ID) {
    return null
  }

  const price = await stripeClient.prices.retrieve(env.STRIPE_REGEN_PRICE_ID).catch((error) => {
    const message = error instanceof Error ? error.message : ''

    if (stripeEnvironment() === 'test' && message.includes('similar object exists in live mode')) {
      console.warn(
        'Skipping Stripe product restriction for test-mode promo code because STRIPE_REGEN_PRICE_ID belongs to live mode.',
      )
      return null
    }

    throw error
  })

  if (!price) {
    return null
  }

  return typeof price.product === 'string' ? price.product : price.product.id
}

function isStripeMissingError(error: unknown) {
  return error instanceof Stripe.errors.StripeError && error.statusCode === 404
}

async function getPromoCodeById(id: string) {
  if (!db) {
    return null
  }

  const [record] = await db
    .select()
    .from(rayd8PromoCodes)
    .where(eq(rayd8PromoCodes.id, id))
    .limit(1)

  return record ?? null
}

async function getRedemptionCountsByPromoCodeId() {
  if (!db) {
    return new Map<string, number>()
  }

  const rows = await db
    .select({
      count: count(),
      promoCodeId: rayd8PromoCodeRedemptions.promoCodeId,
    })
    .from(rayd8PromoCodeRedemptions)
    .groupBy(rayd8PromoCodeRedemptions.promoCodeId)

  return new Map(
    rows
      .filter((row): row is { count: number; promoCodeId: string } => Boolean(row.promoCodeId))
      .map((row) => [row.promoCodeId, row.count]),
  )
}

async function getRedemptionCountForPromoCode(promoCodeId: string) {
  if (!db) {
    return 0
  }

  const [row] = await db
    .select({ count: count() })
    .from(rayd8PromoCodeRedemptions)
    .where(eq(rayd8PromoCodeRedemptions.promoCodeId, promoCodeId))

  return row?.count ?? 0
}

export async function listPromoCodes(input: ListPromoCodesInput = {}) {
  if (!db) {
    return {
      environment: stripeEnvironment(),
      promoCodes: [],
      summary: {
        active: 0,
        archived: 0,
        errors: 0,
        expired: 0,
        inactive: 0,
        total: 0,
        totalRedemptions: 0,
      },
    }
  }

  const rows = await db.select().from(rayd8PromoCodes).orderBy(desc(rayd8PromoCodes.createdAt))
  const redemptionCounts = await getRedemptionCountsByPromoCodeId()
  const now = Date.now()
  const query = input.query?.trim().toLowerCase()
  const status = input.status ?? 'all'

  const filtered = rows.filter((row) => {
    const isExpired = Boolean(row.expiresAt && row.expiresAt.getTime() <= now)
    const isArchived = Boolean(row.archivedAt)

    if (query && !`${row.code} ${row.name} ${row.description ?? ''}`.toLowerCase().includes(query)) {
      return false
    }

    if (status === 'archived') {
      return isArchived
    }

    if (isArchived) {
      return false
    }

    if (status === 'active') {
      return row.isActive && !isExpired
    }

    if (status === 'inactive') {
      return !row.isActive
    }

    if (status === 'expired') {
      return isExpired
    }

    if (['error', 'inactive', 'mismatch', 'missing', 'pending', 'synced'].includes(status)) {
      return row.stripeSyncStatus === status
    }

    return true
  })

  const sorted = [...filtered].sort((left, right) => {
    switch (input.sort) {
      case 'expires':
        return (left.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (right.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
      case 'redemptions':
        return (redemptionCounts.get(right.id) ?? 0) - (redemptionCounts.get(left.id) ?? 0)
      case 'status':
        return left.stripeSyncStatus.localeCompare(right.stripeSyncStatus)
      default:
        return right.createdAt.getTime() - left.createdAt.getTime()
    }
  })

  return {
    environment: stripeEnvironment(),
    promoCodes: sorted.map((row) => serializePromoCode(row, redemptionCounts.get(row.id) ?? 0)),
    summary: {
      active: rows.filter((row) => row.isActive && !row.archivedAt && (!row.expiresAt || row.expiresAt.getTime() > now)).length,
      archived: rows.filter((row) => row.archivedAt).length,
      errors: rows.filter((row) => ['error', 'mismatch', 'missing'].includes(row.stripeSyncStatus)).length,
      expired: rows.filter((row) => row.expiresAt && row.expiresAt.getTime() <= now).length,
      inactive: rows.filter((row) => !row.isActive && !row.archivedAt).length,
      total: rows.length,
      totalRedemptions: [...redemptionCounts.values()].reduce((total, value) => total + value, 0),
    },
  }
}

export async function createPromoCode(input: CreatePromoCodeInput, adminUserId?: string) {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  if (!stripeClient) {
    throw new Error('Stripe is not configured.')
  }

  const payload = validateCreateInput(input)
  const existingLocalCode = await getPromoCodeByCode(payload.code)

  if (existingLocalCode) {
    throw new Error(`Promo code ${payload.code} already exists in the Admin database.`)
  }

  const existingStripePromotionCode = await getActiveStripePromotionCodeByCode(payload.code)

  if (existingStripePromotionCode) {
    throw new Error(`An active Stripe promotion code with code ${payload.code} already exists.`)
  }

  const productId = payload.appliesToPlan === 'regen' ? await getRegenProductId() : null
  const metadata = {
    rayd8_applies_to_plan: payload.appliesToPlan,
    rayd8_code: payload.code,
  }
  let coupon: Stripe.Coupon | null = null
  let promotionCode: Stripe.PromotionCode | null = null

  try {
    coupon = await stripeClient.coupons.create({
      applies_to: productId ? { products: [productId] } : undefined,
      amount_off: payload.discountType === 'amount' ? payload.amountOff ?? undefined : undefined,
      currency: payload.discountType === 'amount' ? payload.currency : undefined,
      duration: payload.duration,
      duration_in_months: payload.duration === 'repeating' ? payload.durationInMonths ?? undefined : undefined,
      max_redemptions: payload.maxRedemptions ?? undefined,
      metadata,
      name: payload.name,
      percent_off: payload.discountType === 'percent' ? payload.percentOff ?? undefined : undefined,
      redeem_by: toUnixSeconds(payload.expiresAtDate),
    })

    promotionCode = await stripeClient.promotionCodes.create({
      active: true,
      code: payload.code,
      expires_at: toUnixSeconds(payload.expiresAtDate),
      max_redemptions: payload.maxRedemptions ?? undefined,
      metadata,
      promotion: {
        coupon: coupon.id,
        type: 'coupon',
      },
    })

    const [record] = await db
      .insert(rayd8PromoCodes)
      .values({
        amountOff: payload.discountType === 'amount' ? payload.amountOff ?? null : null,
        appliesToPlan: payload.appliesToPlan,
        code: payload.code,
        createdByAdminId: adminUserId,
        currency: payload.currency,
        description: payload.description?.trim() || null,
        discountType: payload.discountType,
        duration: payload.duration,
        durationInMonths: payload.duration === 'repeating' ? payload.durationInMonths ?? null : null,
        expiresAt: payload.expiresAtDate,
        isActive: true,
        maxRedemptions: payload.maxRedemptions ?? null,
        name: payload.name,
        percentOff: payload.discountType === 'percent' ? payload.percentOff ?? null : null,
        stripeCouponId: coupon.id,
        stripeEnvironment: stripeEnvironment(),
        stripePromotionCodeId: promotionCode.id,
        stripeSyncStatus: 'synced',
        timesRedeemed: promotionCode.times_redeemed ?? 0,
      })
      .returning()

    return serializePromoCode(record)
  } catch (error) {
    if (promotionCode) {
      await stripeClient.promotionCodes.update(promotionCode.id, { active: false }).catch(() => null)
    }

    if (coupon) {
      await stripeClient.coupons.del(coupon.id).catch((cleanupError) => {
        console.error('Unable to clean up orphaned Stripe coupon after promo code create failure.', {
          couponId: coupon?.id,
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error',
        })
      })
    }

    throw error
  }
}

export async function getPromoCodeDetails(id: string) {
  if (!db) {
    return null
  }

  const promoCode = await getPromoCodeById(id)

  if (!promoCode) {
    return null
  }

  const redemptions = await db
    .select()
    .from(rayd8PromoCodeRedemptions)
    .where(eq(rayd8PromoCodeRedemptions.promoCodeId, id))
    .orderBy(desc(rayd8PromoCodeRedemptions.createdAt))
    .limit(25)

  return {
    promoCode: serializePromoCode(promoCode, await getRedemptionCountForPromoCode(promoCode.id)),
    redemptions: redemptions.map(serializeRedemption),
  }
}

export async function updatePromoCode(id: string, input: UpdatePromoCodeInput) {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  const existing = await getPromoCodeById(id)

  if (!existing) {
    return null
  }

  const name = input.name?.trim()
  const description = input.description === undefined ? existing.description : input.description?.trim() || null
  const appliesToPlan = input.appliesToPlan ?? existing.appliesToPlan
  const isActive = input.isActive ?? existing.isActive

  if (name !== undefined && !name) {
    throw new Error('Promo code name cannot be empty.')
  }

  if (stripeClient && existing.stripeCouponId) {
    await stripeClient.coupons.update(existing.stripeCouponId, {
      metadata: {
        rayd8_applies_to_plan: appliesToPlan,
        rayd8_description: description ?? '',
      },
      name: name ?? existing.name,
    })
  }

  if (stripeClient && existing.stripePromotionCodeId) {
    await stripeClient.promotionCodes.update(existing.stripePromotionCodeId, {
      active: isActive,
      metadata: {
        rayd8_applies_to_plan: appliesToPlan,
        rayd8_code: existing.code,
        rayd8_description: description ?? '',
      },
    })
  }

  const [record] = await db
    .update(rayd8PromoCodes)
    .set({
      appliesToPlan,
      description,
      isActive,
      name: name ?? existing.name,
      stripeSyncStatus: isActive ? existing.stripeSyncStatus : 'inactive',
      updatedAt: new Date(),
    })
    .where(eq(rayd8PromoCodes.id, id))
    .returning()

  return serializePromoCode(record)
}

export async function deactivatePromoCode(id: string) {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  const existing = await getPromoCodeById(id)

  if (!existing) {
    return null
  }

  if (stripeClient && existing.stripePromotionCodeId) {
    await stripeClient.promotionCodes.update(existing.stripePromotionCodeId, { active: false })
  }

  const [record] = await db
    .update(rayd8PromoCodes)
    .set({
      isActive: false,
      stripeSyncError: null,
      stripeSyncStatus: 'inactive',
      updatedAt: new Date(),
    })
    .where(eq(rayd8PromoCodes.id, id))
    .returning()

  return serializePromoCode(record)
}

export async function archivePromoCode(id: string) {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  const [record] = await db
    .update(rayd8PromoCodes)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(rayd8PromoCodes.id, id))
    .returning()

  return record ? serializePromoCode(record) : null
}

export async function restorePromoCode(id: string) {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  const [record] = await db
    .update(rayd8PromoCodes)
    .set({
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(rayd8PromoCodes.id, id))
    .returning()

  return record ? serializePromoCode(record) : null
}

export async function validatePromoCodeWithStripe(id: string): Promise<AdminPromoCodeValidationResult | null> {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  if (!stripeClient) {
    throw new Error('Stripe is not configured.')
  }

  const existing = await getPromoCodeById(id)

  if (!existing) {
    return null
  }

  const messages: string[] = []
  let status: PromoCodeSyncStatus = 'synced'
  let stripeSyncError: string | null = null
  const localRedemptionCount = await getRedemptionCountForPromoCode(existing.id)

  try {
    if (!existing.stripeCouponId || !existing.stripePromotionCodeId) {
      status = 'missing'
      messages.push('Local record is missing Stripe coupon or promotion code IDs.')
    } else {
      const [coupon, promotionCode] = await Promise.all([
        stripeClient.coupons.retrieve(existing.stripeCouponId),
        stripeClient.promotionCodes.retrieve(existing.stripePromotionCodeId),
      ])

      if (coupon.deleted) {
        status = 'missing'
        messages.push('Stripe coupon is deleted or missing.')
      } else {
        if (coupon.duration !== existing.duration) {
          status = 'mismatch'
          messages.push('Coupon duration does not match local record.')
        }

        if ((coupon.duration_in_months ?? null) !== existing.durationInMonths) {
          status = 'mismatch'
          messages.push('Coupon duration in months does not match local record.')
        }

        if ((coupon.percent_off ? Math.round(coupon.percent_off) : null) !== existing.percentOff) {
          status = 'mismatch'
          messages.push('Coupon percent discount does not match local record.')
        }

        if ((coupon.amount_off ?? null) !== existing.amountOff) {
          status = 'mismatch'
          messages.push('Coupon fixed amount discount does not match local record.')
        }

        if ((coupon.max_redemptions ?? null) !== existing.maxRedemptions) {
          status = 'mismatch'
          messages.push('Coupon max redemptions does not match local record.')
        }

        if ((fromUnixSeconds(coupon.redeem_by)?.getTime() ?? null) !== (existing.expiresAt?.getTime() ?? null)) {
          status = 'mismatch'
          messages.push('Coupon expiration does not match local record.')
        }
      }

      if (!promotionCode.active && existing.isActive) {
        status = 'inactive'
        messages.push('Stripe promotion code is inactive.')
      }

      if (promotionCode.code.toUpperCase() !== existing.code) {
        status = 'mismatch'
        messages.push('Stripe promotion code text does not match local record.')
      }

      if ((promotionCode.max_redemptions ?? null) !== existing.maxRedemptions) {
        status = 'mismatch'
        messages.push('Promotion code max redemptions does not match local record.')
      }

      if ((fromUnixSeconds(promotionCode.expires_at)?.getTime() ?? null) !== (existing.expiresAt?.getTime() ?? null)) {
        status = 'mismatch'
        messages.push('Promotion code expiration does not match local record.')
      }

      if ((promotionCode.times_redeemed ?? 0) !== localRedemptionCount) {
        status = 'mismatch'
        messages.push(
          `Stripe reports ${promotionCode.times_redeemed ?? 0} redemption(s), but the local database has ${localRedemptionCount} recorded redemption row(s). Review webhook delivery; no customer rows were fabricated from aggregate Stripe counts.`,
        )
      }

      await db
        .update(rayd8PromoCodes)
        .set({
          isActive: promotionCode.active,
          stripeEnvironment: stripeEnvironment(),
          stripeSyncError: messages.length ? messages.join(' ') : null,
          stripeSyncStatus: status,
          timesRedeemed: localRedemptionCount,
          updatedAt: new Date(),
        })
        .where(eq(rayd8PromoCodes.id, id))
    }
  } catch (error) {
    if (isStripeMissingError(error)) {
      status = 'missing'
      messages.push('Stripe coupon or promotion code is missing.')
    } else {
      status = 'error'
      messages.push(error instanceof Error ? error.message : 'Stripe validation failed.')
    }

    stripeSyncError = messages.join(' ')

    await db
      .update(rayd8PromoCodes)
      .set({
        stripeSyncError,
        stripeSyncStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(rayd8PromoCodes.id, id))
  }

  if (messages.length === 0) {
    messages.push('Stripe coupon and promotion code match the local record.')
  }

  return {
    checkedAt: new Date().toISOString(),
    messages,
    status,
  }
}

export async function refreshPromoCodeFromStripe(id: string) {
  const validation = await validatePromoCodeWithStripe(id)

  if (!validation) {
    return null
  }

  const promoCode = await getPromoCodeById(id)
  return promoCode ? serializePromoCode(promoCode) : null
}

export async function repairPromoCodeSync(id: string) {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  if (!stripeClient) {
    throw new Error('Stripe is not configured.')
  }

  const existing = await getPromoCodeById(id)

  if (!existing) {
    return null
  }

  if (!existing.stripeCouponId || !existing.stripePromotionCodeId) {
    throw new Error('Cannot repair sync because this promo code is missing Stripe IDs.')
  }

  const retrievedCoupon = await stripeClient.coupons.retrieve(existing.stripeCouponId)

  if ('deleted' in retrievedCoupon && retrievedCoupon.deleted) {
    throw new Error('Cannot repair sync because the Stripe coupon is missing.')
  }

  const coupon = retrievedCoupon as Stripe.Coupon
  const promotionCode = await stripeClient.promotionCodes.retrieve(existing.stripePromotionCodeId)
  const localRedemptionCount = await getRedemptionCountForPromoCode(existing.id)
  const [record] = await db
    .update(rayd8PromoCodes)
    .set({
      amountOff: coupon.amount_off ?? null,
      code: normalizeCode(promotionCode.code),
      currency: coupon.currency ?? existing.currency,
      discountType: coupon.amount_off ? 'amount' : 'percent',
      duration: coupon.duration,
      durationInMonths: coupon.duration_in_months ?? null,
      expiresAt: fromUnixSeconds(promotionCode.expires_at ?? coupon.redeem_by),
      isActive: promotionCode.active,
      maxRedemptions: promotionCode.max_redemptions ?? coupon.max_redemptions ?? null,
      percentOff: coupon.percent_off ? Math.round(coupon.percent_off) : null,
      stripeEnvironment: stripeEnvironment(),
      stripeSyncError: null,
      stripeSyncStatus: promotionCode.active ? 'synced' : 'inactive',
      timesRedeemed: localRedemptionCount,
      updatedAt: new Date(),
    })
    .where(eq(rayd8PromoCodes.id, id))
    .returning()

  return serializePromoCode(record)
}

export async function recreateMissingPromoCode(id: string) {
  if (!db) {
    throw new Error('Database is not configured.')
  }

  if (!stripeClient) {
    throw new Error('Stripe is not configured.')
  }

  const existing = await getPromoCodeById(id)

  if (!existing) {
    return null
  }

  if (existing.stripeCouponId && existing.stripePromotionCodeId) {
    const validation = await validatePromoCodeWithStripe(id)

    if (validation?.status !== 'missing') {
      return serializePromoCode((await getPromoCodeById(id)) ?? existing)
    }
  }

  const productId = existing.appliesToPlan === 'regen' ? await getRegenProductId() : null
  const metadata = {
    rayd8_applies_to_plan: existing.appliesToPlan,
    rayd8_code: existing.code,
    rayd8_recreated_from_local_id: existing.id,
  }
  const coupon = await stripeClient.coupons.create({
    applies_to: productId ? { products: [productId] } : undefined,
    amount_off: existing.discountType === 'amount' ? existing.amountOff ?? undefined : undefined,
    currency: existing.discountType === 'amount' ? existing.currency : undefined,
    duration: existing.duration,
    duration_in_months: existing.duration === 'repeating' ? existing.durationInMonths ?? undefined : undefined,
    max_redemptions: existing.maxRedemptions ?? undefined,
    metadata,
    name: existing.name,
    percent_off: existing.discountType === 'percent' ? existing.percentOff ?? undefined : undefined,
    redeem_by: toUnixSeconds(existing.expiresAt),
  })
  const promotionCode = await stripeClient.promotionCodes.create({
    active: existing.isActive,
    code: existing.code,
    expires_at: toUnixSeconds(existing.expiresAt),
    max_redemptions: existing.maxRedemptions ?? undefined,
    metadata,
    promotion: {
      coupon: coupon.id,
      type: 'coupon',
    },
  })
  const [record] = await db
    .update(rayd8PromoCodes)
    .set({
      stripeCouponId: coupon.id,
      stripeEnvironment: stripeEnvironment(),
      stripePromotionCodeId: promotionCode.id,
      stripeSyncError: null,
      stripeSyncStatus: promotionCode.active ? 'synced' : 'inactive',
      timesRedeemed: promotionCode.times_redeemed ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(rayd8PromoCodes.id, id))
    .returning()

  return serializePromoCode(record)
}

export async function recordPromoCodeRedemption(input: {
  amountDiscounted?: number | null
  code?: string | null
  currency?: string | null
  customerEmail?: string | null
  stripeCheckoutSessionId?: string | null
  stripeCouponId?: string | null
  stripeCustomerId?: string | null
  stripeInvoiceId?: string | null
  stripePromotionCodeId?: string | null
  stripeSubscriptionId?: string | null
  userId?: string | null
}) {
  if (!db || (!input.stripePromotionCodeId && !input.stripeCouponId && !input.code)) {
    return
  }

  const [promoCode] = await db
    .select()
    .from(rayd8PromoCodes)
    .where(
      or(
        input.stripePromotionCodeId
          ? eq(rayd8PromoCodes.stripePromotionCodeId, input.stripePromotionCodeId)
          : undefined,
        input.stripeCouponId ? eq(rayd8PromoCodes.stripeCouponId, input.stripeCouponId) : undefined,
        input.code ? eq(rayd8PromoCodes.code, normalizeCode(input.code)) : undefined,
      ),
    )
    .limit(1)

  if (!promoCode) {
    return
  }

  if (!input.stripeCheckoutSessionId && input.stripeSubscriptionId) {
    const [existingRedemption] = await db
      .select({ id: rayd8PromoCodeRedemptions.id })
      .from(rayd8PromoCodeRedemptions)
      .where(
        and(
          eq(rayd8PromoCodeRedemptions.promoCodeId, promoCode.id),
          eq(rayd8PromoCodeRedemptions.stripeSubscriptionId, input.stripeSubscriptionId),
        ),
      )
      .limit(1)

    if (existingRedemption) {
      return
    }
  }

  if (!input.stripeCheckoutSessionId && !input.stripeSubscriptionId && input.stripeInvoiceId) {
    const [existingRedemption] = await db
      .select({ id: rayd8PromoCodeRedemptions.id })
      .from(rayd8PromoCodeRedemptions)
      .where(
        and(
          eq(rayd8PromoCodeRedemptions.promoCodeId, promoCode.id),
          eq(rayd8PromoCodeRedemptions.stripeInvoiceId, input.stripeInvoiceId),
        ),
      )
      .limit(1)

    if (existingRedemption) {
      return
    }
  }

  const inserted = await db
    .insert(rayd8PromoCodeRedemptions)
    .values({
      amountDiscounted: input.amountDiscounted ?? null,
      code: promoCode.code,
      currency: input.currency ?? promoCode.currency,
      customerEmail: input.customerEmail ?? null,
      promoCodeId: promoCode.id,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      stripeCouponId: input.stripeCouponId ?? promoCode.stripeCouponId,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripePromotionCodeId: input.stripePromotionCodeId ?? promoCode.stripePromotionCodeId,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      userId: input.userId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: rayd8PromoCodeRedemptions.id })

  if (inserted.length === 0) {
    return
  }

  const localRedemptionCount = await getRedemptionCountForPromoCode(promoCode.id)
  await db
    .update(rayd8PromoCodes)
    .set({
      timesRedeemed: localRedemptionCount,
      updatedAt: new Date(),
    })
    .where(eq(rayd8PromoCodes.id, promoCode.id))
}
