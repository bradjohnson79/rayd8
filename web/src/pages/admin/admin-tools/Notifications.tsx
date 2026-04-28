import { useEffect, useMemo, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import {
  getAdminNotificationActivity,
  getAdminNotificationEvents,
  previewAdminNotification,
  retryAdminNotifications,
  sendAdminNotificationTest,
  type AdminNotificationActivityRecord,
  type AdminNotificationEventInfo,
  type AdminNotificationSettings,
  updateAdminNotificationSettings,
} from '../../../services/admin'

function parseRecipients(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function prettyDate(value: string | null) {
  if (!value) {
    return 'Not sent'
  }

  return new Date(value).toLocaleString()
}

export function AdminNotificationsPage() {
  const getAuthToken = useAuthToken()
  const [activity, setActivity] = useState<AdminNotificationActivityRecord[]>([])
  const [adminRecipientsText, setAdminRecipientsText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<AdminNotificationEventInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [payloadByEvent, setPayloadByEvent] = useState<Record<string, Record<string, unknown>>>({})
  const [payloadText, setPayloadText] = useState('{}')
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewSubject, setPreviewSubject] = useState('')
  const [recipientOverrideText, setRecipientOverrideText] = useState('')
  const [sampleMessage, setSampleMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState('')
  const [sending, setSending] = useState(false)
  const [settings, setSettings] = useState<AdminNotificationSettings | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const configurableEvents = useMemo(
    () => events.filter((event) => event.configurable),
    [events],
  )

  useEffect(() => {
    let cancelled = false

    async function loadNotifications() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for notifications.')
        }

        const [eventsResponse, activityResponse] = await Promise.all([
          getAdminNotificationEvents(token),
          getAdminNotificationActivity(token),
        ])

        if (cancelled) {
          return
        }

        setEvents(eventsResponse.events)
        setPayloadByEvent(eventsResponse.sample_payloads)
        setSettings(eventsResponse.settings)
        setAdminRecipientsText(eventsResponse.settings.adminRecipientsOverride.join(', '))
        setActivity(activityResponse.activity)

        const firstEvent = eventsResponse.events[0]?.event ?? ''
        const nextSelectedEvent = selectedEvent || firstEvent
        setSelectedEvent(nextSelectedEvent)

        if (nextSelectedEvent) {
          setPayloadText(JSON.stringify(eventsResponse.sample_payloads[nextSelectedEvent] ?? {}, null, 2))
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error ? nextError.message : 'Unable to load notification settings.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  useEffect(() => {
    if (!selectedEvent || !(selectedEvent in payloadByEvent)) {
      return
    }

    setPayloadText(JSON.stringify(payloadByEvent[selectedEvent] ?? {}, null, 2))
  }, [payloadByEvent, selectedEvent])

  async function refreshActivity() {
    const token = await getAuthToken()

    if (!token) {
      throw new Error('Authentication token missing for notifications.')
    }

    const response = await getAdminNotificationActivity(token)
    setActivity(response.activity)
  }

  async function handlePreview() {
    if (!selectedEvent) {
      return
    }

    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for preview.')
      }

      const parsedPayload = JSON.parse(payloadText) as Record<string, unknown>
      const response = await previewAdminNotification(
        {
          event: selectedEvent,
          payload: parsedPayload,
          recipientOverride: parseRecipients(recipientOverrideText),
        },
        token,
      )

      setPayloadText(JSON.stringify(response.preview.payload, null, 2))
      setPreviewHtml(response.preview.html)
      setPreviewSubject(response.preview.subject)
      setStatusMessage('Preview rendered successfully.')
    } catch (nextError) {
      setStatusMessage(nextError instanceof Error ? nextError.message : 'Preview failed.')
      setPreviewHtml('')
      setPreviewSubject('Preview failed')
    }
  }

  async function handleSaveSettings() {
    if (!settings) {
      return
    }

    setSaving(true)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for notifications.')
      }

      const response = await updateAdminNotificationSettings(
        {
          adminRecipientsOverride: parseRecipients(adminRecipientsText),
          enabledEvents: settings.enabledEvents,
        },
        token,
      )

      setSettings(response.settings)
      setAdminRecipientsText(response.settings.adminRecipientsOverride.join(', '))
      setStatusMessage('Notification settings saved.')
    } catch (nextError) {
      setStatusMessage(nextError instanceof Error ? nextError.message : 'Unable to save settings.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSendSample() {
    if (!selectedEvent) {
      return
    }

    setSending(true)
    setStatusMessage(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for notifications.')
      }

      const parsedPayload = JSON.parse(payloadText) as Record<string, unknown>
      const response = await sendAdminNotificationTest(
        {
          event: selectedEvent,
          messageOverride: sampleMessage.trim() || undefined,
          payload: parsedPayload,
          recipientOverride: parseRecipients(recipientOverrideText),
        },
        token,
      )

      setStatusMessage(
        response.result.success
          ? `Sample email handled for ${response.result.recipients.join(', ') || 'resolved recipients'}.`
          : 'Sample email failed.',
      )
      await refreshActivity()
    } catch (nextError) {
      setStatusMessage(nextError instanceof Error ? nextError.message : 'Unable to send sample email.')
    } finally {
      setSending(false)
    }
  }

  async function handleRetry(id: string) {
    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Authentication token missing for retry.')
      }

      await retryAdminNotifications({ ids: [id] }, token)
      setStatusMessage('Retry submitted.')
      await refreshActivity()
    } catch (nextError) {
      setStatusMessage(nextError instanceof Error ? nextError.message : 'Unable to retry notification.')
    }
  }

  function handleToggle(eventName: string, enabled: boolean) {
    if (!settings) {
      return
    }

    setSettings({
      ...settings,
      enabledEvents: {
        ...settings.enabledEvents,
        [eventName]: enabled,
      },
    })
  }

  return (
    <AdminPageShell
      description="Manage notification delivery, preview email templates, send live samples, and review the delivery log from one admin surface."
      eyebrow="Admin tools"
      title="Notifications"
    >
      {error ? (
        <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {statusMessage ? (
        <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-4 text-sm text-slate-200 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
          {statusMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-violet-200/60">Left panel</p>
              <h2 className="mt-3 text-xl font-semibold text-white">Event toggles</h2>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Enable or disable each notification event and control the admin recipient list.
              </p>
            </div>
            <button
              className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              onClick={handleSaveSettings}
              type="button"
            >
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Admin recipients</p>
            <textarea
              className="mt-3 min-h-24 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-300/40"
              onChange={(event) => setAdminRecipientsText(event.target.value)}
              placeholder="Separate email addresses with commas"
              value={adminRecipientsText}
            />
            <p className="mt-3 text-xs text-slate-400">
              Effective recipients: {settings?.effectiveAdminRecipients.join(', ') || 'Not configured'}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                Loading notification events...
              </div>
            ) : (
              configurableEvents.map((eventInfo) => (
                <label
                  className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/[0.04] px-4 py-4"
                  key={eventInfo.event}
                >
                  <div>
                    <p className="font-medium text-white">{eventInfo.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {eventInfo.recipientType} notification
                    </p>
                  </div>
                  <button
                    aria-label={`Toggle ${eventInfo.label}`}
                    className={[
                      'relative inline-flex h-7 w-12 items-center rounded-full border transition',
                      settings?.enabledEvents[eventInfo.event]
                        ? 'border-cyan-300/60 bg-cyan-300/30'
                        : 'border-white/10 bg-white/10',
                    ].join(' ')}
                    onClick={() =>
                      handleToggle(eventInfo.event, !settings?.enabledEvents[eventInfo.event])
                    }
                    type="button"
                  >
                    <span
                      className={[
                        'inline-block h-5 w-5 rounded-full bg-white shadow transition',
                        settings?.enabledEvents[eventInfo.event] ? 'translate-x-6' : 'translate-x-1',
                      ].join(' ')}
                    />
                  </button>
                </label>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
          <p className="text-xs uppercase tracking-[0.28em] text-violet-200/60">Right panel</p>
          <h2 className="mt-3 text-xl font-semibold text-white">Sample send and preview</h2>
          <p className="mt-2 text-sm leading-7 text-slate-300">
            Pick an event, adjust the sample payload, override recipients if needed, and either render a dry preview or send a live sample.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Event</span>
              <select
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                onChange={(event) => setSelectedEvent(event.target.value)}
                value={selectedEvent}
              >
                {events.map((eventInfo) => (
                  <option className="bg-slate-950 text-white" key={eventInfo.event} value={eventInfo.event}>
                    {eventInfo.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Recipient override</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
                onChange={(event) => setRecipientOverrideText(event.target.value)}
                placeholder="optional@example.com, admin@example.com"
                value={recipientOverrideText}
              />
            </label>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Message override</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
              onChange={(event) => setSampleMessage(event.target.value)}
              placeholder="Optional custom test message"
              value={sampleMessage}
            />
          </label>

          <label className="mt-4 block space-y-2">
            <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Payload editor</span>
            <textarea
              className="min-h-72 w-full rounded-[1.5rem] border border-white/10 bg-[#050912] px-4 py-4 font-mono text-sm text-slate-200 outline-none"
              onChange={(event) => setPayloadText(event.target.value)}
              value={payloadText}
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-[linear-gradient(135deg,#74d7ff_0%,#7b8cff_52%,#b667ff_100%)] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              onClick={handleSendSample}
              type="button"
            >
              {sending ? 'Sending...' : 'Send Sample Email'}
            </button>
            <button
              className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.1]"
              onClick={handlePreview}
              type="button"
            >
              Render Preview
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-[2rem] border border-white/12 bg-white/[0.045] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-violet-200/60">Preview</p>
            <h2 className="mt-3 text-xl font-semibold text-white">Live email preview</h2>
            <p className="mt-2 text-sm leading-7 text-slate-300">{previewSubject || 'Render a preview to inspect the current template.'}</p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#02040a]">
          <iframe
            className="min-h-[560px] w-full bg-white"
            srcDoc={previewHtml || '<div style="padding:24px;font-family:Arial,sans-serif;">Render a preview to inspect the email.</div>'}
            title="Notification email preview"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-violet-200/60">Activity log</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Recent delivery attempts</h2>
          </div>
          <button
            className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.1]"
            onClick={() => {
              void refreshActivity()
            }}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-300">
            <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.24em] text-slate-500">
              <tr>
                <th className="px-5 py-4">Event</th>
                <th className="px-5 py-4">Entity</th>
                <th className="px-5 py-4">Recipient</th>
                <th className="px-5 py-4">Type</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Sent</th>
                <th className="px-5 py-4">Failure</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-slate-400" colSpan={8}>
                    Loading notification activity...
                  </td>
                </tr>
              ) : activity.length ? (
                activity.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-white">{row.event}</p>
                      <p className="mt-1 text-xs text-slate-500">{prettyDate(row.created_at)}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">{row.entity_id}</td>
                    <td className="px-5 py-4">{row.recipient}</td>
                    <td className="px-5 py-4 uppercase text-slate-400">{row.type}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{prettyDate(row.sent_at)}</td>
                    <td className="px-5 py-4 text-xs text-rose-200">{row.error || 'None'}</td>
                    <td className="px-5 py-4">
                      {row.status === 'failed' ? (
                        <button
                          className="rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white transition hover:bg-white/[0.1]"
                          onClick={() => {
                            void handleRetry(row.id)
                          }}
                          type="button"
                        >
                          Retry
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-6 text-slate-400" colSpan={8}>
                    No notification activity has been recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminPageShell>
  )
}
