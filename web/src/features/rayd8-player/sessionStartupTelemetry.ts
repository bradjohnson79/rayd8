/**
 * Privacy-safe session-startup incident telemetry (Umami).
 * Never emits JWTs, signed URLs, emails, or customer identifiers.
 */

import { trackUmamiEvent } from '../../services/umami'
import type { PlayerStartupFailure, StartupFailureCode, StartupStage } from './sessionStartupTaxonomy'

export type SessionStartupIncidentKind = 'overlay_shown' | 'recovery_action' | 'recovery_result'

export type SessionStartupSnapshot = {
  correlationId: string
  releaseSha?: string | null
  kind: SessionStartupIncidentKind
  stage?: StartupStage | null
  code?: StartupFailureCode | null
  recoverability?: string | null
  sessionType?: string | null
  route?: string | null
  productMode?: string | null
  browserFamily?: string | null
  platformClass?: string | null
  documentVisibility?: string | null
  online?: boolean | null
  authReady?: boolean | null
  accessAllowed?: boolean | null
  entitlementAllowed?: boolean | null
  sessionStartStatus?: string | null
  sessionIdPresent?: boolean | null
  playbackTokenStatus?: string | null
  mediaControllerMode?: string | null
  playbackEngine?: string | null
  videoElementPresent?: boolean | null
  audioElementPresent?: boolean | null
  sourceApplied?: boolean | null
  currentSrcPresent?: boolean | null
  videoWidth?: number | null
  readyState?: number | null
  networkState?: number | null
  currentTimeBucket?: string | null
  paused?: boolean | null
  ended?: boolean | null
  autoplayPending?: boolean | null
  audioOnlyMode?: boolean | null
  dualStreamMode?: boolean | null
  healthGuardState?: string | null
  recoveryAttemptNumber?: number | null
  previousRecoveryAction?: string | null
  referenceCode?: string | null
  recoveryAction?: string | null
  recoverySucceeded?: boolean | null
}

const SECRET_KEY =
  /(?:token|jwt|authorization|password|signed_url|bearer|cookie|email|intention|sankalpa|user_id|session_id|playback_id)/i
const TOKEN_IN_STRING = /token=[^&\s]+/gi

const recentKeys = new Map<string, number>()
const DEDUPE_TTL_MS = 60_000

export function bucketCurrentTime(currentTime: number | null | undefined) {
  if (typeof currentTime !== 'number' || !Number.isFinite(currentTime)) return 'unknown'
  if (currentTime <= 0) return '0'
  if (currentTime < 0.5) return 'lt_0.5'
  if (currentTime < 2) return '0.5_2'
  return 'gte_2'
}

export function sanitizeSessionStartupSnapshot(
  input: SessionStartupSnapshot,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}

  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue
    if (SECRET_KEY.test(key)) continue

    if (typeof value === 'boolean' || typeof value === 'number') {
      if (typeof value === 'number' && !Number.isFinite(value)) continue
      out[key] = value
      continue
    }

    if (typeof value === 'string') {
      const scrubbed = value.replace(TOKEN_IN_STRING, 'token=[redacted]').slice(0, 120)
      if (/eyJ[A-Za-z0-9_-]{10,}\./.test(scrubbed)) continue
      if (/https?:\/\/\S+/i.test(scrubbed) && /stream|mux|playback/i.test(scrubbed)) {
        out[key] = '[redacted-url]'
        continue
      }
      out[key] = scrubbed
    }
  }

  return out
}

export function shouldEmitSessionStartupIncident(dedupeKey: string, now = Date.now()) {
  const last = recentKeys.get(dedupeKey)
  if (last !== undefined && now - last < DEDUPE_TTL_MS) {
    return false
  }
  recentKeys.set(dedupeKey, now)
  if (recentKeys.size > 200) {
    for (const [key, ts] of recentKeys) {
      if (now - ts > DEDUPE_TTL_MS) recentKeys.delete(key)
    }
  }
  return true
}

export function emitSessionStartupIncident(payload: SessionStartupSnapshot) {
  try {
    const dedupeKey = [
      payload.kind,
      payload.correlationId,
      payload.code ?? '',
      payload.recoveryAction ?? '',
      payload.recoverySucceeded ?? '',
    ].join('|')

    if (payload.kind === 'overlay_shown' && !shouldEmitSessionStartupIncident(dedupeKey)) {
      return
    }

    if (payload.kind !== 'overlay_shown' && !shouldEmitSessionStartupIncident(dedupeKey)) {
      return
    }

    const releaseSha =
      payload.releaseSha ??
      (typeof import.meta !== 'undefined'
        ? ((import.meta.env?.VITE_RELEASE_SHA as string | undefined) ?? null)
        : null)

    const data = sanitizeSessionStartupSnapshot({
      ...payload,
      releaseSha,
      documentVisibility:
        payload.documentVisibility ??
        (typeof document !== 'undefined' ? document.visibilityState : null),
      online: payload.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : null),
    })

    trackUmamiEvent('session_startup_incident', data)
  } catch {
    // Never interrupt startup for telemetry failures.
  }
}

export function failureToSnapshotFields(failure: PlayerStartupFailure | null) {
  if (!failure) {
    return {}
  }
  return {
    stage: failure.stage,
    code: failure.code,
    recoverability: failure.recoverability,
  }
}

export function _resetSessionStartupIncidentDedupeForTests() {
  recentKeys.clear()
}
