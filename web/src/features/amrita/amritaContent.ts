export const AMRITA_CARD_IMAGE = '/amrita_app/images/RAYD8_Amrita.png'
export const AMRITA_LAUNCH_BANNER_END = '2026-06-30T23:59:59-07:00'

export const amritaMembershipBenefits = [
  '500 Monthly Hours',
  'Unlimited HAMSA',
  'Unlimited AMRITA',
  'Priority Access To Future Releases',
] as const

export const regenTierFeatures = [
  '250 Hours',
  'Expansion',
  'Premium',
  'REGEN',
  'HAMSA Access',
] as const

export const amritaTierFeatures = [
  '500 Hours',
  'Expansion',
  'Premium',
  'REGEN',
  'Unlimited HAMSA',
  'Unlimited AMRITA',
  'Full Ecosystem Access',
] as const

export const amritaDescription =
  'RAYD8 Amrita represents the most advanced level of the RAYD8 platform. Combining Expansion, Premium, REGEN, HAMSA and unlimited AMRITA access into a single membership experience, Amrita provides access to the complete RAYD8 ecosystem for advanced rejuvenation, customization and exploration.'

export function isAmritaLaunchBannerActive(now = new Date()) {
  return now.getTime() <= new Date(AMRITA_LAUNCH_BANNER_END).getTime()
}
