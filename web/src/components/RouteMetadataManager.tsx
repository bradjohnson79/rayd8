import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { SeoMetadataPayload } from '../services/admin'
import { getSeoMetadata } from '../services/seo'

const PUBLIC_HOME_TITLE = 'RAYD8 | Scalar Rejuvenation Technology'
const PUBLIC_HOME_DESCRIPTION =
  'RAYD8 is a digital scalar-inspired visual resonance experience you can stream on any screen.'

const seoMetadataCache = new Map<string, SeoMetadataPayload>()
const publicSeoPaths = new Set(['/', '/subscription', '/success', '/privacy', '/terms'])

function containsMedBed(value: string) {
  return /med\s*bed/i.test(value)
}

function withoutMedBed(value: string | undefined, fallback: string) {
  if (!value || containsMedBed(value)) {
    return fallback
  }

  return value
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

function sanitizeSeoMetadata(metadata: SeoMetadataPayload, path: string): SeoMetadataPayload {
  const titleFallback = path === '/' ? PUBLIC_HOME_TITLE : metadata.title
  const descriptionFallback = path === '/' ? PUBLIC_HOME_DESCRIPTION : metadata.description
  const title = path === '/' ? PUBLIC_HOME_TITLE : withoutMedBed(metadata.title, titleFallback)
  const description = path === '/' ? PUBLIC_HOME_DESCRIPTION : withoutMedBed(metadata.description, descriptionFallback)
  const ogTitle = path === '/' ? PUBLIC_HOME_TITLE : withoutMedBed(metadata.og.title, title)
  const ogDescription = path === '/' ? PUBLIC_HOME_DESCRIPTION : withoutMedBed(metadata.og.description, description)

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

    if (!publicSeoPaths.has(nextPath)) {
      applyPrivateRouteDefaults(nextPath)
      return
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

        const sanitized = sanitizeSeoMetadata(metadata, nextPath)
        seoMetadataCache.set(nextPath, sanitized)
        applySeoMetadata(sanitized)
      })
      .catch(() => {
        if (cancelled) {
          return
        }

        if (nextPath === '/') {
          applySeoMetadata({
            canonicalUrl: 'https://rayd8.app/',
            description: PUBLIC_HOME_DESCRIPTION,
            follow: true,
            index: true,
            keywords: ['RAYD8'],
            og: {
              description: PUBLIC_HOME_DESCRIPTION,
              title: PUBLIC_HOME_TITLE,
              type: 'website',
              url: 'https://rayd8.app/',
            },
            path: '/',
            priority: 100,
            routeType: 'landing',
            title: PUBLIC_HOME_TITLE,
          })
          return
        }

        applyPrivateRouteDefaults(nextPath)
      })

    return () => {
      cancelled = true
    }
  }, [location.pathname])

  return null
}
