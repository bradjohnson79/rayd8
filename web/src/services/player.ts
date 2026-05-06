import type { Experience } from '../app/types'
import { apiRequest } from './api'

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
