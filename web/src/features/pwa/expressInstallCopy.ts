import type { ExpressPlatformKind } from './usePlatformDetection'

export interface ExpressInstallCopy {
  cta: string
  cue: string
  eyebrow: string
  platformTitle: string
  steps: string[]
  title: string
}

export function getExpressInstallCopy(
  platformKind: ExpressPlatformKind,
  canPrompt: boolean,
): ExpressInstallCopy {
  if (platformKind === 'ios') {
    return {
      cta: 'Add to Home Screen',
      cue: 'Safari share sheet',
      eyebrow: 'iPhone and iPad',
      platformTitle: 'Add to Home Screen',
      steps: ['Tap Share in Safari.', 'Tap Add to Home Screen.', 'Launch RAYD8 from your Home Screen.'],
      title: 'Install RAYD8 Express',
    }
  }

  if (platformKind === 'android') {
    return {
      cta: 'Install App',
      cue: canPrompt ? 'Native install prompt' : 'Chrome menu',
      eyebrow: 'Android',
      platformTitle: 'Install App',
      steps: [
        'Open this dashboard in Firefox first, or Chrome if needed.',
        'Tap Install App or Add to Home Screen.',
        'Launch RAYD8 from your launcher.',
      ],
      title: 'Install RAYD8 Express',
    }
  }

  if (platformKind === 'mac-safari') {
    return {
      cta: 'Add to Dock',
      cue: 'Safari File menu',
      eyebrow: 'Mac Safari',
      platformTitle: 'Add RAYD8 to Dock',
      steps: ['Open the Share menu in Safari.', 'Choose Add to Dock when available.', 'Launch RAYD8 from your Dock.'],
      title: 'Add RAYD8 to Dock',
    }
  }

  return {
    cta: 'Install RAYD8 Express',
    cue: canPrompt ? 'Browser install prompt' : 'Address bar install icon',
    eyebrow: 'Desktop',
    platformTitle: 'Install RAYD8 Express',
    steps: [
      'Use Firefox first, or Chrome, Edge, or Brave if your Firefox version does not show an install option.',
      'Click the install icon in the address bar or browser menu.',
      'Launch RAYD8 in its standalone app window.',
    ],
    title: 'Install RAYD8 Express',
  }
}
