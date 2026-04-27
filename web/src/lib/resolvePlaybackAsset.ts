import type { PlanTier, Experience } from '../app/types'
import type { SessionVideoMode } from '../config/rayd8Expansion'
import { RAYD8_ASSETS, type PlaybackQuality } from './rayd8Assets'

export type PlaybackPlan = 'free' | 'regen'
export type PlaybackPlanInput = PlanTier | 'free-trial' | null | undefined

export function normalizePlaybackPlan(plan: PlaybackPlanInput): PlaybackPlan {
  if (plan === 'regen') {
    return 'regen'
  }

  if (plan === 'premium' || plan === 'amrita') {
    console.warn(`[RAYD8] Unsupported playback plan "${plan}" normalized to "free".`)
  }

  return 'free'
}

export function resolvePlaybackQuality(plan: PlaybackPlanInput): PlaybackQuality {
  return normalizePlaybackPlan(plan) === 'regen' ? '1080p' : '720p'
}

interface ResolvePlaybackAssetInput {
  experience: Experience
  plan: PlaybackPlanInput
  speed: SessionVideoMode
}

export function resolvePlaybackAsset({
  experience,
  plan,
  speed,
}: ResolvePlaybackAssetInput) {
  const resolvedPlan = normalizePlaybackPlan(plan)
  const resolvedQuality = resolvePlaybackQuality(resolvedPlan)
  const assetId = RAYD8_ASSETS[experience]?.[resolvedQuality]?.[speed]

  if (!assetId) {
    const error = new Error(
      `[RAYD8] Missing playback asset for experience="${experience}" plan="${resolvedPlan}" quality="${resolvedQuality}" speed="${speed}".`,
    )

    console.error(error)
    throw error
  }

  return assetId
}
