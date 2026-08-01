import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

describe('playback visibility thermal policy', () => {
  it('enables visibility lifecycle for all active sessions, not only mobile fullscreen', () => {
    const source = readFileSync(
      path.join(root, 'src/features/rayd8-player/Rayd8PlayerEngine.tsx'),
      'utf8',
    )
    assert.match(source, /enabled:\s*isActive/)
    assert.doesNotMatch(
      source,
      /enabled:\s*mobilePlaybackRefactorEnabled\s*&&\s*touchLikeFullscreenViewport/,
    )
  })

  it('pauses media on tab hide in the lifecycle hook', () => {
    const source = readFileSync(
      path.join(root, 'src/features/rayd8-player/useMobilePlaybackLifecycle.ts'),
      'utf8',
    )
    assert.match(source, /pauseMediaForHiddenTab/)
    assert.match(source, /video\.pause\(/)
    assert.match(source, /audio\.pause\(/)
  })

  it('defaults presentation mode to performance (no CSS brightness filter)', () => {
    const source = readFileSync(
      path.join(root, 'src/features/rayd8-player/Rayd8PlayerEngine.tsx'),
      'utf8',
    )
    assert.match(
      source,
      /VITE_RAYD8_PLAYBACK_PRESENTATION_MODE === 'cinematic'/,
    )
  })

  it('cancels Amrita rAF while paused and does not re-arm', () => {
    const source = readFileSync(path.join(root, 'public/amrita_app/app.js'), 'utf8')
    assert.match(source, /Stop the render loop while paused/)
    assert.match(source, /cancelAnimationFrame\(state\.frameId\)/)
    assert.match(source, /Hard-stop when not running/)
  })
})
