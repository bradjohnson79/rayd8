import type { PaymentFailedPayload } from '../notificationEvents.js'
import { getRayd8Url, money, renderInfoCard, renderKeyValueTable, renderParagraph, renderRayd8Email } from './base.js'

export function renderPaymentFailedTemplate(payload: PaymentFailedPayload) {
  const subject = `Payment issue for your RAYD8 ${payload.plan.toUpperCase()} access`
  const html = renderRayd8Email({
    eyebrow: 'Payment Failed',
    title: 'We could not complete your payment',
    intro: 'Your last payment attempt did not go through. Update your billing details to keep access uninterrupted.',
    sections: [
      renderInfoCard(
        'Attempt details',
        renderKeyValueTable([
          { label: 'Plan', value: payload.plan.toUpperCase() },
          { label: 'Amount', value: money(payload.amount, payload.currency) },
          { label: 'Payment ID', value: payload.paymentId },
          { label: 'Reason', value: payload.reason },
        ]),
      ),
      renderParagraph('Stripe may ask for a new card, an updated billing address, or additional bank authorization before the retry can succeed.'),
    ],
    callToAction: {
      label: 'Manage Subscription',
      url: getRayd8Url('/settings'),
    },
  })

  return { html, subject }
}
