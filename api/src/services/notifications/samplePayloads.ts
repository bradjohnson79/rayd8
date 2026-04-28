import type { NotificationEvent, NotificationPayload, NotificationPayloadMap } from './notificationEvents.js'

type SamplePayloadFactoryMap = {
  [TEvent in NotificationEvent]: () => NotificationPayload<TEvent>
}

const SAMPLE_PAYLOAD_FACTORIES: SamplePayloadFactoryMap = {
  'payment.succeeded': () => ({
    amount: 149,
    currency: 'USD',
    entityId: 'invoice_sample_paid',
    paymentId: 'pay_sample_paid',
    plan: 'regen',
    userEmail: 'member@example.com',
    userName: 'RAYD8 Member',
  }),
  'payment.failed': () => ({
    amount: 149,
    currency: 'USD',
    entityId: 'invoice_sample_failed',
    paymentId: 'pay_sample_failed',
    plan: 'regen',
    reason: 'Card was declined by the bank.',
    userEmail: 'member@example.com',
    userName: 'RAYD8 Member',
  }),
  'subscription.created': () => ({
    currentPeriodEnd: new Date('2026-05-27T00:00:00.000Z').toISOString(),
    currentPeriodStart: new Date('2026-04-27T00:00:00.000Z').toISOString(),
    entityId: 'sub_sample_created',
    plan: 'regen',
    subscriptionId: 'sub_sample_created',
    userEmail: 'member@example.com',
    userName: 'RAYD8 Member',
  }),
  'subscription.cancelled': () => ({
    cancelledAt: new Date('2026-04-27T18:30:00.000Z').toISOString(),
    entityId: 'sub_sample_cancelled',
    plan: 'regen',
    subscriptionId: 'sub_sample_cancelled',
    userEmail: 'member@example.com',
    userName: 'RAYD8 Member',
  }),
  'user.created': () => ({
    email: 'new-member@example.com',
    entityId: 'user_sample_created',
    name: 'New Member',
    userId: 'user_sample_created',
  }),
  'stream.started': () => ({
    entityId: 'stream_sample_started',
    experience: 'regen',
    userEmail: 'member@example.com',
  }),
  'stream.limit.reached': () => ({
    blockReason: 'regen_total_limit_reached',
    entityId: 'stream_limit_sample',
    experience: 'regen',
    periodEnd: new Date('2026-05-27T00:00:00.000Z').toISOString(),
    periodStart: new Date('2026-04-27T00:00:00.000Z').toISOString(),
    plan: 'regen',
    remainingSeconds: 0,
    usedSeconds: 250 * 3600,
    userEmail: 'member@example.com',
    userName: 'RAYD8 Member',
  }),
  'admin.new.user': () => ({
    email: 'new-member@example.com',
    entityId: 'admin_new_user_sample',
    name: 'New Member',
    userId: 'user_sample_created',
  }),
  'admin.payment.received': () => ({
    amount: 149,
    currency: 'USD',
    entityId: 'admin_payment_sample',
    paymentId: 'pay_admin_sample',
    plan: 'regen',
    userEmail: 'member@example.com',
  }),
  'admin.test': () => ({
    entityId: 'admin_test_sample',
    initiatedByUserId: 'admin_test_user',
    message: 'RAYD8 notification smoke test completed successfully.',
  }),
}

export function getSamplePayload<TEvent extends NotificationEvent>(event: TEvent): NotificationPayload<TEvent> {
  return SAMPLE_PAYLOAD_FACTORIES[event]() as NotificationPayload<TEvent>
}

export function getAllSamplePayloads() {
  const entries = Object.entries(SAMPLE_PAYLOAD_FACTORIES).map(([event, factory]) => [
    event,
    factory(),
  ])

  return Object.fromEntries(entries) as {
    [TEvent in NotificationEvent]: NotificationPayloadMap[TEvent]
  }
}
