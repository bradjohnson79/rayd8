import type { SubscriptionCancelledPayload } from '../notificationEvents.js'
import { getRayd8Url, renderInfoCard, renderKeyValueTable, renderParagraph, renderRayd8Email, text } from './base.js'

export function renderSubscriptionCancelledTemplate(payload: SubscriptionCancelledPayload) {
  const subject = `Your RAYD8 ${payload.plan.toUpperCase()} subscription was cancelled`
  const html = renderRayd8Email({
    eyebrow: 'Subscription Cancelled',
    title: 'Subscription ended',
    intro: 'Your subscription has been cancelled. Existing access stays available until the current billing period finishes, if applicable.',
    sections: [
      renderInfoCard(
        'Cancellation details',
        renderKeyValueTable([
          { label: 'Plan', value: payload.plan.toUpperCase() },
          { label: 'Subscription ID', value: payload.subscriptionId },
          { label: 'Cancelled at', value: text(payload.cancelledAt, 'Unavailable') },
        ]),
      ),
      renderParagraph('You can restart the subscription at any time from the billing page if you want full access again.'),
    ],
    callToAction: {
      label: 'Restart Subscription',
      url: getRayd8Url('/subscription'),
    },
  })

  return { html, subject }
}
