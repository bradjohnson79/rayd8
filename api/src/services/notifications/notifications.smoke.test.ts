import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import { and, desc, eq, like } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/client.js'
import { notificationsLog, stripeEvents, subscriptions, users } from '../../db/schema.js'

function buildSmokeId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`
}

async function ensureUserRecord(input: {
  email: string
  plan?: 'free' | 'premium' | 'regen' | 'amrita'
  role?: 'member' | 'admin'
  userId: string
}) {
  if (!db) {
    throw new Error('DATABASE_URL is required for notification smoke tests.')
  }

  await db
    .insert(users)
    .values({
      email: input.email,
      id: input.userId,
      plan: input.plan ?? 'regen',
      referralCode: input.userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'SMOKETST',
      role: input.role ?? 'member',
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email,
        plan: input.plan ?? 'regen',
        referralCode: input.userId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase() || 'SMOKETST',
        role: input.role ?? 'member',
      },
    })
}

async function getNotificationRows(entityId: string) {
  if (!db) {
    return []
  }

  return db
    .select()
    .from(notificationsLog)
    .where(eq(notificationsLog.entityId, entityId))
    .orderBy(desc(notificationsLog.createdAt))
}

afterEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  vi.doUnmock('./notificationService.js')
  vi.doUnmock('resend')
  vi.doUnmock('stripe')
})

describe('notifications smoke suite', () => {
  it('notification service sends successfully and uses CONTACT_FROM_EMAIL', async () => {
    const sendSpy = vi.fn(async () => ({ data: { id: 'msg_smoke' }, error: null }))

    vi.doMock('resend', () => ({
      Resend: class MockResend {
        emails = { send: sendSpy }
      },
    }))

    const { sendNotificationEmail } = await import('./notificationService.js')
    const result = await sendNotificationEmail({
      html: '<div>Smoke test</div>',
      subject: 'Smoke test subject',
      to: 'smoke@example.com',
    })

    expect(result.success).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        from: process.env.CONTACT_FROM_EMAIL,
        subject: 'Smoke test subject',
        to: 'smoke@example.com',
      }),
    )
  })

  it('templates render valid HTML and never leak undefined values', async () => {
    const { ALL_NOTIFICATION_EVENTS } = await import('./notificationEvents.js')
    const { renderNotificationTemplate } = await import('./renderTemplate.js')
    const { getSamplePayload } = await import('./samplePayloads.js')

    for (const event of ALL_NOTIFICATION_EVENTS) {
      const rendered = renderNotificationTemplate(
        event as never,
        getSamplePayload(event as never) as never,
      )

      expect(rendered.subject.length).toBeGreaterThan(3)
      expect(rendered.html).toContain('<div')
      expect(rendered.html.toLowerCase()).not.toContain('undefined')
    }
  })

  it('dispatcher sends once, selects the template, and skips duplicates', async () => {
    if (!db) {
      throw new Error('DATABASE_URL is required for notification smoke tests.')
    }

    const sendSpy = vi.fn(async () => ({ messageId: 'msg_dispatch_smoke', success: true }))
    vi.doMock('./notificationService.js', () => ({
      getNotificationSenderEmail: () => process.env.CONTACT_FROM_EMAIL ?? null,
      isNotificationServiceConfigured: () => true,
      sendNotificationEmail: sendSpy,
    }))

    vi.doMock('../../lib/clerk.js', () => ({
      clerkClient: {
        users: {
          getUser: vi.fn(async () => ({ publicMetadata: {} })),
          updateUser: vi.fn(async () => ({})),
        },
      },
    }))

    const { dispatchNotification } = await import('./dispatchNotification.js')
    const entityId = buildSmokeId('smoke_dispatch')
    const userId = buildSmokeId('user_dispatch')
    await ensureUserRecord({
      email: `${entityId}@example.com`,
      userId,
    })

    const first = await dispatchNotification({
      event: 'payment.succeeded',
      payload: {
        amount: 149,
        currency: 'USD',
        entityId,
        paymentId: `${entityId}_payment`,
        plan: 'regen',
        userEmail: `${entityId}@example.com`,
      },
      userId,
    })

    const second = await dispatchNotification({
      event: 'payment.succeeded',
      payload: {
        amount: 149,
        currency: 'USD',
        entityId,
        paymentId: `${entityId}_payment`,
        plan: 'regen',
        userEmail: `${entityId}@example.com`,
      },
      userId,
    })

    const rows = await getNotificationRows(entityId)

    expect(first.subject).toContain('Payment confirmed')
    expect(first.delivered).toBe(1)
    expect(second.skipped).toBe(1)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(rows.some((row) => row.status === 'sent')).toBe(true)
    expect(rows.some((row) => row.status === 'skipped_duplicate')).toBe(true)
  })

  it('logs failure states when delivery fails', async () => {
    if (!db) {
      throw new Error('DATABASE_URL is required for notification smoke tests.')
    }

    vi.doMock('./notificationService.js', () => ({
      getNotificationSenderEmail: () => process.env.CONTACT_FROM_EMAIL ?? null,
      isNotificationServiceConfigured: () => true,
      sendNotificationEmail: vi.fn(async () => {
        throw new Error('Resend failure smoke')
      }),
    }))

    const { dispatchNotification } = await import('./dispatchNotification.js')
    const entityId = buildSmokeId('smoke_failure')
    const userId = buildSmokeId('user_failure')
    await ensureUserRecord({
      email: `${entityId}@example.com`,
      userId,
    })

    await expect(
      dispatchNotification({
        event: 'payment.failed',
        payload: {
          amount: 149,
          currency: 'USD',
          entityId,
          paymentId: `${entityId}_payment`,
          plan: 'regen',
          reason: 'Card declined',
          userEmail: `${entityId}@example.com`,
        },
        userId,
      }),
    ).rejects.toThrow('Resend failure smoke')

    const rows = await getNotificationRows(entityId)
    expect(rows[0]?.status).toBe('failed')
    expect(rows[0]?.error).toContain('Resend failure smoke')
  })

  it('simulates Stripe payment success and writes notification logs', async () => {
    if (!db) {
      throw new Error('DATABASE_URL is required for notification smoke tests.')
    }

    const sendSpy = vi.fn(async () => ({ messageId: 'msg_stripe_smoke', success: true }))

    vi.doMock('stripe', () => ({
      default: class MockStripe {
        subscriptions = {
          retrieve: retrieveSpy,
        }
      },
    }))

    vi.doMock('./notificationService.js', () => ({
      getNotificationSenderEmail: () => process.env.CONTACT_FROM_EMAIL ?? null,
      isNotificationServiceConfigured: () => true,
      sendNotificationEmail: sendSpy,
    }))

    const stripeUserId = buildSmokeId('user_stripe')
    const subscriptionId = buildSmokeId('sub_stripe')
    const invoiceId = buildSmokeId('invoice_stripe')
    const eventId = buildSmokeId('evt_stripe')
    const customerId = buildSmokeId('cus_stripe')
    const retrieveSpy = vi.fn(async (subscriptionIdArg: string) => ({
      customer: customerId,
      id: subscriptionIdArg,
      items: {
        data: [
          {
            current_period_end: Math.floor(Date.now() / 1000) + 86400,
            current_period_start: Math.floor(Date.now() / 1000),
            price: { id: process.env.STRIPE_REGEN_PRICE_ID ?? 'price_smoke' },
          },
        ],
      },
      metadata: {
        plan: 'regen',
        planType: 'single',
        userId: stripeUserId,
      },
      status: 'active',
    }))
    await ensureUserRecord({
      email: `${invoiceId}@example.com`,
      userId: stripeUserId,
    })
    await db
      .insert(subscriptions)
      .values({
        currentPeriodEnd: new Date(Date.now() + 86400 * 1000),
        currentPeriodStart: new Date(),
        plan: 'regen',
        planType: 'single',
        status: 'active',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        userId: stripeUserId,
      })
      .onConflictDoUpdate({
        target: subscriptions.stripeSubscriptionId,
        set: {
          plan: 'regen',
          status: 'active',
          userId: stripeUserId,
        },
      })

    const { processStripeEvent } = await import('../subscriptions.js')
    await processStripeEvent({
      data: {
        object: {
          amount_due: 14900,
          amount_paid: 14900,
          currency: 'usd',
          id: invoiceId,
          subscription: subscriptionId,
        },
      },
      id: eventId,
      type: 'invoice.payment_succeeded',
    } as never)

    const rows = await getNotificationRows(invoiceId)
    expect(sendSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(rows.some((row) => row.event === 'payment.succeeded' && row.status === 'sent')).toBe(true)
    expect(rows.some((row) => row.event === 'admin.payment.received' && row.status === 'sent')).toBe(true)

    await db.delete(stripeEvents).where(eq(stripeEvents.stripeEventId, eventId))
  })

  it('fires a stream-limit notification when access becomes blocked', async () => {
    if (!db) {
      throw new Error('DATABASE_URL is required for notification smoke tests.')
    }

    const sendSpy = vi.fn(async () => ({ messageId: 'msg_stream_smoke', success: true }))
    vi.doMock('./notificationService.js', () => ({
      getNotificationSenderEmail: () => process.env.CONTACT_FROM_EMAIL ?? null,
      isNotificationServiceConfigured: () => true,
      sendNotificationEmail: sendSpy,
    }))

    const { maybeDispatchStreamLimitReached } = await import('./streamLimitNotifications.js')
    const userId = buildSmokeId('user_stream')
    const periodStart = new Date()
    const entityFragment = periodStart.toISOString()
    await ensureUserRecord({
      email: `${userId}@example.com`,
      plan: 'free',
      userId,
    })

    await maybeDispatchStreamLimitReached({
      access: {
        allowed: false,
        blockReason: 'free_regen_limit_reached',
        experience: 'regen',
        isBlocked: true,
        limitMinutes: 60,
        limitSeconds: 3600,
        minutesRemaining: 0,
        minutesUsed: 60,
        remainingSeconds: 0,
        state: 'blocked',
        usage: {
          expansionUsedSeconds: 0,
          periodEnd: new Date('9999-12-31T23:59:59.999Z'),
          periodStart,
          periodType: 'lifetime',
          premiumUsedSeconds: 0,
          regenUsedSeconds: 3600,
          totalUsedSeconds: 3600,
        },
        usagePercent: 100,
        usedSeconds: 3600,
        warningState: 'none',
      },
      plan: 'free',
      userId,
    })

    const rows = await db
      .select()
      .from(notificationsLog)
      .where(
        and(
          eq(notificationsLog.event, 'stream.limit.reached'),
          like(notificationsLog.entityId, `%${entityFragment}%`),
        ),
      )

    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(rows.some((row) => row.status === 'sent')).toBe(true)
  })

  it('supports admin preview and sample send endpoints', async () => {
    if (!db) {
      throw new Error('DATABASE_URL is required for notification smoke tests.')
    }

    const sendSpy = vi.fn(async () => ({ messageId: 'msg_admin_smoke', success: true }))
    vi.doMock('./notificationService.js', () => ({
      getNotificationSenderEmail: () => process.env.CONTACT_FROM_EMAIL ?? null,
      isNotificationServiceConfigured: () => true,
      sendNotificationEmail: sendSpy,
    }))

    const { adminNotificationRoutes } = await import('../../routes/admin/notifications.js')
    await ensureUserRecord({
      email: 'admin-smoke@example.com',
      plan: 'regen',
      role: 'admin',
      userId: 'admin_smoke_user',
    })
    const app = Fastify()
    app.decorateRequest('auth', null)
    app.addHook('preHandler', async (request) => {
      ;(request as typeof request & {
        auth: { email: string | null; plan: 'regen'; role: 'admin'; userId: string }
      }).auth = {
        email: 'admin-smoke@example.com',
        plan: 'regen',
        role: 'admin',
        userId: 'admin_smoke_user',
      }
    })
    await app.register(adminNotificationRoutes, { prefix: '/api/admin/notifications' })

    const previewResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/notifications/preview',
      payload: {
        event: 'admin.test',
      },
    })

    expect(previewResponse.statusCode).toBe(200)
    expect(previewResponse.json().preview.html).toContain('Notification pipeline verified')

    const entityId = buildSmokeId('admin_test')
    const testResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/notifications/test',
      payload: {
        event: 'admin.test',
        messageOverride: 'Smoke suite sample send',
        payload: {
          entityId,
          initiatedByUserId: 'admin_smoke_user',
        },
        recipientOverride: ['smoke-admin@example.com'],
      },
    })

    expect(testResponse.statusCode).toBe(200)
    expect(sendSpy).toHaveBeenCalledTimes(1)
    const rows = await getNotificationRows(entityId)
    expect(rows.some((row) => row.event === 'admin.test' && row.status === 'sent')).toBe(true)

    await app.close()
  })
})
