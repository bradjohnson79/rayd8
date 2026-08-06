import { reconcileStaleSessions } from '../src/services/player/staleSessionReconciliation.js'

function parseArgs(argv: string[]) {
  const apply = argv.includes('--apply')
  const staleArg = argv.find((arg) => arg.startsWith('--stale-minutes='))
  const batchArg = argv.find((arg) => arg.startsWith('--batch='))
  return {
    dryRun: !apply,
    staleHeartbeatMinutes: staleArg ? Number(staleArg.split('=')[1]) : undefined,
    batchLimit: batchArg ? Number(batchArg.split('=')[1]) : undefined,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const result = await reconcileStaleSessions(options)

  console.log(
    JSON.stringify(
      {
        mode: result.dryRun ? 'dry-run' : 'apply',
        ...result,
        note: result.dryRun
          ? 'No writes performed. Re-run with --apply to close stale sessions.'
          : 'Stale open usage sessions closed without adding watch-time; stale active rows deleted.',
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
