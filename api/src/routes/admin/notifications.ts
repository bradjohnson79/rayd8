import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdminAccess } from '../../plugins/adminAuth.js'
import { listNotificationActivity, retryNotificationActivity } from '../../services/notifications/activity.js'
import { dispatchNotification } from '../../services/notifications/dispatchNotification.js'
import {
  ALL_NOTIFICATION_EVENTS,
  describeNotificationEvent,
  type NotificationEvent,
  type NotificationPayloadMap,
} from '../../services/notifications/notificationEvents.js'
import {
  DEFAULT_ENABLED_EVENTS,
  getNotificationSettingsState,
  normalizeEmailList,
  updateNotificationSettingsState,
} from '../../services/notifications/notificationSettings.js'
import { renderNotificationTemplate } from '../../services/notifications/renderTemplate.js'
import { getAllSamplePayloads, getSamplePayload } from '../../services/notifications/samplePayloads.js'

const eventSchema = z.enum(ALL_NOTIFICATION_EVENTS)

const previewBodySchema = z.object({
  event: eventSchema,
  payload: z.record(z.string(), z.unknown()).optional(),
  recipientOverride: z.array(z.string().email()).optional(),
})

const testBodySchema = z.object({
  event: eventSchema,
  messageOverride: z.string().max(2000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  recipientOverride: z.array(z.string().email()).optional(),
})

const retryBodySchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
})

const updateSettingsSchema = z.object({
  adminRecipientsOverride: z.array(z.string()).optional(),
  enabledEvents: z.record(z.string(), z.boolean()).optional(),
})

function mergeSamplePayload<TEvent extends NotificationEvent>(
  event: TEvent,
  payload?: Record<string, unknown>,
) {
  return {
    ...getSamplePayload(event),
    ...(payload ?? {}),
  } as NotificationPayloadMap[TEvent]
}

export const adminNotificationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/events', { preHandler: requireAdminAccess }, async () => {
    const settings = await getNotificationSettingsState()

    return {
      events: ALL_NOTIFICATION_EVENTS.map((event) => ({
        ...describeNotificationEvent(event),
        enabled:
          event in settings.enabledEvents
            ? settings.enabledEvents[event as keyof typeof settings.enabledEvents]
            : true,
      })),
      sample_payloads: getAllSamplePayloads(),
      settings,
    }
  })

  app.get('/activity', { preHandler: requireAdminAccess }, async () => ({
    activity: await listNotificationActivity(),
  }))

  app.post('/preview', { preHandler: requireAdminAccess }, async (request) => {
    const { event, payload, recipientOverride } = previewBodySchema.parse(request.body)
    const mergedPayload = mergeSamplePayload(event, payload)
    const rendered = renderNotificationTemplate(event, mergedPayload)

    return {
      preview: {
        event,
        html: rendered.html,
        payload: mergedPayload,
        recipients: normalizeEmailList(recipientOverride ?? []),
        subject: rendered.subject,
      },
    }
  })

  app.post('/test', { preHandler: requireAdminAccess }, async (request) => {
    const { event, messageOverride, payload, recipientOverride } = testBodySchema.parse(request.body)
    const mergedPayload = mergeSamplePayload(event, payload)
    const effectivePayload =
      event === 'admin.test' && messageOverride
        ? { ...mergedPayload, message: messageOverride }
        : mergedPayload

    const result = await dispatchNotification(
      {
        event,
        payload: effectivePayload,
        userId: request.auth?.userId,
      },
      {
        force: true,
        recipientOverride,
      },
    )

    return {
      result,
    }
  })

  app.post('/retry', { preHandler: requireAdminAccess }, async (request) => {
    const { ids } = retryBodySchema.parse(request.body)

    return {
      result: await retryNotificationActivity(ids),
    }
  })

  app.put('/settings', { preHandler: requireAdminAccess }, async (request) => {
    const { adminRecipientsOverride, enabledEvents } = updateSettingsSchema.parse(request.body)
    const nextEnabledEvents = Object.fromEntries(
      Object.entries(enabledEvents ?? {}).filter(([event]) => event in DEFAULT_ENABLED_EVENTS),
    )

    return {
      settings: await updateNotificationSettingsState({
        adminRecipientsOverride,
        enabledEvents: nextEnabledEvents,
      }),
    }
  })
}
