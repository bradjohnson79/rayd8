import type { Experience } from '../app/types'
import { apiBaseUrl, apiRequest } from './api'

export type UsageBlockReason =
  | 'free_expansion_limit_reached'
  | 'free_premium_limit_reached'
  | 'free_regen_limit_reached'
  | 'plan_upgrade_required'
  | 'premium_allowance_reached'
  | 'regen_legacy_allowance_reached'
  | 'regen_total_limit_reached'

export interface UsagePeriodSummary {
  expansionUsedSeconds: number
  periodEnd: string | Date | null
  periodStart: string | Date | null
  periodType: 'billing_cycle' | 'lifetime' | null
  premiumUsedSeconds: number
  regenUsedSeconds: number
  totalUsedSeconds: number
}

export interface MuxPlaybackPayload {
  asset_id: string
  /** ISO-8601 wall time when the signed playback JWT expires (server-derived). */
  expires_at?: string
  /** Epoch ms when the signed JWT expires; preferred for scheduling refresh. */
  expires_at_ms?: number
  expires_in_minutes: number
  playback_id: string
  signed_url: string
  token: string
}

export interface PlaybackTokenResponse {
  playback: MuxPlaybackPayload
}

export function computeMuxPlaybackExpiryMs(playback: MuxPlaybackPayload): number {
  if (typeof playback.expires_at_ms === 'number' && Number.isFinite(playback.expires_at_ms)) {
    return playback.expires_at_ms
  }

  if (playback.expires_at) {
    const parsed = Date.parse(playback.expires_at)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  const minutes = playback.expires_in_minutes > 0 ? playback.expires_in_minutes : 10

  return Date.now() + minutes * 60 * 1000
}

export interface ExperienceAccessSummary {
  allowed: boolean
  blockReason: UsageBlockReason | null
  experience: Experience
  isBlocked: boolean
  limitMinutes: number | null
  limitSeconds: number | null
  minutesRemaining: number | null
  minutesUsed: number
  remainingSeconds: number | null
  state: 'active' | 'blocked' | 'soft_denied'
  usage: UsagePeriodSummary | null
  usagePercent: number | null
  usedSeconds: number
  warningState: 'none' | 'approaching_limit'
}

export interface PlaybackSessionResponse {
  access: ExperienceAccessSummary
  session: {
    experience: Experience
    id: string
    minutesWatched: number
    secondsWatched: number
  }
}

export function getMemberPlaybackToken(assetId: string, experience: Experience, token: string) {
  return apiRequest<PlaybackTokenResponse>(
    `/v1/player/playback-token?assetId=${encodeURIComponent(assetId)}&experience=${encodeURIComponent(experience)}`,
    undefined,
    token,
  )
}

export function getPlaybackAccess(experience: Experience, token: string) {
  return apiRequest<{ access: ExperienceAccessSummary }>(
    `/v1/player/access?experience=${encodeURIComponent(experience)}`,
    undefined,
    token,
  )
}

export function startPlaybackSession(experience: Experience, token: string) {
  return apiRequest<PlaybackSessionResponse>(
    '/v1/player/session/start',
    {
      body: JSON.stringify({ experience }),
      method: 'POST',
    },
    token,
  )
}

export function heartbeatPlaybackSession(sessionId: string, token: string) {
  return apiRequest<PlaybackSessionResponse>(
    '/v1/player/session/heartbeat',
    {
      body: JSON.stringify({ sessionId }),
      method: 'POST',
    },
    token,
  )
}

export function endPlaybackSession(sessionId: string, token: string) {
  return apiRequest<PlaybackSessionResponse>(
    '/v1/player/session/end',
    {
      body: JSON.stringify({ sessionId }),
      method: 'POST',
    },
    token,
  )
}

/**
 * Layered session-end delivery for page lifecycle.
 * 1) keepalive fetch with Authorization (preferred on unload)
 * 2) sendBeacon JSON fallback without auth is intentionally NOT used alone —
 *    auth is required by the API; beacon is only attempted with a Blob that
 *    cannot set Authorization, so we skip beacon unless keepalive fails and
 *    rely on server-side stale reconciliation.
 */
export async function endPlaybackSessionReliable(
  sessionId: string,
  token: string,
  options?: { transport?: 'standard' | 'unload' },
): Promise<{ ok: boolean; transport: 'standard' | 'keepalive' | 'failed' }> {
  const transport = options?.transport ?? 'standard'

  if (transport === 'standard') {
    try {
      await endPlaybackSession(sessionId, token)
      return { ok: true, transport: 'standard' }
    } catch {
      return { ok: false, transport: 'failed' }
    }
  }

  try {
    const response = await fetch(`${apiBaseUrl}/v1/player/session/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    })
    if (response.ok) {
      return { ok: true, transport: 'keepalive' }
    }
  } catch {
    // Fall through — stale-session reconciliation covers abandoned sessions.
  }

  return { ok: false, transport: 'failed' }
}
