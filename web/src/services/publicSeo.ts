/** Keep these strings aligned with web/index.html, web/start.html, and api/src/modules/seo/seo.config.ts. */
export const PUBLIC_SITE_ORIGIN = 'https://rayd8.app'

export const PUBLIC_HOME_TITLE = 'RAYD8® | Next Level Digital Wellness System'

export const PUBLIC_HOME_DESCRIPTION =
  "RAYD8® is the world's first digital scalar-inspired visual resonance system designed to elevate your state physically, mentally, and energetically in minutes."

export const PUBLIC_START_TITLE = 'RAYD8® | A calm daily ritual'

export const PUBLIC_START_DESCRIPTION =
  'A visual and sound experience for relaxation. RAYD8® is a calm daily ritual you can play on your screen.'

export const PUBLIC_OG_IMAGE = `${PUBLIC_SITE_ORIGIN}/hero/RAYD8_Hero.png`

export function containsMedBed(value: string) {
  return /med\s*bed/i.test(value)
}
