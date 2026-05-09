import type { Experience } from '../app/types'
import type { SessionVideoMode, SharedAudioTrack } from '../config/rayd8Expansion'
import {
  type PlaybackPlanInput,
  resolvePlaybackAsset,
  resolvePlaybackQuality,
} from './resolvePlaybackAsset'

type CombinedPlaybackAssetMap = Partial<
  Record<
    Experience,
    Partial<
      Record<
        ReturnType<typeof resolvePlaybackQuality>,
        Partial<Record<SessionVideoMode, Partial<Record<Exclude<SharedAudioTrack, 'none'>, string>>>>
      >
    >
  >
>

/**
 * Single-stream muxed assets (one HLS URL, one `<video>` pipeline).
 *
 * Rollout checklist (remaining blockers):
 * - For each `(experience, quality tier, sessionVideoMode, audioTrack)` tuple used in sessions,
 *   create a Mux asset with bundled stereo bed + publish `playback_id`.
 * - Keys must match `resolvePlaybackQuality(plan)` and `SessionVideoMode` / non-`none` audio tracks.
 * - Validate A/V sync drift vs hidden audio rail on Firefox + Safari before flipping env-wide.
 * - Keep `VITE_RAYD8_SINGLE_AV_PIPELINE=false` in production until parity soak passes.
 *
 * Naming: prefer deterministic IDs from your CMS/Mux dashboard; this map is the sole client routing layer.
 */
const COMBINED_AV_ASSETS: CombinedPlaybackAssetMap = {}

export function isCombinedAvPlaybackEnabled() {
  return import.meta.env.VITE_RAYD8_SINGLE_AV_PIPELINE === 'true'
}

export function resolveCombinedPlaybackAsset(input: {
  audioTrack: SharedAudioTrack
  experience: Experience
  plan: PlaybackPlanInput
  speed: SessionVideoMode
}) {
  if (input.audioTrack === 'none') {
    return resolvePlaybackAsset(input)
  }

  const quality = resolvePlaybackQuality(input.plan)
  const combinedAssetId =
    COMBINED_AV_ASSETS[input.experience]?.[quality]?.[input.speed]?.[input.audioTrack]

  return combinedAssetId ?? null
}
