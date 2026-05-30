import type { ExpressPlatformKind } from './usePlatformDetection'

export interface ExpressInstallCopy {
  body: string
  cta: string
  eyebrow: string
  sheet: ExpressDownloadSheetCopy
  title: string
}

export interface ExpressDownloadSheetCopy {
  actionHint?: string
  body: string
  title: string
}

export const DOWNLOAD_EXPRESS_CTA = 'Download Express'
const PRIMARY_CTA = 'Download RAYD8 Express'
const PREMIUM_BODY =
  'Launch RAYD8 instantly from your phone, tablet, or desktop — staying signed in for fast, immersive access anytime.'

type PromptInstall = () => Promise<'accepted' | 'dismissed' | 'unavailable'>

export function shouldUseNativeInstallPrompt(
  platformKind: ExpressPlatformKind,
  canPrompt: boolean,
) {
  return canPrompt && platformKind !== 'ios' && platformKind !== 'mac-safari'
}

export async function requestExpressDownload({
  canUseNativePrompt,
  promptInstall,
}: {
  canUseNativePrompt: boolean
  promptInstall: PromptInstall
}) {
  if (!canUseNativePrompt) {
    return 'fallback' as const
  }

  const result = await promptInstall()

  return result === 'unavailable' ? ('fallback' as const) : result
}

export type ExpressAppleInstallGuide =
  | { kind: 'ios' }
  | { kind: 'mac' }
  | { kind: 'both' }

export function getAppleInstallGuide(
  platformKind: ExpressPlatformKind,
): ExpressAppleInstallGuide {
  if (platformKind === 'ios') {
    return { kind: 'ios' }
  }

  if (platformKind === 'mac-safari') {
    return { kind: 'mac' }
  }

  return { kind: 'both' }
}

export function getExpressInstallCopy(
  platformKind: ExpressPlatformKind,
): ExpressInstallCopy {
  if (platformKind === 'ios') {
    return {
      body: PREMIUM_BODY,
      cta: PRIMARY_CTA,
      eyebrow: 'iPhone and iPad',
      sheet: {
        actionHint: 'Tap Share → Add to Home Screen',
        body: 'Save RAYD8 Express to your Home Screen in seconds.',
        title: PRIMARY_CTA,
      },
      title: PRIMARY_CTA,
    }
  }

  if (platformKind === 'mac-safari') {
    return {
      body: PREMIUM_BODY,
      cta: PRIMARY_CTA,
      eyebrow: 'Mac Safari',
      sheet: {
        actionHint: 'Add to Dock',
        body: 'Choose Add to Dock from Safari.',
        title: PRIMARY_CTA,
      },
      title: PRIMARY_CTA,
    }
  }

  if (platformKind === 'android') {
    return {
      body: PREMIUM_BODY,
      cta: PRIMARY_CTA,
      eyebrow: 'Android',
      sheet: {
        actionHint: 'Save RAYD8 Express to your device',
        body: 'Your device needs one quick manual save step.',
        title: PRIMARY_CTA,
      },
      title: PRIMARY_CTA,
    }
  }

  return {
    body: PREMIUM_BODY,
    cta: PRIMARY_CTA,
    eyebrow: 'Desktop',
    sheet: {
      actionHint: 'Save RAYD8 Express to this device',
      body: 'Your device needs one quick manual save step.',
      title: PRIMARY_CTA,
    },
    title: PRIMARY_CTA,
  }
}
