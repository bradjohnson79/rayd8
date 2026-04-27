import type { Experience } from '../services/player/accessPolicy.js'

export const EXPANSION_VIDEO_ASSET_IDS = [
  'xmofOgizsbzJ02lVZQGfgJ02MvkbCVh7PP9i4i6LTY4nk',
  '02BoM839qKRVjsRAzG3QmKk3mtMfT8irWVVuKGSMul6E',
  '4cjen3yVzhM9RAj3WCw9AjrvYLNwv00hEFn029CgCKZNw',
  'qUxzgx60002OuXq00wHNstAj3i900X00lBVyIivzdd100gkL4',
  'QLHA65ECE5cjwMa7o7sDg51ofiPEZ8rrXEUrKwl1F8U',
  'Mo01HBPQ6sGdYFdZE102914iNxG2aCzQho6oEQ1UbpclU',
  '901bYptxgxTxDn7IPlf0253602FtmyB877eUyc3vDTCfQs',
  'Z00QqfpH4qKEuL1lm00XxdBo9OeWtNPjdndRXuzErRJmE',
  'FQEcEsSRHmq01tqX9KnIaT1VVzOKvk02lGXIQzWV6yRMM',
  '029qSjS5mcpZh41IysgP01C8CtbutCYPKUDuVz8Vv600Ns',
] as const

export const PREMIUM_VIDEO_ASSET_IDS = [
  'r8WS8Mib4QM9uAOQleDMTTkiFMeJYXmpYYh84Z4RnBE',
  'sy402f4In5hCq9lgR2u02WovvLJHKspUqIQoaIctUBT01Q',
  '1FPP5E00uS51TwH5e016PcYgFTN0002hE02v00T5uLmy1fQSI',
  'x3VPHPv02QQLV1mBg6U2m4SQ00oY007019QBTk9xzQ4kUwM',
  '02sc46o8xl5DcsdmPyI6ukuFl2JSdKfBOnDRV6x71F7c',
  'D7M3C5gwDNuSb4s814nv3pNzVZxhCmixnOMAbEGiSbg',
  'zEFqsegOJvXHWHYo0102863nsomwxMO7JLXuyh9G4apNY',
  'uL01005XHjYDGNMx1ETgUtPJiADwDDI1Pslsg2snXPxq8',
  '00fNNbcVHgAm5ix9khdTeThzdQICFuAwaP6wDGZvUJlE',
  'OObm6quGEVLsuExl01REofbJWUYZFPXZMIAImGQuSr8o',
] as const

export const REGEN_VIDEO_ASSET_IDS = [
  '102CCM01JJ3dlAeCzDw00ibDBLPkcRtZLmN6oQ1eCTPd8E',
  'lcSFRWC9ggMxqBxBuV2bEdLGcf79zlEwR9kpdL002f00E',
  'jIWn7Xv4D01VrZVkPhu00kvhZ8Aodg5ZDzIQbaSEDpu6o',
  'fjpKmWbcGem00d00s3lkIWbiFRNfsXY578fYxKktbQjso',
  '4rDqy4vzLes8022NifAM7hRr3XvBSsDAG9Uu8SODbNLw',
  'g1CwuzPb01mVG2wuDRvF01wWjoEL3FeqHuP2mX005j9DXE',
  'Q02XQ1pFWgJhD7BKojThWQo2uUKeQDuTjv012EJ7OkFL4',
  'TkzOgf8ry1s01jP5dl9baQbzq7W01n1wJxXOP3IgYgDCw',
  'Tb8Ov6T02Lb2YUiSSxXFjJCswHz00kdcx29JK7eN02lQVc',
  '7t01HcXER8akci02JIj2qK2I00NZyV500Ip2sG7tfO4P7RI',
] as const

export const SHARED_AUDIO_ASSET_IDS = [
  '1uhVrH02IjQZ02cd9oS2rh76Jsup0102Bdhbbjkpla86HGU',
  '01AdpMIKawyRvpldKwLd2wVH7BS01ToIOQ00meJDLijJhw',
] as const

const expansionAssetIds = new Set<string>(EXPANSION_VIDEO_ASSET_IDS)
const premiumAssetIds = new Set<string>(PREMIUM_VIDEO_ASSET_IDS)
const regenAssetIds = new Set<string>(REGEN_VIDEO_ASSET_IDS)
const sharedAudioAssetIds = new Set<string>(SHARED_AUDIO_ASSET_IDS)

export function isExpansionAssetId(assetId: string) {
  return expansionAssetIds.has(assetId)
}

export function isPremiumAssetId(assetId: string) {
  return premiumAssetIds.has(assetId)
}

export function isSharedAudioAssetId(assetId: string) {
  return sharedAudioAssetIds.has(assetId)
}

export function isRegenAssetId(assetId: string) {
  return regenAssetIds.has(assetId)
}

export function isExperienceVideoAssetId(assetId: string, experience: Experience) {
  if (experience === 'premium') {
    return isPremiumAssetId(assetId)
  }

  if (experience === 'regen') {
    return isRegenAssetId(assetId)
  }

  return isExpansionAssetId(assetId)
}

export function isAssetAllowedForExperience(assetId: string, experience: Experience) {
  return isSharedAudioAssetId(assetId) || isExperienceVideoAssetId(assetId, experience)
}

export const FREE_TRIAL_VIDEO_ASSET_IDS = EXPANSION_VIDEO_ASSET_IDS
export const FREE_TRIAL_AUDIO_ASSET_IDS = SHARED_AUDIO_ASSET_IDS

export function isFreeTrialAssetId(assetId: string) {
  return isAssetAllowedForExperience(assetId, 'expansion')
}
