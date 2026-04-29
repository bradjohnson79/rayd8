import { apiRequest } from './api'

export type PublicContactTopic = 'general_inquiry' | 'report_a_bug' | 'testimonial'

export interface PublicContactAttachment {
  contentBase64: string
  contentType: string
  filename: string
  size: number
}

interface PublicContactPayload {
  attachment?: PublicContactAttachment
  company?: string
  email: string
  message: string
  name: string
  topic: PublicContactTopic
}

export function createPublicContactMessage(payload: PublicContactPayload) {
  return apiRequest<{
    delivery_email: string
    emailDelivered: boolean
    ok: true
  }>('/api/contact/public', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
