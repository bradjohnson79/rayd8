import { memo, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  createPublicContactMessage,
  type PublicContactAttachment,
  type PublicContactTopic,
} from '../../services/contact'
import { Section } from './components/Section'
import { MarketingButton } from './components/MarketingButton'

interface ContactSectionProps {
  reducedEffects?: boolean
}

const TOPIC_OPTIONS: Array<{ label: string; value: PublicContactTopic }> = [
  { label: 'General Inquiry', value: 'general_inquiry' },
  { label: 'Report A Bug', value: 'report_a_bug' },
  { label: 'Testimonial', value: 'testimonial' },
]

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error('Unable to read the selected image.'))
    reader.readAsDataURL(file)
  })

  const [, contentBase64 = ''] = dataUrl.split(',', 2)
  if (!contentBase64) {
    throw new Error('Unable to read the selected image.')
  }

  return contentBase64
}

export const ContactSection = memo(function ContactSection({
  reducedEffects = false,
}: ContactSectionProps) {
  const [formState, setFormState] = useState({
    attachment: null as PublicContactAttachment | null,
    company: '',
    email: '',
    message: '',
    name: '',
    topic: 'general_inquiry' as PublicContactTopic,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      setFormState((current) => ({ ...current, attachment: null }))
      return
    }

    if (!file.type.startsWith('image/')) {
      setFormState((current) => ({ ...current, attachment: null }))
      setError('Please upload an image file.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFormState((current) => ({ ...current, attachment: null }))
      setError('Please upload an image smaller than 5 MB.')
      event.target.value = ''
      return
    }

    try {
      const contentBase64 = await fileToBase64(file)
      setError(null)
      setFormState((current) => ({
        ...current,
        attachment: {
          contentBase64,
          contentType: file.type,
          filename: file.name,
          size: file.size,
        },
      }))
    } catch (nextError) {
      setFormState((current) => ({ ...current, attachment: null }))
      setError(nextError instanceof Error ? nextError.message : 'Unable to read the selected image.')
      event.target.value = ''
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await createPublicContactMessage({
        attachment: formState.attachment ?? undefined,
        company: formState.company,
        email: formState.email,
        message: formState.message,
        name: formState.name,
        topic: formState.topic,
      })
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
      showBackToTop
      title="Start the conversation."
    >
      <div
        className="scroll-mt-32 rounded-[2rem] border border-white/10 bg-[rgba(7,12,16,0.52)] p-6 backdrop-blur-2xl sm:scroll-mt-40 sm:p-8"
        id="contact-form"
      >
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

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.32em] text-white/56">Topic</span>
              <select
                className="mt-3 w-full rounded-2xl border border-white/10 bg-[rgba(10,16,24,0.96)] px-4 py-3 text-sm text-white outline-none"
                onChange={(event) => setFormState((current) => ({ ...current, topic: event.target.value as PublicContactTopic }))}
                required
                value={formState.topic}
              >
                {TOPIC_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.32em] text-white/56">Image Upload</span>
              <input
                accept="image/*"
                className="mt-3 block w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-950"
                onChange={(event) => void handleAttachmentChange(event)}
                type="file"
              />
              <p className="mt-3 text-sm text-white/58">
                {formState.topic === 'report_a_bug'
                  ? 'Optional: upload a screenshot of the bug.'
                  : formState.topic === 'testimonial'
                    ? 'Optional: upload a photo to include with your testimonial.'
                    : 'Optional: upload a related image.'}
              </p>
              {formState.attachment ? (
                <p className="mt-2 text-sm text-emerald-100/85">
                  Attached: {formState.attachment.filename}
                </p>
              ) : null}
            </label>

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
