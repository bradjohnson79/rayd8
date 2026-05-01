import { spawnSync } from 'node:child_process'

const isRender =
  process.env.RENDER === 'true' ||
  Boolean(process.env.RENDER_SERVICE_ID) ||
  Boolean(process.env.RENDER_EXTERNAL_URL)

if (!isRender) {
  console.log('[db:migrate] Skipping migration runner outside Render.')
  process.exit(0)
}

if (!process.env.DATABASE_URL) {
  console.error('[db:migrate] DATABASE_URL is required on Render before starting the API.')
  process.exit(1)
}

console.log('[db:migrate] Applying Drizzle migrations before Render starts the API.')

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['--no-install', 'drizzle-kit', 'migrate'], {
  env: process.env,
  stdio: 'inherit',
})

process.exit(result.status ?? 1)
