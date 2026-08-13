/**
 * Server-side usage qualification.
 *
 * INC-2026-08-06-VIDEO-LOOP: trial usage accrued while required video was
 * dead. The server must never trust raw elapsed time alone — it only accrues
 * when the client attests the required media was qualified, and always clamps
 * to the heartbeat cap.
 */
export function computeQualifiedHeartbeatAccrual(input: {
  elapsedSeconds: number
  maxHeartbeatSeconds: number
  mediaQualified: boolean | undefined
}): { accrualSeconds: number; qualified: boolean } {
  const clampedElapsed = Math.min(
    input.maxHeartbeatSeconds,
    Math.max(0, Math.floor(input.elapsedSeconds)),
  )

  // Fail closed: a missing attestation is treated as unqualified.
  const qualified = input.mediaQualified === true

  return {
    accrualSeconds: qualified ? clampedElapsed : 0,
    qualified,
  }
}
