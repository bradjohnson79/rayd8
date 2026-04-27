import { Resend } from 'resend'
import { env } from '../env.js'

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null
const contactFromEmail = env.CONTACT_FROM_EMAIL ?? 'onboarding@resend.dev'

interface ContactAdminEmailInput {
  authEmail: string
  message: string
  name: string
  replyToEmail: string
  userId: string
}

export async function sendContactAdminEmail(input: ContactAdminEmailInput) {
  if (!resendClient) {
    return false
  }

  await resendClient.emails.send({
    from: contactFromEmail,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2>New RAYD8 dashboard contact message</h2>
        <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
        <p><strong>Reply-to email:</strong> ${escapeHtml(input.replyToEmail)}</p>
        <p><strong>Authenticated account:</strong> ${escapeHtml(input.authEmail)}</p>
        <p><strong>User ID:</strong> ${escapeHtml(input.userId)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(input.message).replace(/\n/g, '<br />')}</p>
      </div>
    `,
    replyTo: input.replyToEmail,
    subject: `RAYD8 Contact - ${input.name}`,
    text: [
      'New RAYD8 dashboard contact message',
      `Name: ${input.name}`,
      `Reply-to email: ${input.replyToEmail}`,
      `Authenticated account: ${input.authEmail}`,
      `User ID: ${input.userId}`,
      '',
      input.message,
    ].join('\n'),
    to: 'bradjohnson79@gmail.com',
  })

  return true
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
