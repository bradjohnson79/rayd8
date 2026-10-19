import type { SpectralId } from './palette.js'

export type SigilDomain = 'physical' | 'emotional' | 'mental' | 'causal'

export interface DesignSpec {
  rings: number
  spokes: number
  spinDegrees: number
  polygonSides: number
  innerRadius: number
  domain: SigilDomain
}

const DOMAIN_PREVIEW: Record<SigilDomain, string> = {
  physical: '#2fbfa0',
  emotional: '#e46aa8',
  mental: '#6a7dff',
  causal: '#c084fc',
}

const FORBIDDEN_SVG =
  /<\s*(script|foreignObject|image|use|iframe|embed|object|style)\b|\son[a-z]+\s*=|javascript:|href\s*=\s*["']?\s*https?:|xlink:href/i

export function hashCode(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function designSpecFromCode(code: string, domain: SigilDomain): DesignSpec {
  const hash = hashCode(`${domain}:${code}`)
  return {
    rings: 2 + (hash % 3),
    spokes: 5 + (hash % 6),
    spinDegrees: (hash >>> 8) % 60,
    polygonSides: 3 + ((hash >>> 12) % 4),
    innerRadius: 120 + ((hash >>> 16) % 80),
    domain,
  }
}

function polygonPoints(sides: number, radius: number, spinDegrees: number) {
  const points: string[] = []
  for (let index = 0; index < sides; index += 1) {
    const angle = ((Math.PI * 2) / sides) * index + (spinDegrees * Math.PI) / 180
    const x = 512 + Math.cos(angle) * radius
    const y = 512 + Math.sin(angle) * radius
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return points.join(' ')
}

export function renderSigilSvg(spec: DesignSpec, monochrome: boolean) {
  const stroke = monochrome ? '#f4f7fb' : DOMAIN_PREVIEW[spec.domain]
  const shapes: string[] = []

  for (let ring = 1; ring <= spec.rings; ring += 1) {
    const radius = 140 + ring * 90
    shapes.push(
      `<circle cx="512" cy="512" r="${radius}" fill="none" stroke="${stroke}" stroke-width="8"/>`,
    )
  }

  for (let spoke = 0; spoke < spec.spokes; spoke += 1) {
    const angle = (Math.PI * 2 * spoke) / spec.spokes + (spec.spinDegrees * Math.PI) / 180
    const x2 = 512 + Math.cos(angle) * 420
    const y2 = 512 + Math.sin(angle) * 420
    shapes.push(
      `<line x1="512" y1="512" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${stroke}" stroke-width="6"/>`,
    )
  }

  shapes.push(
    `<polygon points="${polygonPoints(spec.polygonSides, spec.innerRadius, spec.spinDegrees)}" fill="none" stroke="${stroke}" stroke-width="10"/>`,
  )

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">`,
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`,
    ...shapes,
    `</g>`,
    `</svg>`,
  ].join('')
}

export function svgHash(svg: string) {
  let hash = 2166136261
  for (let index = 0; index < svg.length; index += 1) {
    hash ^= svg.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function sanitizeSigilSvg(svg: string): { ok: true; svg: string } | { ok: false; reason: string } {
  if (FORBIDDEN_SVG.test(svg)) {
    return { ok: false, reason: 'SVG contains a forbidden feature.' }
  }

  if (!svg.includes('viewBox="0 0 1024 1024"')) {
    return { ok: false, reason: 'SVG viewBox must be 0 0 1024 1024.' }
  }

  if (!/<circle\b|<polygon\b|<line\b|<path\b/.test(svg)) {
    return { ok: false, reason: 'SVG has no drawable geometry.' }
  }

  return { ok: true, svg }
}

const FRAME_REFERENCE_PX = 140

/** Maps a screen-pixel contour to viewBox units at the assumption-frame size. */
export function contourUnits(outlineCssPx: number, framePx = FRAME_REFERENCE_PX) {
  const px = Number.isFinite(outlineCssPx) ? Math.min(10, Math.max(3, outlineCssPx)) : 3
  const frame = framePx > 0 ? framePx : FRAME_REFERENCE_PX
  return (px / frame) * 1024
}

/**
 * Draws a white outer stroke behind the original geometry.
 * The original strokes stay on top, so internal line weight and transparent gaps are unchanged.
 */
export function renderContouredSigil(svg: string, outlineCssPx: number) {
  const extra = contourUnits(outlineCssPx) * 2
  const contoured = svg.replace(
    /<g fill="none" stroke-linecap="round" stroke-linejoin="round">([\s\S]*?)<\/g>/,
    (group, inner: string) => {
      const underlay = inner
        .replace(/stroke="[^"]*"/g, 'stroke="#ffffff"')
        .replace(/stroke-width="([0-9.]+)"/g, (_match, width: string) => {
          return `stroke-width="${(Number(width) + extra).toFixed(2)}"`
        })
      return `<g fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">${underlay}</g>${group}`
    },
  )
  const sanitized = sanitizeSigilSvg(contoured)
  return sanitized.ok ? sanitized.svg : svg
}

export function geometrySignature(spec: DesignSpec) {
  return `${spec.domain}:${spec.rings}:${spec.spokes}:${spec.polygonSides}:${spec.innerRadius}`
}

export function domainPreviewColor(domain: SigilDomain): SpectralId {
  switch (domain) {
    case 'physical':
      return 'aqua'
    case 'emotional':
      return 'red'
    case 'mental':
      return 'blue'
    case 'causal':
      return 'violet'
    default:
      return 'white'
  }
}
