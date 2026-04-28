export type NotificationEvent =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'user.created'
  | 'stream.started'
  | 'stream.limit.reached'
  | 'admin.new.user'
  | 'admin.payment.received'
  | 'admin.test'

export type NotificationRecipientType = 'user' | 'admin'

export interface NotificationEventDescriptor {
  event: NotificationEvent
  label: string
  recipientType: NotificationRecipientType
  configurable: boolean
}

interface BaseNotificationPayload {
  entityId: string
}

export interface PaymentSucceededPayload extends BaseNotificationPayload {
  amount: number
  currency: string
  paymentId: string
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  userEmail?: string | null
  userName?: string | null
}

export interface PaymentFailedPayload extends BaseNotificationPayload {
  amount: number
  currency: string
  paymentId: string
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  reason: string
  userEmail?: string | null
  userName?: string | null
}

export interface SubscriptionCreatedPayload extends BaseNotificationPayload {
  currentPeriodEnd?: string | null
  currentPeriodStart?: string | null
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  subscriptionId: string
  userEmail?: string | null
  userName?: string | null
}

export interface SubscriptionCancelledPayload extends BaseNotificationPayload {
  cancelledAt?: string | null
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  subscriptionId: string
  userEmail?: string | null
  userName?: string | null
}

export interface UserCreatedPayload extends BaseNotificationPayload {
  email: string
  name?: string | null
  userId: string
}

export interface StreamStartedPayload extends BaseNotificationPayload {
  experience: 'expansion' | 'premium' | 'regen'
  userEmail?: string | null
}

export interface StreamLimitReachedPayload extends BaseNotificationPayload {
  blockReason: string
  experience: 'expansion' | 'premium' | 'regen'
  periodEnd?: string | null
  periodStart?: string | null
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  remainingSeconds: number
  usedSeconds: number
  userEmail?: string | null
  userName?: string | null
}

export interface AdminNewUserPayload extends BaseNotificationPayload {
  email: string
  name?: string | null
  userId: string
}

export interface AdminPaymentReceivedPayload extends BaseNotificationPayload {
  amount: number
  currency: string
  paymentId: string
  plan: 'free' | 'premium' | 'regen' | 'amrita'
  userEmail?: string | null
}

export interface AdminTestPayload extends BaseNotificationPayload {
  initiatedByUserId?: string | null
  message?: string | null
}

export interface NotificationPayloadMap {
  'payment.succeeded': PaymentSucceededPayload
  'payment.failed': PaymentFailedPayload
  'subscription.created': SubscriptionCreatedPayload
  'subscription.cancelled': SubscriptionCancelledPayload
  'user.created': UserCreatedPayload
  'stream.started': StreamStartedPayload
  'stream.limit.reached': StreamLimitReachedPayload
  'admin.new.user': AdminNewUserPayload
  'admin.payment.received': AdminPaymentReceivedPayload
  'admin.test': AdminTestPayload
}

export type NotificationPayload<TEvent extends NotificationEvent> = NotificationPayloadMap[TEvent]

export interface NotificationRequest<TEvent extends NotificationEvent = NotificationEvent> {
  event: TEvent
  payload: NotificationPayload<TEvent>
  userId?: string | null
}

export const USER_NOTIFICATION_EVENTS = [
  'payment.succeeded',
  'payment.failed',
  'subscription.created',
  'subscription.cancelled',
  'user.created',
  'stream.started',
  'stream.limit.reached',
] as const satisfies readonly NotificationEvent[]

export const ADMIN_NOTIFICATION_EVENTS = [
  'admin.new.user',
  'admin.payment.received',
  'admin.test',
] as const satisfies readonly NotificationEvent[]

export const CONFIGURABLE_NOTIFICATION_EVENTS = [
  'payment.succeeded',
  'payment.failed',
  'subscription.created',
  'subscription.cancelled',
  'user.created',
  'stream.limit.reached',
  'admin.new.user',
  'admin.payment.received',
] as const satisfies readonly NotificationEvent[]

export type ConfigurableNotificationEvent = (typeof CONFIGURABLE_NOTIFICATION_EVENTS)[number]

export const ALL_NOTIFICATION_EVENTS = [
  ...CONFIGURABLE_NOTIFICATION_EVENTS,
  'stream.started',
  'admin.test',
] as const satisfies readonly NotificationEvent[]

export function getNotificationEventLabel(event: NotificationEvent) {
  return event.replace(/[._]/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

export function getNotificationRecipientType(event: NotificationEvent): NotificationRecipientType {
  return event.startsWith('admin.') ? 'admin' : 'user'
}

export function describeNotificationEvent(event: NotificationEvent): NotificationEventDescriptor {
  return {
    event,
    label: getNotificationEventLabel(event),
    recipientType: getNotificationRecipientType(event),
    configurable: CONFIGURABLE_NOTIFICATION_EVENTS.includes(event as ConfigurableNotificationEvent),
  }
}

export function getNotificationEntityId<TEvent extends NotificationEvent>(
  _event: TEvent,
  payload: NotificationPayload<TEvent>,
) {
  return payload.entityId
}
