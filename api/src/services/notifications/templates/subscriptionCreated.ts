import type { SubscriptionCreatedPayload } from '../notificationEvents.js'
import { formatEmailDate, getRayd8Url, renderInfoCard, renderKeyValueTable, renderParagraph, renderRayd8Email } from './base.js'

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
          { label: 'Billing period start', value: formatEmailDate(payload.currentPeriodStart) },
          { label: 'Billing period end', value: formatEmailDate(payload.currentPeriodEnd) },
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
