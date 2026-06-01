export const AMRITA_AUDIO_TRACKS = [
  {
    available: true,
    description: 'Monastic Soul Awakening audio bed from Mux.',
    experience: 'premium',
    id: 'monasticSoulAwakening',
    label: 'Monastic Soul Awakening',
    muxAssetId: 'BJxMoeikD00SCznuoOvXx246Tf00YIJ1T24LLwPLdUPwM',
  },
  {
    available: true,
    description: 'RAYD8 Expansion audio bed from Mux.',
    experience: 'expansion',
    id: 'expansion',
    label: 'Expansion Track',
    muxAssetId: '1uhVrH02IjQZ02cd9oS2rh76Jsup0102Bdhbbjkpla86HGU',
  },
  {
    available: true,
    description: 'RAYD8 Premium audio bed from Mux.',
    experience: 'premium',
    id: 'premium',
    label: 'Premium Track',
    muxAssetId: '01AdpMIKawyRvpldKwLd2wVH7BS01ToIOQ00meJDLijJhw',
  },
];

export const DEFAULT_AMRITA_AUDIO_TRACK = 'monasticSoulAwakening';

const LEGACY_AUDIO_TRACK_IDS = {
  cosmicDrift: 'expansion',
  deepRegeneration: 'premium',
  natureField: 'premium',
  sacredSilence: 'monasticSoulAwakening',
  thetaRestoration: 'premium',
};

export function normalizeAmritaAudioTrackId(trackId) {
  if (typeof trackId !== 'string' || !trackId) {
    return DEFAULT_AMRITA_AUDIO_TRACK;
  }

  return LEGACY_AUDIO_TRACK_IDS[trackId] || trackId;
}

export function getAmritaAudioTrack(trackId) {
  const normalizedTrackId = normalizeAmritaAudioTrackId(trackId);
  return AMRITA_AUDIO_TRACKS.find((track) => track.id === normalizedTrackId) || AMRITA_AUDIO_TRACKS[0];
}
