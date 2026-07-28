/**
 * Privacy-safe Mux playback incident telemetry (Umami).
 * Abnormal events only — never JWTs, signed URLs, or user content.
 */

import { trackUmamiEvent } from '../../services/umami'

export type PlaybackIncidentPayload = {
  correlationId?: string | null
  freezeClass?: string | null
  pipelineMode?: string | null
  playbackEngine?: string | null
  routeCategory?: string | null
  sessionCategory?: string | null
  recoveryAction?: string | null
  recoveryAttemptCount?: number | null
  loadSourceCount?: number | null
  tokenRefreshCount?: number | null
  driftSeconds?: number | null
  maxAbsDriftSeconds?: number | null
  visibilityState?: string | null
  fullscreen?: boolean | null
  releaseSha?: string | null
  reason?: string | null
}

const SECRET_KEY = /(?:token|jwt|authorization|password|signed_url|bearer|cookie|email|intention|sankalpa)/i
const TOKEN_IN_STRING = /token=[^&\s]+/gi

const recentKeys = new Map<string, number>()
const DEDUPE_TTL_MS = 60_000

export function sanitizePlaybackIncidentPayload(
  input: PlaybackIncidentPayload,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}

  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue
    if (SECRET_KEY.test(key)) continue

    if (typeof value === 'boolean' || typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = value
      continue
    }

    if (typeof value === 'string') {
      const scrubbed = value.replace(TOKEN_IN_STRING, 'token=[redacted]').slice(0, 120)
      // Drop residual JWT-looking blobs; keep redacted Mux URLs for support context.
      if (/eyJ[A-Za-z0-9_-]{10,}\./.test(scrubbed)) continue
      out[key] = scrubbed
    }
  }

  return out
}

export function shouldEmitPlaybackIncident(dedupeKey: string, now = Date.now()) {
  const last = recentKeys.get(dedupeKey)
  if (last !== undefined && now - last < DEDUPE_TTL_MS) {
    return false
  }
  recentKeys.set(dedupeKey, now)
  // Bound map size
  if (recentKeys.size > 200) {
    for (const [key, ts] of recentKeys) {
      if (now - ts > DEDUPE_TTL_MS) recentKeys.delete(key)
    }
  }
  return true
}

/** Classes / reasons worth a sparse production incident. */
export function isAbnormalPlaybackIncident(freezeClass: string | null | undefined) {
  if (!freezeClass) return false
  return (
    freezeClass === 'browser_tab_freeze' ||
    freezeClass === 'player_ui_freeze' ||
    freezeClass === 'media_stall' ||
    freezeClass === 'graphics_freeze' ||
    freezeClass === 'device_instability'
  )
}

export function emitPlaybackIncident(payload: PlaybackIncidentPayload) {
  try {
    const freezeClass = payload.freezeClass ?? 'unknown'
    if (!isAbnormalPlaybackIncident(freezeClass) && freezeClass !== 'fatal_recovery') {
      // Allow explicit fatal_recovery; skip routine av_desync samples.
      if (freezeClass !== 'fatal_recovery') return
    }

    const dedupeKey = [
      payload.correlationId ?? 'none',
      freezeClass,
      payload.recoveryAction ?? '',
      payload.reason ?? '',
    ].join('|')

    if (!shouldEmitPlaybackIncident(dedupeKey)) return

    const releaseSha =
      payload.releaseSha ??
      (typeof import.meta !== 'undefined'
        ? (import.meta.env?.VITE_RELEASE_SHA as string | undefined) ?? null
        : null)

    const data = sanitizePlaybackIncidentPayload({
      ...payload,
      releaseSha,
      visibilityState:
        payload.visibilityState ??
        (typeof document !== 'undefined' ? document.visibilityState : null),
      fullscreen:
        payload.fullscreen ??
        (typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : null),
    })

    trackUmamiEvent('mux_playback_incident', data)
  } catch {
    // Never interrupt playback for telemetry failures.
  }
}

/** Test helper */
export function _resetPlaybackIncidentDedupeForTests() {
  recentKeys.clear()
}
