import { neon } from '@neondatabase/serverless'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.js'
import * as schema from './schema.js'

function isLocalPostgresUrl(value: string) {
  return value.includes('localhost') || value.includes('127.0.0.1')
}

const databaseUrl = env.DATABASE_URL ?? null
const createNeonDb = (url: string) => drizzleNeon(neon(url), { schema })
type AppDb = ReturnType<typeof createNeonDb>

const postgresClient =
  databaseUrl && isLocalPostgresUrl(databaseUrl)
    ? postgres(databaseUrl, {
        max: 1,
      })
    : null

export const db: AppDb | null = !databaseUrl
  ? null
  : postgresClient
    ? (drizzlePostgres(postgresClient, { schema }) as unknown as AppDb)
    : createNeonDb(databaseUrl)
