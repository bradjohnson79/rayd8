import { Mux } from '@mux/mux-node'
import { env } from '../../env.js'

const muxClient =
  env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET
    ? new Mux({
        tokenId: env.MUX_TOKEN_ID,
        tokenSecret: env.MUX_TOKEN_SECRET,
      })
    : null

function getPlaybackSigningConfig() {
  if (!env.MUX_SIGNING_KEY_ID || !env.MUX_SIGNING_KEY_PRIVATE) {
    return null
  }

  return {
    keyId: env.MUX_SIGNING_KEY_ID,
    keySecret: env.MUX_SIGNING_KEY_PRIVATE.replace(/\\n/g, '\n'),
  }
}

export function isMuxPlaybackSigningConfigured() {
  return Boolean(getPlaybackSigningConfig())
}

export interface AdminMuxAsset {
  asset_id: string
  playback_id: string | null
  duration_seconds: number
  playback_policy: 'public' | 'signed' | 'drm' | null
  status: string
  title: string
}

function pickSignedPlaybackId(
  playbackIds: Array<{ id?: string | null; policy?: string | null }> | undefined,
) {
  const signedPlayback = playbackIds?.find((playbackId) => playbackId.policy === 'signed')

  if (signedPlayback?.id) {
    return signedPlayback.id
  }

  return null
}

async function ensureSignedPlaybackId(assetId: string) {
  if (!muxClient) {
    return null
  }

  const asset = await muxClient.video.assets.retrieve(assetId)
  const existingSignedPlaybackId = pickSignedPlaybackId(asset.playback_ids)

  if (existingSignedPlaybackId) {
    return {
      asset,
      playbackId: existingSignedPlaybackId,
    }
  }

  const createdPlaybackId = await muxClient.video.assets.createPlaybackId(assetId, {
    policy: 'signed',
  })

  return {
    asset,
    playbackId: createdPlaybackId.id,
  }
}

function isInvalidMuxAssetError(error: unknown) {
  return error instanceof Error && /Failed to parse ID/i.test(error.message)
}

function isMissingMuxAssetError(error: unknown) {
  return error instanceof Error && /404|not found/i.test(error.message)
}

async function signPlaybackId(playbackId: string, assetId = playbackId) {
  if (!muxClient) {
    return null
  }

  const signingConfig = getPlaybackSigningConfig()

  if (!signingConfig) {
    return null
  }

  const token = await muxClient.jwt.signPlaybackId(playbackId, {
    expiration: '10m',
    keyId: signingConfig.keyId,
    keySecret: signingConfig.keySecret,
  })

  return {
    asset_id: assetId,
    playback_id: playbackId,
    expires_in_minutes: 10,
    token,
    signed_url: `https://stream.mux.com/${playbackId}.m3u8?token=${token}`,
  }
}

export async function getMuxAssets() {
  if (!muxClient) {
    return []
  }

  const assets: AdminMuxAsset[] = []

  for await (const asset of muxClient.video.assets.list({ limit: 25 })) {
    assets.push({
      asset_id: asset.id,
      playback_id: pickSignedPlaybackId(asset.playback_ids) ?? asset.playback_ids?.[0]?.id ?? null,
      playback_policy: asset.playback_ids?.find((playbackId) => playbackId.id)?.policy ?? null,
      duration_seconds: asset.duration ?? 0,
      status: asset.status ?? 'processing',
      title: asset.passthrough ?? asset.id,
    })

    if (assets.length >= 25) {
      break
    }
  }

  return assets
}

export async function getMuxStats() {
  const assets = await getMuxAssets()

  return {
    configured: Boolean(muxClient),
    environment_key: env.MUX_ENV_KEY ?? null,
    total_assets: assets.length,
    ready_assets: assets.filter((asset) => asset.status === 'ready').length,
    processing_assets: assets.filter((asset) => asset.status !== 'ready').length,
    total_duration_seconds: assets.reduce(
      (total, asset) => total + asset.duration_seconds,
      0,
    ),
  }
}

export async function createMuxUpload(input: { corsOrigin: string; title?: string }) {
  if (!muxClient) {
    return null
  }

  const upload = await muxClient.video.uploads.create({
    cors_origin: input.corsOrigin,
    new_asset_settings: {
      playback_policies: ['signed'],
      passthrough: input.title ?? 'RAYD8 admin upload',
    },
  })

  return {
    upload_id: upload.id,
    upload_url: upload.url ?? null,
    status: upload.status,
  }
}

export async function getMuxPlaybackToken(assetId: string) {
  if (!muxClient) {
    return null
  }

  const signingConfig = getPlaybackSigningConfig()

  if (!signingConfig) {
    return null
  }

  let ensuredPlayback

  try {
    ensuredPlayback = await ensureSignedPlaybackId(assetId)
  } catch (error) {
    if (isInvalidMuxAssetError(error) || isMissingMuxAssetError(error)) {
      // Some imported IDs are already signed-playback IDs rather than asset IDs.
      return signPlaybackId(assetId)
    }

    throw error
  }

  if (!ensuredPlayback?.playbackId) {
    return null
  }

  const { asset, playbackId } = ensuredPlayback

  return signPlaybackId(playbackId, asset.id)
}
