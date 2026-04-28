import type { StreamLimitReachedPayload } from '../notificationEvents.js'
import { getRayd8Url, renderInfoCard, renderKeyValueTable, renderParagraph, renderRayd8Email } from './base.js'

function formatSeconds(value: number) {
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)

  if (hours <= 0) {
    return `${minutes} minutes`
  }

  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`
}

export function renderStreamLimitReachedTemplate(payload: StreamLimitReachedPayload) {
  const subject = payload.plan === 'regen'
    ? 'Your RAYD8 monthly watch limit has been reached'
    : `Your RAYD8 ${payload.experience.toUpperCase()} preview limit has been reached`

  const html = renderRayd8Email({
    eyebrow: 'Watch Limit Reached',
    title: 'Playback is paused for now',
    intro:
      payload.plan === 'regen'
        ? 'You have reached the current monthly watch allowance for your REGEN subscription.'
        : 'You have used the available preview time for this experience on the free trial.',
    sections: [
      renderInfoCard(
        'Usage summary',
        renderKeyValueTable([
          { label: 'Plan', value: payload.plan.toUpperCase() },
          { label: 'Experience', value: payload.experience.toUpperCase() },
          { label: 'Used', value: formatSeconds(payload.usedSeconds) },
          { label: 'Remaining', value: formatSeconds(payload.remainingSeconds) },
          { label: 'Reason', value: payload.blockReason },
        ]),
      ),
      renderParagraph('Upgrade or wait for the next billing window if you want to keep streaming without interruption.'),
    ],
    callToAction: {
      label: payload.plan === 'regen' ? 'Review Usage' : 'Upgrade Access',
      url: getRayd8Url(payload.plan === 'regen' ? '/subscription' : '/settings'),
    },
  })

  return { html, subject }
}
