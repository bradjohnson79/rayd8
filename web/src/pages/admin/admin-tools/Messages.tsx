import { useEffect, useState } from 'react'
import { AdminPageShell } from '../../../components/AdminPageShell'
import { useAuthToken } from '../../../features/dashboard/useAuthToken'
import { getAdminMessages, type ContactMessageRecord } from '../../../services/admin'

export function AdminMessagesPage() {
  const getAuthToken = useAuthToken()
  const [messages, setMessages] = useState<ContactMessageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadMessages() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAuthToken()

        if (!token) {
          throw new Error('Authentication token missing for messages.')
        }

        const response = await getAdminMessages(token)

        if (!cancelled) {
          setMessages(response.messages)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Unable to load messages.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadMessages()

    return () => {
      cancelled = true
    }
  }, [getAuthToken])

  return (
    <AdminPageShell
      description="Member contact requests route here so admin can review support, billing, and playback questions in one place."
      eyebrow="Admin tools"
      title="Messages"
    >
      {error ? (
        <div className="rounded-[1.75rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        {loading ? (
          <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 text-sm text-slate-400 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            Loading messages...
          </div>
        ) : messages.length ? (
          messages.map((message) => (
            <article
              className="rounded-[1.75rem] border border-white/12 bg-white/[0.05] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl"
              key={message.id}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{message.subject}</p>
                  <p className="mt-2 text-sm text-slate-300">{message.email}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-200">
                  {message.status}
                </span>
              </div>

              <p className="mt-5 text-sm leading-7 text-slate-300">{message.message}</p>
            </article>
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-white/12 bg-white/[0.045] p-5 text-sm text-slate-400 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl">
            No contact messages have been submitted yet.
          </div>
        )}
      </div>
    </AdminPageShell>
  )
}
