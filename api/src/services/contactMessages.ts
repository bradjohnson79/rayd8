import { desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { contactMessages } from '../db/schema.js'

export interface ContactMessageRecord {
  id: string
  user_id: string
  email: string
  subject: string
  message: string
  status: string
  created_at: string
}

export async function createContactMessage(input: {
  userId: string
  email: string
  subject: string
  message: string
}) {
  if (!db) {
    return null
  }

  const [record] = await db
    .insert(contactMessages)
    .values({
      email: input.email,
      message: input.message,
      subject: input.subject,
      userId: input.userId,
    })
    .returning()

  if (!record) {
    return null
  }

  return toContactMessageRecord(record)
}

export async function getContactMessages(limit?: number) {
  if (!db) {
    return []
  }

  const query = db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt))
  const records = typeof limit === 'number' ? await query.limit(limit) : await query

  return records.map(toContactMessageRecord)
}

function toContactMessageRecord(record: typeof contactMessages.$inferSelect): ContactMessageRecord {
  return {
    id: record.id,
    user_id: record.userId,
    email: record.email,
    subject: record.subject,
    message: record.message,
    status: record.status,
    created_at: record.createdAt.toISOString(),
  }
}
