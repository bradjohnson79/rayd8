import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const projectRoot = new URL('..', import.meta.url)
const scanRoots = ['src', 'public'].map((directory) => new URL(`${directory}/`, projectRoot))
const forbiddenPatterns = [
  { label: 'Tap To Start Playback', pattern: /Tap To Start Playback/ },
  { label: 'PLAYBACK PAUSED', pattern: /PLAYBACK PAUSED/ },
  { label: 'Playback Paused', pattern: /Playback Paused/ },
  { label: 'Playback paused', pattern: /Playback paused/ },
  { label: 'Your browser needs one more tap', pattern: /Your browser needs one more tap/ },
  { label: 'Resume Session', pattern: /Resume Session/ },
  { label: 'Tap once to unlock', pattern: /Tap once to unlock/ },
  { label: 'waiting for first tap', pattern: /waiting for first tap/ },
  { label: 'interaction-required', pattern: /interaction-required/ },
  { label: 'WAITING_FOR_GESTURE', pattern: /\bWAITING_FOR_GESTURE\b/ },
  { label: 'INTERRUPTED', pattern: /\bINTERRUPTED\b/ },
  { label: 'InteractionRequiredOverlay', pattern: /\bInteractionRequiredOverlay\b/ },
]
const textFileExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
])

async function collectFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directoryUrl)

    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryUrl))
      continue
    }

    if (textFileExtensions.has(path.extname(entry.name))) {
      files.push(entryUrl)
    }
  }

  return files
}

const matches = []

for (const scanRoot of scanRoots) {
  const files = await collectFiles(scanRoot)

  for (const fileUrl of files) {
    const content = await readFile(fileUrl, 'utf8')

    for (const forbiddenPattern of forbiddenPatterns) {
      if (forbiddenPattern.pattern.test(content)) {
        matches.push({
          file: path.relative(projectRoot.pathname, fileUrl.pathname),
          text: forbiddenPattern.label,
        })
      }
    }
  }
}

if (matches.length > 0) {
  console.error('Forbidden playback prompt strings remain:')
  for (const match of matches) {
    console.error(`- ${match.file}: ${match.text}`)
  }
  process.exit(1)
}

console.log('No forbidden playback prompt strings found.')
