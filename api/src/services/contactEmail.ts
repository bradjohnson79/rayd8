import { Resend } from 'resend'
import { env } from '../env.js'

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
const contactFromEmail = env.CONTACT_FROM_EMAIL ?? 'onboarding@resend.dev'

interface ContactAdminEmailInput {
  attachment?: {
    contentBase64: string
    contentType: string
    filename: string
    size: number
  }
  authEmail: string
  message: string
  name: string
  replyToEmail: string
  topic?: 'general_inquiry' | 'report_a_bug' | 'testimonial'
  userId: string
}

export async function sendContactAdminEmail(input: ContactAdminEmailInput) {
  if (!resendClient) {
    return false
  }

  const topicLabel = formatTopicLabel(input.topic)
  const attachmentSummary = input.attachment
    ? `${input.attachment.filename} (${input.attachment.contentType}, ${Math.ceil(input.attachment.size / 1024)} KB)`
    : 'None'

  await resendClient.emails.send({
    attachments: input.attachment
      ? [
          {
            content: Buffer.from(input.attachment.contentBase64, 'base64'),
            contentType: input.attachment.contentType,
            filename: input.attachment.filename,
          },
        ]
      : undefined,
    from: contactFromEmail,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2>New RAYD8 dashboard contact message</h2>
        <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Reply-to email:</strong> ${escapeHtml(input.replyToEmail)}</p>
        <p><strong>Authenticated account:</strong> ${escapeHtml(input.authEmail)}</p>
        <p><strong>User ID:</strong> ${escapeHtml(input.userId)}</p>
        <p><strong>Topic:</strong> ${escapeHtml(topicLabel)}</p>
        <p><strong>Attachment:</strong> ${escapeHtml(attachmentSummary)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(input.message).replace(/\n/g, '<br />')}</p>
      </div>
    `,
    replyTo: input.replyToEmail,
    subject: `RAYD8 Contact - ${topicLabel} - ${input.name}`,
    text: [
      'New RAYD8 dashboard contact message',
      `Name: ${input.name}`,
      `Reply-to email: ${input.replyToEmail}`,
      `Authenticated account: ${input.authEmail}`,
      `User ID: ${input.userId}`,
      `Topic: ${topicLabel}`,
      `Attachment: ${attachmentSummary}`,
      '',
      input.message,
    ].join('\n'),
    to: 'bradjohnson79@gmail.com',
  })

  return true
}

function formatTopicLabel(topic?: ContactAdminEmailInput['topic']) {
  switch (topic) {
    case 'report_a_bug':
      return 'Report A Bug'
    case 'testimonial':
      return 'Testimonial'
    case 'general_inquiry':
    default:
      return 'General Inquiry'
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
