import { useEffect, useState, type FormEvent } from 'react'
import { createContactMessage } from '../services/admin'
import { useAuthToken } from '../features/dashboard/useAuthToken'
import { useAuthUser } from '../features/dashboard/useAuthUser'

export function ContactPage() {
  const user = useAuthUser()
  const getAuthToken = useAuthToken()
  const [name, setName] = useState('')
  const [email, setEmail] = useState(user.email)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setEmail(user.email)
  }, [user.email])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const token = await getAuthToken()

      if (!token) {
        throw new Error('Sign in before sending a message.')
      }

      const response = await createContactMessage({ email, message, name }, token)
      setSuccess(
        response.emailDelivered
          ? `Your message was saved and emailed to ${response.delivery_email}.`
          : 'Your message was saved to the admin inbox. Email delivery is not configured yet.',
      )
      setName('')
      setMessage('')
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to send message.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
      <section className="rounded-[2.2rem] bg-[rgba(7,12,16,0.58)] p-8 shadow-[0_18px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-10">
        <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/60">Contact</p>
        <h1 className="mt-3 text-4xl font-semibold text-white">Contact Admin</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
          Send account, billing, or playback questions directly to admin. Messages are always saved
          to the admin inbox, and email delivery is attempted when configured.
        </p>

        <form
          className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Name</span>
                <input
                  className="mt-3 w-full rounded-2xl bg-white/[0.05] px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10"
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                  value={name}
                />
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Email</span>
                <input
                  className="mt-3 w-full rounded-2xl bg-white/[0.05] px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.28em] text-slate-400">Message</span>
              <textarea
                className="mt-3 min-h-56 w-full rounded-[1.8rem] bg-white/[0.05] px-4 py-4 text-sm leading-6 text-white outline-none ring-1 ring-white/10"
                maxLength={4000}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tell admin what you need help with."
                required
                value={message}
              />
            </label>

            {error ? (
              <div className="rounded-2xl bg-rose-300/10 px-4 py-3 text-sm text-rose-100 ring-1 ring-rose-300/20">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-2xl bg-emerald-300/10 px-4 py-3 text-sm text-emerald-50 ring-1 ring-emerald-300/20">
                {success}
              </div>
            ) : null}

            <button
              className="inline-flex rounded-2xl bg-emerald-300/20 px-5 py-3 text-sm font-medium text-white transition hover:scale-[1.02] hover:bg-emerald-300/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.8rem] bg-white/[0.04] p-5 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/60">Routing</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>Admin inbox target: bradjohnson79@gmail.com</p>
                <p>DB write stays primary so email delivery failure never blocks the saved message.</p>
              </div>
            </div>

            <div className="rounded-[1.8rem] bg-white/[0.04] p-5 ring-1 ring-white/10">
              <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/60">Use Cases</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>Playback issues</p>
                <p>Billing questions</p>
                <p>Account and access help</p>
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  )
}
