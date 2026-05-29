export const HAMSA_PREP_IMAGE = '/hamsa/hamsa-prep.png'
const HAMSA_APP_URL = '/hamsa-app/'
const HAMSA_MOBILE_APP_URL = '/hamsa-mobile-app/'

export const hamsaFeatureCallouts = [
  'Scalar & transcendental resonance technology',
  'Deep meditative and restorative environments',
  'Sacred geometry-inspired energetic systems',
  'Designed for calm, focus, stillness & coherence',
  'Exclusive to REGEN subscribers',
]

export const hamsaPreviewCopy = {
  body:
    'HAMSA™ is an immersive RAYD8® environment designed to support moments of stillness, relaxation, meditation, and energetic balance through a focused transcendental experience.',
  detail:
    'Users can personalize their experience through multiple session modes, body focus options, audio support, and adaptable pacing preferences — allowing HAMSA™ to fit naturally into your daily wellness routine.',
  subtitle: 'A next-generation transcendental field experience.',
  title: 'HAMSA™',
}

export function detectHamsaAppUrl() {
  if (typeof window === 'undefined') {
    return HAMSA_APP_URL
  }

  const isTouch =
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.navigator.maxTouchPoints > 0
  const isTabletOrMobile = window.innerWidth < 1200 && isTouch

  return isTabletOrMobile ? HAMSA_MOBILE_APP_URL : HAMSA_APP_URL
}
