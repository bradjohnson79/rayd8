import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { SeoMetadataPayload } from '../services/admin'
import { getSeoMetadata } from '../services/seo'

const seoMetadataCache = new Map<string, SeoMetadataPayload>()
const publicSeoPaths = new Set(['/', '/subscription', '/success'])

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

        seoMetadataCache.set(nextPath, metadata)
        applySeoMetadata(metadata)
      })
      .catch(() => {
        if (!cancelled) {
          applyPrivateRouteDefaults(nextPath)
        }
      })

    return () => {
      cancelled = true
    }
  }, [location.pathname])

  return null
}
