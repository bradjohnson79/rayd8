import type { SubscriptionCreatedPayload } from '../notificationEvents.js'
import { getRayd8Url, renderInfoCard, renderKeyValueTable, renderParagraph, renderRayd8Email, text } from './base.js'

export function renderSubscriptionCreatedTemplate(payload: SubscriptionCreatedPayload) {
  const subject = `Your RAYD8 ${payload.plan.toUpperCase()} subscription is active`
  const html = renderRayd8Email({
    eyebrow: 'Subscription Created',
    title: 'Subscription confirmed',
    intro: 'Your subscription is active and ready for use across the RAYD8 dashboard.',
    sections: [
      renderInfoCard(
        'Subscription details',
        renderKeyValueTable([
          { label: 'Plan', value: payload.plan.toUpperCase() },
          { label: 'Subscription ID', value: payload.subscriptionId },
          { label: 'Billing period start', value: text(payload.currentPeriodStart, 'Unavailable') },
          { label: 'Billing period end', value: text(payload.currentPeriodEnd, 'Unavailable') },
        ]),
      ),
      renderParagraph('Your monthly watch allowance and subscription controls are available from the account area.'),
    ],
    callToAction: {
      label: 'View Subscription',
      url: getRayd8Url('/subscription'),
    },
  })

  return { html, subject }
}
