import type { FastifyBaseLogger } from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from './client.js'
import { env } from '../env.js'

const requiredColumns = [
  { tableName: 'users', columnName: 'trial_started_at' },
  { tableName: 'users', columnName: 'trial_ends_at' },
  { tableName: 'users', columnName: 'trial_hours_used' },
  { tableName: 'users', columnName: 'trial_notifications_sent' },
  { tableName: 'users', columnName: 'referral_code' },
  { tableName: 'users', columnName: 'referred_by_user_id' },
  { tableName: 'user_settings', columnName: 'has_seen_rayd8_guide_at' },
] as const

const requiredTables = [
  'affiliate_commissions',
  'referral_sessions',
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

function getResultRows(result: unknown) {
  if (Array.isArray(result)) {
    return result
  }

  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows
    return Array.isArray(rows) ? rows : []
  }

  return []
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
      and table_name in (
        'affiliate_commissions',
        'referral_sessions',
        'seo_actions',
        'seo_audits',
        'seo_reports',
        'seo_route_metadata'
      )
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
          'trial_notifications_sent',
          'referral_code',
          'referred_by_user_id'
        ))
        or (table_name = 'user_settings' and column_name = 'has_seen_rayd8_guide_at')
      )
  `)

  const latestMigrationRows = getResultRows(latestMigration)
  const tableResultRows = getResultRows(tableRows)
  const columnResultRows = getResultRows(columnRows)

  const existingTables = new Set(tableResultRows.map((row) => String((row as { table_name: unknown }).table_name)))
  const existingColumns = new Set(
    columnResultRows.map(
      (row) =>
        `${String((row as { table_name: unknown }).table_name)}.${String((row as { column_name: unknown }).column_name)}`,
    ),
  )
  const missingTables = requiredTables.filter((tableName) => !existingTables.has(tableName))
  const missingColumns = requiredColumns
    .map((column) => `${column.tableName}.${column.columnName}`)
    .filter((column) => !existingColumns.has(column))

  logger.info(
    {
      database: target.database,
      host: target.host,
      latestMigration: latestMigrationRows[0] ?? null,
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
