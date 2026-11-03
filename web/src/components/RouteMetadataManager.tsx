import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { SeoMetadataPayload } from '../services/admin'
import { getSeoMetadata } from '../services/seo'
import {
  containsMedBed,
  PUBLIC_HOME_DESCRIPTION,
  PUBLIC_HOME_TITLE,
  PUBLIC_OG_IMAGE,
  PUBLIC_SITE_ORIGIN,
  PUBLIC_START_DESCRIPTION,
  PUBLIC_START_TITLE,
} from '../services/publicSeo'

const seoMetadataCache = new Map<string, SeoMetadataPayload>()
const publicSeoPaths = new Set(['/', '/start', '/subscription', '/success', '/privacy', '/terms'])

function localPublicMetadata(path: '/' | '/start'): SeoMetadataPayload {
  const isHome = path === '/'
  const title = isHome ? PUBLIC_HOME_TITLE : PUBLIC_START_TITLE
  const description = isHome ? PUBLIC_HOME_DESCRIPTION : PUBLIC_START_DESCRIPTION
  const url = isHome ? `${PUBLIC_SITE_ORIGIN}/` : `${PUBLIC_SITE_ORIGIN}/start`

  return {
    canonicalUrl: url,
    description,
    follow: true,
    index: true,
    keywords: isHome ? ['RAYD8', 'scalar resonance'] : ['RAYD8', 'relaxation', 'daily ritual'],
    og: {
      description,
      image: PUBLIC_OG_IMAGE,
      title,
      type: 'website',
      url,
    },
    path,
    priority: isHome ? 100 : 90,
    routeType: isHome ? 'landing' : 'conversion',
    title,
  }
}

const localPublicSeo: Partial<Record<string, SeoMetadataPayload>> = {
  '/': localPublicMetadata('/'),
  '/start': localPublicMetadata('/start'),
}

function ensureMetaTag(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector)

  if (!element) {
    element = document.createElement('meta')
    document.head.appendChild(element)
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element?.setAttribute(key, value)
  })

  return element
}

function ensureCanonicalTag() {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')

  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }

  return element
}

function applySeoMetadata(metadata: SeoMetadataPayload) {
  document.title = metadata.title

  ensureMetaTag('meta[name="description"]', {
    content: metadata.description,
    name: 'description',
  })

  ensureMetaTag('meta[name="robots"]', {
    content: `${metadata.index ? 'index' : 'noindex'},${metadata.follow ? 'follow' : 'nofollow'}`,
    name: 'robots',
  })

  ensureMetaTag('meta[property="og:title"]', {
    content: metadata.og.title ?? metadata.title,
    property: 'og:title',
  })
  ensureMetaTag('meta[property="og:description"]', {
    content: metadata.og.description ?? metadata.description,
    property: 'og:description',
  })
  ensureMetaTag('meta[property="og:type"]', {
    content: metadata.og.type ?? 'website',
    property: 'og:type',
  })

  if (metadata.og.url ?? metadata.canonicalUrl) {
    ensureMetaTag('meta[property="og:url"]', {
      content: metadata.og.url ?? metadata.canonicalUrl ?? '',
      property: 'og:url',
    })
  }

  if (metadata.og.image) {
    ensureMetaTag('meta[property="og:image"]', {
      content: metadata.og.image,
      property: 'og:image',
    })
  }

  const twitterTitle = metadata.og.title ?? metadata.title
  const twitterDescription = metadata.og.description ?? metadata.description
  ensureMetaTag('meta[name="twitter:card"]', {
    content: 'summary_large_image',
    name: 'twitter:card',
  })
  ensureMetaTag('meta[name="twitter:title"]', {
    content: twitterTitle,
    name: 'twitter:title',
  })
  ensureMetaTag('meta[name="twitter:description"]', {
    content: twitterDescription,
    name: 'twitter:description',
  })
  if (metadata.og.image) {
    ensureMetaTag('meta[name="twitter:image"]', {
      content: metadata.og.image,
      name: 'twitter:image',
    })
  }

  const canonical = ensureCanonicalTag()

  if (metadata.canonicalUrl) {
    canonical.setAttribute('href', metadata.canonicalUrl)
  }
}

function applyPrivateRouteDefaults(path: string) {
  const title =
    path.startsWith('/admin')
      ? 'RAYD8® Admin'
      : path.startsWith('/dashboard')
        ? 'RAYD8® Dashboard'
        : 'RAYD8® Amrita'

  applySeoMetadata({
    canonicalUrl: typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : null,
    description: 'RAYD8® Amrita controlled playback environment.',
    follow: false,
    index: false,
    keywords: ['RAYD8'],
    og: {
      description: 'RAYD8® Amrita controlled playback environment.',
      title,
      type: 'website',
      url: typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : undefined,
    },
    path,
    priority: 0,
    routeType: 'support',
    title,
  })
}

function isGenericAmritaFallback(metadata: SeoMetadataPayload) {
  return (
    metadata.title === 'RAYD8® Amrita' &&
    metadata.description === 'RAYD8® Amrita controlled playback environment.'
  )
}

function sanitizePublicSeo(metadata: SeoMetadataPayload, fallback?: SeoMetadataPayload) {
  const titleFallback = fallback?.title ?? PUBLIC_HOME_TITLE
  const descriptionFallback = fallback?.description ?? PUBLIC_HOME_DESCRIPTION
  const title = containsMedBed(metadata.title) ? titleFallback : metadata.title
  const description = containsMedBed(metadata.description) ? descriptionFallback : metadata.description
  const ogTitle = containsMedBed(metadata.og.title ?? '') ? titleFallback : (metadata.og.title ?? title)
  const ogDescription = containsMedBed(metadata.og.description ?? '')
    ? descriptionFallback
    : (metadata.og.description ?? description)

  return {
    ...metadata,
    description,
    og: {
      ...metadata.og,
      description: ogDescription,
      title: ogTitle,
    },
    title,
  }
}

export function RouteMetadataManager() {
  const location = useLocation()

  useEffect(() => {
    const nextPath = location.pathname || '/'
    const localMetadata = localPublicSeo[nextPath]

    if (!publicSeoPaths.has(nextPath)) {
      applyPrivateRouteDefaults(nextPath)
      return
    }

    if (localMetadata) {
      applySeoMetadata(localMetadata)
    }

    const cachedMetadata = seoMetadataCache.get(nextPath)

    if (cachedMetadata) {
      applySeoMetadata(cachedMetadata)
      return
    }

    let cancelled = false

    void getSeoMetadata(nextPath)
      .then((metadata) => {
        if (cancelled) {
          return
        }

        if (localMetadata && isGenericAmritaFallback(metadata)) {
          return
        }

        const sanitized = sanitizePublicSeo(metadata, localMetadata)
        seoMetadataCache.set(nextPath, sanitized)
        applySeoMetadata(sanitized)
      })
      .catch(() => {
        if (!cancelled && !localMetadata) {
          applyPrivateRouteDefaults(nextPath)
        }
      })

    return () => {
      cancelled = true
    }
  }, [location.pathname])

  return null
}
