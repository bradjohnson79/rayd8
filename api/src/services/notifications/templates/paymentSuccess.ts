import type { PaymentSucceededPayload } from '../notificationEvents.js'
import { getRayd8Url, money, renderInfoCard, renderKeyValueTable, renderParagraph, renderRayd8Email, text } from './base.js'

export function renderPaymentSuccessTemplate(payload: PaymentSucceededPayload) {
  const subject = `Payment confirmed for your RAYD8 ${payload.plan.toUpperCase()} access`
  const html = renderRayd8Email({
    eyebrow: 'Payment Succeeded',
    title: 'Your payment was received',
    intro: 'Your RAYD8 payment completed successfully and your access is ready to use.',
    sections: [
      renderInfoCard(
        'Payment details',
        renderKeyValueTable([
          { label: 'Plan', value: payload.plan.toUpperCase() },
          { label: 'Amount', value: money(payload.amount, payload.currency) },
          { label: 'Payment ID', value: payload.paymentId },
          { label: 'Email', value: text(payload.userEmail, 'Unavailable') },
        ]),
      ),
      renderParagraph('You can return to your dashboard any time to continue streaming and manage your subscription.'),
    ],
    callToAction: {
      label: 'Open Dashboard',
      url: getRayd8Url('/dashboard'),
    },
  })

  return { html, subject }
}
