import { apiBaseUrl } from './api'
import type { SeoMetadataPayload } from './admin'

export async function getSeoMetadata(path: string) {
  const response = await fetch(`${apiBaseUrl}/api/seo/metadata?path=${encodeURIComponent(path)}`)
  const payload = (await response.json().catch(() => ({}))) as Partial<SeoMetadataPayload> & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to load SEO metadata.')
  }

  return payload as SeoMetadataPayload
}
