import type { ExpressPlatformKind } from './usePlatformDetection'

export interface ExpressInstallCopy {
  cta: string
  cue: string
  eyebrow: string
  fallbackMessage: string
  installMode: string
  platformTitle: string
  steps: string[]
  title: string
}

const PRIMARY_CTA = 'Download RAYD8 Express'

export function shouldUseNativeInstallPrompt(
  platformKind: ExpressPlatformKind,
  canPrompt: boolean,
) {
  return canPrompt && platformKind !== 'ios' && platformKind !== 'mac-safari'
}

export function getExpressInstallCopy(
  platformKind: ExpressPlatformKind,
  canPrompt: boolean,
): ExpressInstallCopy {
  if (platformKind === 'ios') {
    return {
      cta: PRIMARY_CTA,
      cue: 'Manual Safari install',
      eyebrow: 'iPhone and iPad',
      fallbackMessage:
        'Apple devices do not show an automatic install prompt. Tap Share in Safari, then Add to Home Screen.',
      installMode: 'Safari Share sheet',
      platformTitle: 'Download RAYD8 Express on iPhone or iPad',
      steps: [
        'Open RAYD8 in Safari.',
        'Tap Share in Safari.',
        'Tap Add to Home Screen.',
        'Launch RAYD8 Express from your Home Screen.',
      ],
      title: PRIMARY_CTA,
    }
  }

  if (platformKind === 'android') {
    return {
      cta: PRIMARY_CTA,
      cue: canPrompt ? 'Browser install prompt available' : 'Browser menu install option',
      eyebrow: 'Android',
      fallbackMessage:
        'No automatic download prompt is available in this browser. Open the browser menu or address-bar install option, then choose Install App or Add to Home Screen.',
      installMode: canPrompt ? 'Native browser prompt' : 'Manual browser menu',
      platformTitle: 'Download RAYD8 Express on Android',
      steps: [
        'Use the browser prompt when it appears, or open the browser menu.',
        'Choose Install App or Add to Home Screen.',
        'Launch RAYD8 Express from your launcher.',
      ],
      title: PRIMARY_CTA,
    }
  }

  if (platformKind === 'mac-safari') {
    return {
      cta: PRIMARY_CTA,
      cue: 'Manual Safari install',
      eyebrow: 'Mac Safari',
      fallbackMessage:
        'Mac Safari does not show an automatic install prompt. Use the Safari Share menu or File menu, then choose Add to Dock.',
      installMode: 'Safari Share or File menu',
      platformTitle: 'Download RAYD8 Express on Mac Safari',
      steps: [
        'Open RAYD8 in Safari.',
        'Use the Safari Share menu or File menu.',
        'Choose Add to Dock.',
        'Launch RAYD8 Express from your Dock.',
      ],
      title: PRIMARY_CTA,
    }
  }

  return {
    cta: PRIMARY_CTA,
    cue: canPrompt ? 'Browser install prompt available' : 'Browser menu or address-bar install option',
    eyebrow: 'Desktop',
    fallbackMessage:
      'No automatic download prompt is available in this browser. Open the browser menu or address-bar install option, then choose Install App or Add to Home Screen.',
    installMode: canPrompt ? 'Native browser prompt' : 'Manual browser install control',
    platformTitle: 'Download RAYD8 Express on desktop',
    steps: [
      'Use the browser prompt when it appears, or open the browser menu.',
      'Click the install icon in the address bar or choose Install App from the menu.',
      'Launch RAYD8 Express in its standalone app window.',
    ],
    title: PRIMARY_CTA,
  }
}
