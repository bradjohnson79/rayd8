import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '../env.js'
import * as schema from './schema.js'

function isLocalPostgresUrl(value: string) {
  return value.includes('localhost') || value.includes('127.0.0.1')
}

const databaseUrl = env.DATABASE_URL ?? null
const postgresClient = databaseUrl
  ? postgres(databaseUrl, {
      max: isLocalPostgresUrl(databaseUrl) ? 1 : 5,
    })
  : null

export const db = postgresClient ? drizzlePostgres(postgresClient, { schema }) : null
