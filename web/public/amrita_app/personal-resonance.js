import { readJsonStorage, removeStorageValue, writeJsonStorage } from './storage.js';

export const AMRITA_PERSONAL_RESONANCE_STORAGE_KEY = 'amrita_personal_resonance';

const PERSONAL_RESONANCE_VERSION = 1;
const TARGET_IMAGE_BYTES = 500 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FADE_IN_DELAY_MS = 0;

let fadeTimerId = null;
let fadeDelayRemainingMs = FADE_IN_DELAY_MS;
let fadeDelayStartedAt = 0;
let activeOverlay = null;

export function loadPersonalResonance() {
  return readJsonStorage(
    AMRITA_PERSONAL_RESONANCE_STORAGE_KEY,
    createEmptyPersonalResonance(),
    isValidPersonalResonance,
  );
}

export function savePersonalResonance(nextValue) {
  const value = {
    version: PERSONAL_RESONANCE_VERSION,
    enabled: Boolean(nextValue.enabled),
    image: typeof nextValue.image === 'string' ? nextValue.image : '',
    updatedAt: Date.now(),
  };

  writeJsonStorage(AMRITA_PERSONAL_RESONANCE_STORAGE_KEY, value);
  return value;
}

export function clearPersonalResonance() {
  removeStorageValue(AMRITA_PERSONAL_RESONANCE_STORAGE_KEY);
  return createEmptyPersonalResonance();
}

export function bindPersonalResonanceControls(dom, handlers) {
  dom.personalResonanceInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;

    try {
      const image = await compressPersonalResonanceImage(file);
      handlers.onChange(savePersonalResonance({
        ...handlers.getValue(),
        enabled: true,
        image,
      }));
      handlers.onNotice('Photo saved on this device for future AMRITA sessions.');
    } catch (error) {
      handlers.onNotice(error instanceof Error ? error.message : 'Unable to use that image.');
    }
  });

  dom.personalResonanceToggle?.addEventListener('change', (event) => {
    handlers.onChange(savePersonalResonance({
      ...handlers.getValue(),
      enabled: event.target.checked,
    }));
  });

  dom.personalResonanceRemove?.addEventListener('click', () => {
    handlers.onChange(clearPersonalResonance());
    handlers.onNotice('Personal Resonance photo removed.');
  });
}

export function syncPersonalResonanceControls(dom, resonance) {
  if (dom.personalResonanceToggle) {
    dom.personalResonanceToggle.checked = Boolean(resonance.enabled);
    dom.personalResonanceToggle.disabled = !resonance.image;
  }

  if (dom.personalResonanceRemove) {
    dom.personalResonanceRemove.disabled = !resonance.image;
  }

  if (dom.personalResonancePreview) {
    dom.personalResonancePreview.hidden = !resonance.image;
    if (resonance.image) {
      dom.personalResonancePreview.src = resonance.image;
    } else {
      dom.personalResonancePreview.removeAttribute('src');
    }
  }

  if (dom.personalResonanceStatus) {
    dom.personalResonanceStatus.textContent = getPersonalResonanceStatusText(resonance);
  }
}

export function renderPersonalResonanceRuntimePanel(panel, resonance, handlers) {
  panel.innerHTML = `
    <p class="runtime-popover-title">Personal Resonance</p>
    <p class="runtime-resonance-status">${getPersonalResonanceStatusText(resonance)}</p>
    <div class="runtime-resonance-preview-wrap" hidden>
      <img class="runtime-resonance-preview" alt="" decoding="async" />
    </div>
    <div class="runtime-resonance-actions">
      <label class="runtime-button file-pill" for="runtime-personal-resonance-input">
        <span data-runtime-resonance-upload-label>${resonance.image ? 'Replace Photo' : 'Upload Photo'}</span>
        <input id="runtime-personal-resonance-input" accept="image/jpeg,image/png,image/webp" type="file" />
      </label>
      <label class="runtime-resonance-toggle">
        <input type="checkbox" data-runtime-resonance-toggle />
        <span>Show in session</span>
      </label>
      <button class="runtime-button secondary" type="button" data-runtime-resonance-remove ${resonance.image ? '' : 'disabled'}>Remove</button>
    </div>
  `;

  const previewWrap = panel.querySelector('.runtime-resonance-preview-wrap');
  const preview = panel.querySelector('.runtime-resonance-preview');
  const status = panel.querySelector('.runtime-resonance-status');
  const uploadInput = panel.querySelector('#runtime-personal-resonance-input');
  const toggle = panel.querySelector('[data-runtime-resonance-toggle]');
  const removeButton = panel.querySelector('[data-runtime-resonance-remove]');
  const uploadLabel = panel.querySelector('[data-runtime-resonance-upload-label]');

  syncPersonalResonanceRuntimePanel({
    preview,
    previewWrap,
    removeButton,
    status,
    toggle,
    uploadLabel,
  }, resonance);

  uploadInput?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;

    try {
      const image = await compressPersonalResonanceImage(file);
      handlers.onChange(savePersonalResonance({
        ...handlers.getValue(),
        enabled: true,
        image,
      }));
      handlers.onNotice('Photo saved for future AMRITA sessions.');
    } catch (error) {
      handlers.onNotice(error instanceof Error ? error.message : 'Unable to use that image.');
    }
  });

  toggle?.addEventListener('change', (event) => {
    handlers.onChange(savePersonalResonance({
      ...handlers.getValue(),
      enabled: event.target.checked,
    }));
  });

  removeButton?.addEventListener('click', () => {
    handlers.onChange(clearPersonalResonance());
    handlers.onNotice('Personal Resonance photo removed.');
  });
}

export function syncPersonalResonanceRuntimePanel(elements, resonance) {
  if (elements.toggle) {
    elements.toggle.checked = Boolean(resonance.enabled);
    elements.toggle.disabled = !resonance.image;
  }

  if (elements.removeButton) {
    elements.removeButton.disabled = !resonance.image;
  }

  if (elements.uploadLabel) {
    elements.uploadLabel.textContent = resonance.image ? 'Replace Photo' : 'Upload Photo';
  }

  if (elements.preview && elements.previewWrap) {
    elements.previewWrap.hidden = !resonance.image;
    if (resonance.image) {
      elements.preview.src = resonance.image;
    } else {
      elements.preview.removeAttribute('src');
    }
  }

  if (elements.status) {
    elements.status.textContent = getPersonalResonanceStatusText(resonance);
  }
}

function getPersonalResonanceStatusText(resonance) {
  if (!resonance.image) {
    return 'No photo saved yet. Upload one to keep it on this device for future sessions.';
  }

  return resonance.enabled
    ? 'Saved photo is active in this rejuvenation session.'
    : 'Photo saved on this device. Enable it when you want to use it.';
}

export function mountPersonalResonanceOverlay({ container, paused, resonance }) {
  if (!container || !resonance.enabled || !resonance.image) {
    unmountPersonalResonanceOverlay();
    setPersonalResonancePaused(paused);
    return;
  }

  if (activeOverlay) {
    const image = activeOverlay.querySelector('img');
    if (image && image.src !== resonance.image) {
      image.src = resonance.image;
    }
    activeOverlay.classList.add('visible');
    setPersonalResonancePaused(paused);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'personal-resonance-runtime';
  wrapper.setAttribute('aria-hidden', 'true');

  const image = document.createElement('img');
  image.alt = '';
  image.decoding = 'async';
  image.src = resonance.image;
  wrapper.appendChild(image);
  container.appendChild(wrapper);
  activeOverlay = wrapper;

  fadeDelayRemainingMs = FADE_IN_DELAY_MS;
  setPersonalResonancePaused(paused);
}

export function unmountPersonalResonanceOverlay() {
  if (fadeTimerId !== null) {
    window.clearTimeout(fadeTimerId);
    fadeTimerId = null;
  }
  fadeDelayRemainingMs = FADE_IN_DELAY_MS;
  fadeDelayStartedAt = 0;

  if (!activeOverlay) return;

  const overlay = activeOverlay;
  overlay.classList.remove('visible');
  activeOverlay = null;

  window.setTimeout(() => {
    overlay.remove();
  }, 320);
}

export function setPersonalResonancePaused(paused) {
  activeOverlay?.classList.toggle('paused', Boolean(paused));
  if (!activeOverlay || activeOverlay.classList.contains('visible')) return;

  if (paused && fadeTimerId !== null) {
    window.clearTimeout(fadeTimerId);
    fadeTimerId = null;
    fadeDelayRemainingMs = Math.max(0, fadeDelayRemainingMs - (performance.now() - fadeDelayStartedAt));
    return;
  }

  if (!paused && fadeTimerId === null) scheduleFadeIn();
}

function createEmptyPersonalResonance() {
  return {
    version: PERSONAL_RESONANCE_VERSION,
    enabled: false,
    image: '',
    updatedAt: 0,
  };
}

function isValidPersonalResonance(value) {
  return Boolean(
    value &&
      value.version === PERSONAL_RESONANCE_VERSION &&
      typeof value.enabled === 'boolean' &&
      typeof value.image === 'string' &&
      typeof value.updatedAt === 'number',
  );
}

async function compressPersonalResonanceImage(file) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Please choose a JPG, PNG, or WEBP image.');
  }

  const image = await loadImage(file);
  const { width, height } = fitImageSize(image.width, image.height, 1400);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('This browser could not prepare the image.');
  }

  context.drawImage(image, 0, 0, width, height);

  for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
    const output = canvas.toDataURL('image/jpeg', quality);
    if (estimateDataUrlBytes(output) <= TARGET_IMAGE_BYTES || quality === 0.42) {
      return output;
    }
  }

  throw new Error('Unable to compress that image.');
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read that image.'));
    };
    image.src = url;
  });
}

function fitImageSize(width, height, maxSize) {
  const ratio = Math.min(1, maxSize / Math.max(width, height));
  return {
    height: Math.max(1, Math.round(height * ratio)),
    width: Math.max(1, Math.round(width * ratio)),
  };
}

function estimateDataUrlBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function scheduleFadeIn() {
  fadeDelayStartedAt = performance.now();
  fadeTimerId = window.setTimeout(() => {
    fadeTimerId = null;
    activeOverlay?.classList.add('visible');
  }, fadeDelayRemainingMs);
}
