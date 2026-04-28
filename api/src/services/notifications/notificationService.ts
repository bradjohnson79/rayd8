import { Resend } from 'resend'
import { env } from '../../env.js'

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

export interface SendNotificationEmailInput {
  html: string
  subject: string
  to: string | string[]
}

export interface SendNotificationEmailResult {
  messageId: string | null
  success: boolean
}

export function getNotificationSenderEmail() {
  return env.CONTACT_FROM_EMAIL ?? null
}

export function isNotificationServiceConfigured() {
  return Boolean(resendClient && env.CONTACT_FROM_EMAIL)
}

export async function sendNotificationEmail(
  input: SendNotificationEmailInput,
): Promise<SendNotificationEmailResult> {
  if (!resendClient || !env.CONTACT_FROM_EMAIL) {
    throw new Error('Notifications email service is not configured.')
  }

  const response = await resendClient.emails.send({
    from: env.CONTACT_FROM_EMAIL,
    html: input.html,
    subject: input.subject,
    to: input.to,
  })

  const messageId = 'data' in response ? response.data?.id ?? null : null
  const error = 'error' in response ? response.error : null

  if (error) {
    throw new Error(error.message || 'Resend rejected the notification email.')
  }

  return {
    messageId,
    success: true,
  }
}
