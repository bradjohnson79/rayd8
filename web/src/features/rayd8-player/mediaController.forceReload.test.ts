import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

describe('mediaController forceReload', () => {
  it('supports forceReload bypass of same-URL short-circuit', () => {
    const source = readFileSync(path.join(root, 'src/features/rayd8-player/mediaController.ts'), 'utf8')
    assert.match(source, /forceReload\s*=\s*false/)
    assert.match(source, /if \(forceReload && controllerRef\.current\)/)
    assert.match(source, /!forceReload &&/)
  })

  it('restart playback path destroys pipeline and forces reload', () => {
    const engine = readFileSync(path.join(root, 'src/features/rayd8-player/Rayd8PlayerEngine.tsx'), 'utf8')
    assert.match(engine, /handleRestartPlayback/)
    assert.match(engine, /destroyPrimaryVideoPipeline\('primary:restart-playback'\)/)
    assert.match(engine, /setForceMediaReload\(true\)/)
    assert.match(engine, /forceReload:\s*shouldForceReload/)
    assert.match(engine, /recoveryAction: 'restart_playback'/)
    assert.match(engine, /recoveryAction: 'reload_session'/)
  })
})
