import type { ExpressPlatformKind } from './usePlatformDetection'

export type InstallFlowKind = 'androidDesktop' | 'apple' | 'fallback'
export type InstallFlowAudience = 'androidDesktop' | 'apple'

export function getInstallFlow({
  canPrompt,
  platformKind,
  requestedAudience,
}: {
  canPrompt: boolean
  platformKind: ExpressPlatformKind
  requestedAudience: InstallFlowAudience
}): InstallFlowKind {
  if (platformKind === 'ios' || platformKind === 'mac-safari' || requestedAudience === 'apple') {
    return 'apple'
  }

  if (platformKind === 'android' || platformKind === 'desktop' || requestedAudience === 'androidDesktop') {
    return canPrompt ? 'androidDesktop' : 'fallback'
  }

  return 'fallback'
}
