export const AMRITA_CARD_IMAGE = '/amrita_app/images/RAYD8_Amrita.png'
export const AMRITA_LAUNCH_BANNER_END = '2026-06-30T23:59:59-07:00'
export const AMRITA_PRICE_LINE = 'Only $29.99 USD Per Month'
export const AMRITA_VIDEO_HOURS_LINE = '500 monthly hours for video sessions'
export const AMRITA_APP_LINE = 'Unlimited AMRITA app'

export const amritaMembershipBenefits = [
  AMRITA_VIDEO_HOURS_LINE,
  'Unlimited HAMSA',
  AMRITA_APP_LINE,
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
  AMRITA_VIDEO_HOURS_LINE,
  'Expansion',
  'Premium',
  'REGEN',
  'Unlimited HAMSA',
  AMRITA_APP_LINE,
  'Full Ecosystem Access',
] as const

export const amritaDescription =
  'RAYD8 Amrita includes 500 monthly hours for the video sessions (Expansion, Premium, and REGEN), plus Unlimited HAMSA and unlimited use of the AMRITA app.'

export function isAmritaLaunchBannerActive(now = new Date()) {
  return now.getTime() <= new Date(AMRITA_LAUNCH_BANNER_END).getTime()
}
