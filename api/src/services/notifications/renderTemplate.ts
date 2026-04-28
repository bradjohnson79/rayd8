import type {
  AdminPaymentReceivedPayload,
  AdminTestPayload,
  NotificationEvent,
  NotificationPayloadMap,
  StreamStartedPayload,
} from './notificationEvents.js'
import { getRayd8Url, money, renderInfoCard, renderKeyValueTable, renderParagraph, renderRayd8Email, text } from './templates/base.js'
import { renderAdminNewUserTemplate, renderUserCreatedTemplate } from './templates/adminNewUser.js'
import { renderPaymentFailedTemplate } from './templates/paymentFailed.js'
import { renderPaymentSuccessTemplate } from './templates/paymentSuccess.js'
import { renderStreamLimitReachedTemplate } from './templates/streamLimitReached.js'
import { renderSubscriptionCancelledTemplate } from './templates/subscriptionCancelled.js'
import { renderSubscriptionCreatedTemplate } from './templates/subscriptionCreated.js'

export interface RenderedNotificationTemplate {
  html: string
  subject: string
}

function renderAdminPaymentReceivedTemplate(payload: AdminPaymentReceivedPayload): RenderedNotificationTemplate {
  return {
    subject: `Admin alert: RAYD8 payment received from ${text(payload.userEmail, 'member')}`,
    html: renderRayd8Email({
      eyebrow: 'Admin Alert',
      title: 'Payment received',
      intro: 'A payment was recorded successfully through Stripe for the RAYD8 platform.',
      sections: [
        renderInfoCard(
          'Payment details',
          renderKeyValueTable([
            { label: 'Payment ID', value: payload.paymentId },
            { label: 'Plan', value: payload.plan.toUpperCase() },
            { label: 'Amount', value: money(payload.amount, payload.currency) },
            { label: 'User email', value: text(payload.userEmail, 'Unavailable') },
          ]),
        ),
      ],
      callToAction: {
        label: 'Review Orders',
        url: getRayd8Url('/admin/orders'),
      },
    }),
  }
}

function renderAdminTestTemplate(payload: AdminTestPayload): RenderedNotificationTemplate {
  return {
    subject: 'RAYD8 notifications test email',
    html: renderRayd8Email({
      eyebrow: 'Notifications Test',
      title: 'Notification pipeline verified',
      intro: 'This sample email confirms the RAYD8 notification service can render and send successfully.',
      sections: [
        renderParagraph(text(payload.message, 'This sample email was triggered from the RAYD8 admin notifications panel.')),
        renderInfoCard(
          'Test metadata',
          renderKeyValueTable([
            { label: 'Entity ID', value: payload.entityId },
            { label: 'Initiated by', value: text(payload.initiatedByUserId, 'Admin user') },
          ]),
        ),
      ],
      callToAction: {
        label: 'Open Notifications',
        url: getRayd8Url('/admin/notifications'),
      },
    }),
  }
}

function renderStreamStartedTemplate(payload: StreamStartedPayload): RenderedNotificationTemplate {
  return {
    subject: `RAYD8 ${payload.experience.toUpperCase()} session started`,
    html: renderRayd8Email({
      eyebrow: 'Session Started',
      title: 'Your session is live',
      intro: 'Your playback session has started successfully.',
      sections: [
        renderInfoCard(
          'Session details',
          renderKeyValueTable([
            { label: 'Experience', value: payload.experience.toUpperCase() },
            { label: 'Entity ID', value: payload.entityId },
            { label: 'Email', value: text(payload.userEmail, 'Unavailable') },
          ]),
        ),
      ],
      callToAction: {
        label: 'Open Dashboard',
        url: getRayd8Url('/dashboard'),
      },
    }),
  }
}

export function renderNotificationTemplate<TEvent extends NotificationEvent>(
  event: TEvent,
  payload: NotificationPayloadMap[TEvent],
): RenderedNotificationTemplate {
  switch (event) {
    case 'payment.succeeded':
      return renderPaymentSuccessTemplate(payload as NotificationPayloadMap['payment.succeeded'])
    case 'payment.failed':
      return renderPaymentFailedTemplate(payload as NotificationPayloadMap['payment.failed'])
    case 'subscription.created':
      return renderSubscriptionCreatedTemplate(payload as NotificationPayloadMap['subscription.created'])
    case 'subscription.cancelled':
      return renderSubscriptionCancelledTemplate(payload as NotificationPayloadMap['subscription.cancelled'])
    case 'stream.limit.reached':
      return renderStreamLimitReachedTemplate(payload as NotificationPayloadMap['stream.limit.reached'])
    case 'admin.new.user':
      return renderAdminNewUserTemplate(payload as NotificationPayloadMap['admin.new.user'])
    case 'user.created':
      return renderUserCreatedTemplate(payload as NotificationPayloadMap['user.created'])
    case 'admin.payment.received':
      return renderAdminPaymentReceivedTemplate(payload as NotificationPayloadMap['admin.payment.received'])
    case 'stream.started':
      return renderStreamStartedTemplate(payload as NotificationPayloadMap['stream.started'])
    case 'admin.test':
      return renderAdminTestTemplate(payload as NotificationPayloadMap['admin.test'])
    default: {
      const exhaustiveCheck: never = event
      throw new Error(`No notification template registered for ${exhaustiveCheck}`)
    }
  }
}
