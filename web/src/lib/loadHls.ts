let hlsModulePromise: Promise<typeof import('hls.js')> | null = null

export async function loadHls() {
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js')
  }

  const module = await hlsModulePromise
  return module.default
}

export type HlsController = import('hls.js').default
