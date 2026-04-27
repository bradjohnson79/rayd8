import { memo, useState, type FormEvent } from 'react'
import { createPublicContactMessage } from '../../services/contact'
import { Section } from './components/Section'
import { MarketingButton } from './components/MarketingButton'

interface ContactSectionProps {
  reducedEffects?: boolean
}

export const ContactSection = memo(function ContactSection({
  reducedEffects = false,
}: ContactSectionProps) {
  const [formState, setFormState] = useState({
    company: '',
    email: '',
    message: '',
    name: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await createPublicContactMessage(formState)
      setSubmitted(true)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to send message right now.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Section
      childrenClassName="max-w-3xl"
      description="Reach out directly for questions, collaboration, access, or private discussion."
      eyebrow="Contact"
      id="contact"
      reducedEffects={reducedEffects}
      title="Start the conversation."
    >
      <div className="rounded-[2rem] border border-white/10 bg-[rgba(7,12,16,0.52)] p-6 backdrop-blur-2xl sm:p-8">
        {submitted ? (
          <div className="rounded-[1.8rem] border border-emerald-200/16 bg-emerald-300/10 p-6 text-slate-100">
            <p className="text-[11px] uppercase tracking-[0.36em] text-emerald-200/72">Message received</p>
            <p className="mt-4 text-lg leading-8">
              Message received. We&apos;ll respond shortly.
            </p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.32em] text-white/56">Name</span>
                <input
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  required
                  value={formState.name}
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.32em] text-white/56">Email</span>
                <input
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none"
                  onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                  required
                  type="email"
                  value={formState.email}
                />
              </label>
            </div>

            <label className="hidden" htmlFor="landing-company">
              Company
              <input
                autoComplete="off"
                id="landing-company"
                onChange={(event) => setFormState((current) => ({ ...current, company: event.target.value }))}
                tabIndex={-1}
                value={formState.company}
              />
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.32em] text-white/56">Message</span>
              <textarea
                className="mt-3 min-h-48 w-full rounded-[1.8rem] border border-white/10 bg-white/[0.05] px-4 py-4 text-sm leading-7 text-white outline-none"
                maxLength={4000}
                onChange={(event) => setFormState((current) => ({ ...current, message: event.target.value }))}
                required
                value={formState.message}
              />
            </label>

            {error ? (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col items-start gap-3">
              <MarketingButton disabled={submitting} type="submit">
                {submitting ? 'Sending...' : 'Send Message'}
              </MarketingButton>
              <p className="text-sm text-white/58">We typically respond within 24 hours.</p>
            </div>
          </form>
        )}
      </div>
    </Section>
  )
})
