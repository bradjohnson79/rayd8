import type { FastifyBaseLogger } from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from './client.js'
import { env } from '../env.js'

const requiredColumns = [
  { tableName: 'users', columnName: 'trial_started_at' },
  { tableName: 'users', columnName: 'trial_ends_at' },
  { tableName: 'users', columnName: 'trial_hours_used' },
  { tableName: 'users', columnName: 'trial_notifications_sent' },
  { tableName: 'user_settings', columnName: 'has_seen_rayd8_guide_at' },
] as const

const requiredTables = [
  'seo_actions',
  'seo_audits',
  'seo_reports',
  'seo_route_metadata',
] as const

function getDatabaseTarget() {
  if (!env.DATABASE_URL) {
    return null
  }

  try {
    const url = new URL(env.DATABASE_URL)

    return {
      database: url.pathname.replace(/^\//, '') || null,
      host: url.host,
    }
  } catch {
    return {
      database: null,
      host: 'unparseable',
    }
  }
}

export async function verifyDatabaseStartup(logger: FastifyBaseLogger) {
  const target = getDatabaseTarget()

  if (!db || !target) {
    logger.warn({ code: 'DATABASE_DISABLED' }, 'DATABASE_URL is not configured; database checks skipped.')
    return
  }

  const latestMigration = await db.execute(sql`
    select id, created_at
    from drizzle.__drizzle_migrations
    order by id desc
    limit 1
  `)
  const tableRows = await db.execute(sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in ('seo_actions', 'seo_audits', 'seo_reports', 'seo_route_metadata')
  `)
  const columnRows = await db.execute(sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'users' and column_name in (
          'trial_started_at',
          'trial_ends_at',
          'trial_hours_used',
          'trial_notifications_sent'
        ))
        or (table_name = 'user_settings' and column_name = 'has_seen_rayd8_guide_at')
      )
  `)

  const existingTables = new Set(tableRows.rows.map((row) => String(row.table_name)))
  const existingColumns = new Set(
    columnRows.rows.map((row) => `${String(row.table_name)}.${String(row.column_name)}`),
  )
  const missingTables = requiredTables.filter((tableName) => !existingTables.has(tableName))
  const missingColumns = requiredColumns
    .map((column) => `${column.tableName}.${column.columnName}`)
    .filter((column) => !existingColumns.has(column))

  logger.info(
    {
      database: target.database,
      host: target.host,
      latestMigration: latestMigration.rows[0] ?? null,
      requiredColumnsPresent: missingColumns.length === 0,
      requiredTablesPresent: missingTables.length === 0,
    },
    'Database startup verification complete.',
  )

  if (missingTables.length > 0 || missingColumns.length > 0) {
    logger.error(
      {
        code: 'DB_SCHEMA_ERROR',
        missingColumns,
        missingTables,
      },
      'Required database schema is missing.',
    )

    throw new Error('Required database schema is missing.')
  }
}
