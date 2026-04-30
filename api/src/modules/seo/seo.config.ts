import { env } from '../../env.js'
import type { EffectiveSeoMetadata, SeoRouteManifestEntry } from './seo.types.js'

function buildAbsoluteUrl(path: string) {
  return new URL(path, env.APP_URL).toString()
}

export const seoRouteManifest: SeoRouteManifestEntry[] = [
  {
    canonicalUrl: buildAbsoluteUrl('/'),
    description:
      "RAYD8® is a living digital scalar-inspired visual resonance system designed to support focus, calmness, and regenerative states from any screen.",
    follow: true,
    index: true,
    keywords: ['RAYD8', 'scalar resonance', 'visual regeneration', 'biofield technology'],
    openGraph: {
      description:
        "Turn your space into a living field of regeneration with RAYD8® visual resonance technology.",
      title: 'RAYD8® Amrita | Living Visual Resonance',
      type: 'website',
      url: buildAbsoluteUrl('/'),
    },
    path: '/',
    priority: 100,
    routeType: 'landing',
    title: 'RAYD8® Amrita | Living Visual Resonance',
  },
  {
    canonicalUrl: buildAbsoluteUrl('/subscription'),
    description:
      'Choose your RAYD8® plan, start a free trial, or continue to secure REGEN checkout in one guided flow.',
    follow: true,
    index: true,
    keywords: ['RAYD8 subscription', 'REGEN checkout', 'free trial', 'visual recovery subscription'],
    openGraph: {
      description:
        'Start a free trial or continue to secure REGEN checkout to unlock the full RAYD8® experience.',
      title: 'Choose Your RAYD8® Plan | Subscription',
      type: 'website',
      url: buildAbsoluteUrl('/subscription'),
    },
    path: '/subscription',
    priority: 95,
    routeType: 'conversion',
    title: 'Choose Your RAYD8® Plan | Subscription',
  },
  {
    canonicalUrl: buildAbsoluteUrl('/success'),
    description:
      'Finalize your RAYD8® subscription activation and return to the dashboard once checkout is confirmed.',
    follow: true,
    index: true,
    keywords: ['RAYD8 success', 'subscription activation', 'checkout confirmation'],
    openGraph: {
      description:
        'Subscription success page for completing RAYD8® account activation after checkout.',
      title: 'Subscription Success | RAYD8®',
      type: 'website',
      url: buildAbsoluteUrl('/success'),
    },
    path: '/success',
    priority: 65,
    routeType: 'conversion',
    title: 'Subscription Success | RAYD8®',
  },
]

const seoRouteManifestMap = new Map(seoRouteManifest.map((route) => [route.path, route]))

export function normalizeSeoPath(value: string) {
  const nextValue = value.trim() || '/'

  try {
    const url = new URL(nextValue, env.APP_URL)
    const normalizedPath = url.pathname || '/'
    return normalizedPath.endsWith('/') && normalizedPath !== '/'
      ? normalizedPath.slice(0, -1)
      : normalizedPath
  } catch {
    if (!nextValue.startsWith('/')) {
      return `/${nextValue}`.replace(/\/+/g, '/')
    }

    return nextValue.endsWith('/') && nextValue !== '/' ? nextValue.slice(0, -1) : nextValue
  }
}

export function getSeoRouteManifestEntry(path: string) {
  return seoRouteManifestMap.get(normalizeSeoPath(path)) ?? null
}

export function listSeoRouteManifestPaths() {
  return seoRouteManifest.map((route) => route.path)
}

export function isPublicSeoPath(path: string) {
  return Boolean(getSeoRouteManifestEntry(path))
}

export function toFallbackSeoMetadata(path: string): EffectiveSeoMetadata {
  const normalizedPath = normalizeSeoPath(path)
  const manifestEntry = getSeoRouteManifestEntry(normalizedPath)

  if (manifestEntry) {
    return manifestEntry
  }

  const shouldIndex = !(normalizedPath.startsWith('/admin') || normalizedPath.startsWith('/dashboard'))

  return {
    canonicalUrl: buildAbsoluteUrl(normalizedPath),
    description: 'RAYD8® Amrita controlled playback environment.',
    follow: shouldIndex,
    index: shouldIndex,
    keywords: ['RAYD8'],
    openGraph: {
      description: 'RAYD8® Amrita controlled playback environment.',
      title: 'RAYD8® Amrita',
      type: 'website',
      url: buildAbsoluteUrl(normalizedPath),
    },
    path: normalizedPath,
    priority: 10,
    routeType: 'support',
    title: 'RAYD8® Amrita',
  }
}
