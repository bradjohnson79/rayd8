import { eq } from 'drizzle-orm'
import { db, postgresClient } from '../src/db/client.js'
import { rayd8PromoCodes } from '../src/db/schema.js'
import { reissuePromoCode } from '../src/services/admin/promoCodes.js'

/**
 * Reissue a promo code that Stripe can no longer honour (exhausted redemption cap
 * or expired), minting a fresh Stripe coupon + promotion code with the same code text.
 *
 * Dry-run by default. Pass --apply to perform the reissue.
 *
 * Usage:
 *   tsx scripts/reissue-promo-code.ts --code=REGEN1MONTH
 *   tsx scripts/reissue-promo-code.ts --code=REGEN1MONTH --unlimited --apply
 *   tsx scripts/reissue-promo-code.ts --code=REGEN1MONTH --max-redemptions=100 --apply
 */
function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply')
  const unlimited = argv.includes('--unlimited')
  const codeArg = argv.find((arg) => arg.startsWith('--code='))
  const maxArg = argv.find((arg) => arg.startsWith('--max-redemptions='))

  return {
    apply,
    code: codeArg ? codeArg.split('=').slice(1).join('=').trim().toUpperCase() : null,
    hasMaxRedemptions: Boolean(maxArg),
    maxRedemptions: maxArg ? Number(maxArg.split('=')[1]) : null,
    unlimited,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (!options.code) {
    throw new Error('A --code=<PROMO_CODE> argument is required.')
  }

  if (!db) {
    throw new Error('Database is not configured (DATABASE_URL missing).')
  }

  if (options.hasMaxRedemptions && options.unlimited) {
    throw new Error('Use either --unlimited or --max-redemptions, not both.')
  }

  if (options.hasMaxRedemptions && (!Number.isInteger(options.maxRedemptions) || (options.maxRedemptions ?? 0) <= 0)) {
    throw new Error('--max-redemptions must be a positive whole number, or use --unlimited.')
  }

  const requestedMaxRedemptions = options.unlimited
    ? null
    : options.hasMaxRedemptions
      ? options.maxRedemptions
      : undefined

  const [existing] = await db
    .select()
    .from(rayd8PromoCodes)
    .where(eq(rayd8PromoCodes.code, options.code))
    .limit(1)

  if (!existing) {
    throw new Error(`No local promo code record found for ${options.code}.`)
  }

  const before = {
    code: existing.code,
    isActive: existing.isActive,
    maxRedemptions: existing.maxRedemptions,
    stripeCouponId: existing.stripeCouponId,
    stripePromotionCodeId: existing.stripePromotionCodeId,
    stripeSyncStatus: existing.stripeSyncStatus,
    timesRedeemed: existing.timesRedeemed,
  }

  if (!options.apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          before,
          requestedMaxRedemptions: requestedMaxRedemptions === undefined ? 'unchanged' : requestedMaxRedemptions,
          note: 'No writes performed. Re-run with --apply to reissue a fresh Stripe coupon + promotion code.',
        },
        null,
        2,
      ),
    )
    return
  }

  const reissued = await reissuePromoCode(existing.id, {
    maxRedemptions: requestedMaxRedemptions,
  })

  console.log(
    JSON.stringify(
      {
        mode: 'apply',
        before,
        after: reissued
          ? {
              code: reissued.code,
              isActive: reissued.is_active,
              maxRedemptions: reissued.max_redemptions,
              stripeCouponId: reissued.stripe_coupon_id,
              stripePromotionCodeId: reissued.stripe_promotion_code_id,
              stripeSyncStatus: reissued.stripe_sync_status,
              timesRedeemed: reissued.times_redeemed,
            }
          : null,
        note: 'Fresh Stripe coupon + promotion code minted with the same code text. Local redemption history preserved.',
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await postgresClient?.end({ timeout: 5 })
  })
