import { main } from './sync-users-to-aweber.js'

main(['--plan=free', ...process.argv.slice(2)])
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[aweber] sync failed:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
