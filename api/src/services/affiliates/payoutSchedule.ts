export const AFFILIATE_PAYOUT_THRESHOLD_USD = 5000

export function getAffiliatePayoutCutoffDate(referenceDate = new Date()) {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  )
}

export function getAffiliateNextPayoutDate(referenceDate = new Date()) {
  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1)
}

export function getDaysUntilAffiliatePayout(referenceDate = new Date()) {
  const nextPayoutDate = getAffiliateNextPayoutDate(referenceDate)
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.max(0, Math.ceil((nextPayoutDate.getTime() - referenceDate.getTime()) / msPerDay))
}
