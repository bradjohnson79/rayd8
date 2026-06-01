import { getAmritaAudioTrack } from './audio-manifest.js';

const PRODUCTION_API_BASE = 'https://rayd8-api.onrender.com';

const HLS_CONFIG = {
  backBufferLength: 30,
  enableWorker: true,
  lowLatencyMode: false,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
};

let audioElement = null;
let hlsController = null;
let loadRequestId = 0;
let currentTrackId = 'none';
let currentSourceUrl = '';
let outputVolume = 0.8;
let outputMuted = false;

function resolveApiBaseUrl() {
  const configured = document.querySelector('meta[name="amrita-api-base"]')?.content?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }

  return PRODUCTION_API_BASE;
}

function getHlsConstructor() {
  return window.Hls ?? null;
}

function applyOutputSettings() {
  if (!audioElement) return;

  const shouldMute = outputMuted || currentTrackId === 'none';
  audioElement.muted = shouldMute;
  audioElement.volume = shouldMute ? 0 : outputVolume;
}

function isRequestActive(requestId) {
  return requestId === loadRequestId;
}

function waitForCanPlay(media, requestId) {
  return new Promise((resolve, reject) => {
    if (!media || !isRequestActive(requestId)) {
      reject(new Error('Audio request cancelled.'));
      return;
    }

    if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve();
      return;
    }

    const cleanup = () => {
      media.removeEventListener('canplay', handleCanPlay);
      media.removeEventListener('error', handleError);
    };

    const handleCanPlay = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Unable to decode the audio stream.'));
    };

    media.addEventListener('canplay', handleCanPlay, { once: true });
    media.addEventListener('error', handleError, { once: true });
  });
}

async function getClerkToken() {
  const windows = [window.parent, window.top, window].filter(
    (candidate, index, list) => candidate && list.indexOf(candidate) === index,
  );

  for (const targetWindow of windows) {
    try {
      const clerk = targetWindow.Clerk;
      if (!clerk) continue;
      if (!clerk.loaded) await clerk.load();
      if (!clerk.session) continue;

      const token = await clerk.session.getToken();
      if (token) return token;
    } catch {
      // Try the next Clerk host window.
    }
  }

  return null;
}

async function fetchMuxPlaybackToken(track) {
  const token = await getClerkToken();

  if (!token) {
    throw new Error('Sign in to RAYD8 to play the selected AMRITA audio track.');
  }

  const apiBase = resolveApiBaseUrl();
  const attempts = [
    `/api/admin/mux/playback-token?assetId=${encodeURIComponent(track.muxAssetId)}`,
    ...(track.experience
      ? [`/v1/player/playback-token?assetId=${encodeURIComponent(track.muxAssetId)}&experience=${encodeURIComponent(track.experience)}`]
      : []),
  ];

  let lastError = 'Unable to load the selected audio track.';

  for (const path of attempts) {
    const response = await fetch(`${apiBase}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const payload = await response.json();
      return payload.playback;
    }

    try {
      const payload = await response.json();
      if (payload?.error) {
        lastError = payload.error;
      }
    } catch {
      // Ignore malformed error payloads.
    }
  }

  throw new Error(lastError);
}

function destroyHlsController() {
  if (!hlsController) return;

  try {
    hlsController.destroy();
  } catch {
    // Best-effort teardown.
  }

  hlsController = null;
}

function resetAudioElement() {
  if (!audioElement) return;

  audioElement.pause();
  audioElement.removeAttribute('src');
  audioElement.load();
  currentSourceUrl = '';
}

async function attachNativeSource(sourceUrl, requestId) {
  if (!audioElement || !isRequestActive(requestId)) {
    return false;
  }

  audioElement.src = sourceUrl;
  audioElement.load();
  await waitForCanPlay(audioElement, requestId);
  return true;
}

async function attachHlsSource(sourceUrl, requestId) {
  const Hls = getHlsConstructor();

  if (!audioElement || !Hls || !isRequestActive(requestId)) {
    throw new Error('This browser cannot play the current RAYD8 audio stream.');
  }

  if (!Hls.isSupported()) {
    throw new Error('This browser cannot play the current RAYD8 audio stream.');
  }

  destroyHlsController();

  await new Promise((resolve, reject) => {
    const controller = new Hls(HLS_CONFIG);
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      controller.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
      controller.off(Hls.Events.ERROR, handleError);

      if (error) {
        controller.destroy();
        reject(error);
        return;
      }

      hlsController = controller;
      resolve();
    };

    const handleManifestParsed = () => {
      if (!isRequestActive(requestId)) {
        finish(new Error('Audio request cancelled.'));
        return;
      }

      finish(null);
    };

    const handleError = (_event, data) => {
      if (!data?.fatal) return;
      finish(new Error('Unable to stream the selected audio track.'));
    };

    controller.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
    controller.on(Hls.Events.ERROR, handleError);
    controller.loadSource(sourceUrl);
    controller.attachMedia(audioElement);
  });

  await waitForCanPlay(audioElement, requestId);
  return true;
}

async function applyMediaSource(sourceUrl, requestId) {
  if (!audioElement || !isRequestActive(requestId)) {
    return false;
  }

  if (
    currentSourceUrl === sourceUrl &&
    (audioElement.currentSrc || hlsController || audioElement.src)
  ) {
    await waitForCanPlay(audioElement, requestId);
    return true;
  }

  if (audioElement.canPlayType('application/vnd.apple.mpegurl')) {
    const applied = await attachNativeSource(sourceUrl, requestId);
    if (applied) currentSourceUrl = sourceUrl;
    return applied;
  }

  const applied = await attachHlsSource(sourceUrl, requestId);
  if (applied) currentSourceUrl = sourceUrl;
  return applied;
}

async function tryPlay() {
  if (!audioElement || currentTrackId === 'none') {
    return false;
  }

  applyOutputSettings();

  try {
    await audioElement.play();
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return false;
    }

    throw error;
  }
}

async function startTrackPlayback(trackId) {
  const track = getAmritaAudioTrack(trackId);
  const requestId = loadRequestId + 1;
  loadRequestId = requestId;
  currentTrackId = track.id;

  if (!track.muxAssetId) {
    destroyHlsController();
    resetAudioElement();
    applyOutputSettings();
    return true;
  }

  const playback = await fetchMuxPlaybackToken(track);

  if (!isRequestActive(requestId) || currentTrackId !== track.id) {
    return false;
  }

  const applied = await applyMediaSource(playback.signed_url, requestId);

  if (!applied || !isRequestActive(requestId) || !audioElement) {
    return false;
  }

  audioElement.loop = true;
  audioElement.currentTime = 0;
  applyOutputSettings();
  return tryPlay();
}

export function createAmritaAudioLayer(container) {
  if (!getHlsConstructor()) {
    throw new Error('HLS playback library failed to load.');
  }

  audioElement = document.createElement('audio');
  audioElement.className = 'amrita-audio-layer';
  audioElement.preload = 'auto';
  audioElement.setAttribute('aria-hidden', 'true');
  audioElement.setAttribute('playsinline', 'true');
  container?.appendChild(audioElement);

  return {
    destroy() {
      loadRequestId += 1;
      destroyHlsController();
      resetAudioElement();
      audioElement?.remove();
      audioElement = null;
      currentTrackId = 'none';
    },
    getVolume() {
      return outputVolume;
    },
    isMuted() {
      return outputMuted;
    },
    pause() {
      audioElement?.pause();
    },
    async resume() {
      if (!audioElement || currentTrackId === 'none') return false;
      return tryPlay();
    },
    setMuted(muted) {
      outputMuted = Boolean(muted);
      applyOutputSettings();
    },
    setVolume(volume) {
      outputVolume = Math.max(0, Math.min(1, Number(volume) || 0));
      applyOutputSettings();
    },
    async setTrack(trackId) {
      const track = getAmritaAudioTrack(trackId);

      if (!track.available) {
        return true;
      }

      if (
        track.id === currentTrackId &&
        track.muxAssetId &&
        currentSourceUrl &&
        audioElement &&
        !audioElement.paused
      ) {
        return true;
      }

      if (
        track.id === currentTrackId &&
        track.muxAssetId &&
        currentSourceUrl &&
        audioElement
      ) {
        return tryPlay();
      }

      try {
        return await startTrackPlayback(track.id);
      } catch (error) {
        destroyHlsController();
        resetAudioElement();
        currentTrackId = 'none';
        throw error;
      }
    },
  };
}
