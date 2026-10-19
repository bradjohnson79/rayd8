const AMPLIFICATION_LEVELS = [
  { id: 'off', label: 'Off' },
  { id: '5x', label: '5x' },
  { id: '10x', label: '10x' },
  { id: '20x', label: '20x' },
];

const CHROME_IDLE_MS = 2400;

const GLYPHS = {
  amplify: '<path d="M4 10v4h3l4 3V7L7 10H4"/><path d="M15 9.5a3.2 3.2 0 0 1 0 5M17.2 7.2a6 6 0 0 1 0 9.6"/>',
  audio: '<path d="M9 17V7l9-2v10"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="15" r="2"/>',
  duration: '<circle cx="12" cy="12" r="7"/><path d="M12 8.5V12l2.5 2"/>',
  exit: '<path d="M7 7l10 10M17 7L7 17"/>',
  'exit-fullscreen': '<path d="M4 8h4V4M16 4v4h4M20 16h-4v4M8 20v-4H4"/>',
  filters: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="10" cy="17" r="1.6" fill="currentColor" stroke="none"/>',
  fullscreen: '<path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"/>',
  pause: '<path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" stroke="none"/>',
  photo: '<path d="M5 8h3l1.5-2h5L16 8h3v9H5z"/><circle cx="12" cy="12.5" r="2.4"/>',
  speed: '<path d="M5 16a7 7 0 1 1 14 0"/><path d="M12 16l4-4"/>',
  start: '<path d="M8 6.5v11l9.5-5.5z" fill="currentColor" stroke="none"/>',
};

function glyph(name) {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name] ?? ''}</svg>`;
}

function chromeButton({ action, icon, label, panel, secondary = false }) {
  const actionAttr = action ? ` data-runtime-action="${action}"` : '';
  const panelAttr = panel ? ` data-runtime-panel="${panel}"` : '';
  const secondaryClass = secondary ? ' secondary' : '';
  return `<button class="runtime-button${secondaryClass}" type="button" aria-label="${label}"${actionAttr}${panelAttr}>${glyph(icon)}</button>`;
}

function setIconButton(button, label, icon) {
  if (!button) return;
  button.setAttribute('aria-label', label);
  button.innerHTML = glyph(icon);
}

export function createRuntimeControls({
  actions,
  audioTracks,
  container,
  durations,
  filters,
  getState,
  personalResonance,
}) {
  let root = null;
  let statusElement = null;
  let panelElement = null;
  let confirmElement = null;
  let activePanel = null;
  let hideTimerId = null;
  let activityFrameId = null;
  const cleanupCallbacks = [];

  function mount() {
    if (!container || root) return;

    root = document.createElement('div');
    root.className = 'runtime-chrome';
    root.innerHTML = `
      <div class="runtime-chrome-top">
        <div>
          <p class="eyebrow">AMRITA Runtime</p>
          <p class="runtime-status" data-runtime-status>Preparing sequence</p>
        </div>
        <div class="runtime-chrome-actions">
          ${chromeButton({ action: 'fullscreen', icon: 'fullscreen', label: 'Fullscreen' })}
          ${chromeButton({ action: 'exit', icon: 'exit', label: 'Exit', secondary: true })}
        </div>
      </div>
      <div class="runtime-chrome-bottom">
        ${chromeButton({ action: 'pause', icon: 'pause', label: 'Pause' })}
        ${chromeButton({ icon: 'speed', label: 'Speed', panel: 'speed' })}
        ${chromeButton({ icon: 'filters', label: 'Filters', panel: 'filters' })}
        ${chromeButton({ icon: 'duration', label: 'Duration', panel: 'duration' })}
        ${chromeButton({ icon: 'amplify', label: 'Amplify', panel: 'amplification' })}
        ${chromeButton({ icon: 'audio', label: 'Audio', panel: 'audio' })}
        ${chromeButton({ icon: 'photo', label: 'Photo', panel: 'photo' })}
      </div>
    `;
    container.appendChild(root);
    statusElement = root.querySelector('[data-runtime-status]');

    root.addEventListener('click', handleChromeClick);
    addActivityListener(root, 'pointermove');
    addActivityListener(root, 'pointerdown');
    addActivityListener(window, 'keydown');
    addActivityListener(window, 'touchstart');
    pingChrome();
    update();
  }

  function unmount() {
    closePanel();
    closeConfirm();
    if (hideTimerId !== null) window.clearTimeout(hideTimerId);
    if (activityFrameId !== null) window.cancelAnimationFrame(activityFrameId);
    cleanupCallbacks.splice(0).forEach((cleanup) => cleanup());
    root?.removeEventListener('click', handleChromeClick);
    root?.remove();
    root = null;
    statusElement = null;
  }

  function update() {
    if (!root) return;
    const state = getState();
    const paused = state.runtime === 'paused';
    setIconButton(root.querySelector('[data-runtime-action="pause"]'), paused ? 'Resume' : 'Pause', paused ? 'start' : 'pause');
    setIconButton(
      root.querySelector('[data-runtime-action="fullscreen"]'),
      state.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen',
      state.isFullscreen ? 'exit-fullscreen' : 'fullscreen',
    );
    root.dataset.amplification = state.amplification;

    root.querySelectorAll('[data-runtime-panel]').forEach((button) => {
      button.classList.toggle('active', button.dataset.runtimePanel === activePanel);
    });

    if (activePanel && activePanel !== 'photo') renderPanel(activePanel);
  }

  function setStatus(text) {
    if (statusElement) statusElement.textContent = text;
  }

  function handleChromeClick(event) {
    const actionButton = event.target.closest('[data-runtime-action]');
    const panelButton = event.target.closest('[data-runtime-panel]');

    if (actionButton) {
      pingChrome();
      const action = actionButton.dataset.runtimeAction;
      if (action === 'pause') actions.togglePause();
      if (action === 'fullscreen') void actions.toggleFullscreen();
      if (action === 'exit') showExitConfirm();
      update();
      return;
    }

    if (panelButton) {
      pingChrome();
      const nextPanel = panelButton.dataset.runtimePanel;
      if (activePanel === nextPanel) closePanel();
      else openPanel(nextPanel);
    }
  }

  function openPanel(panelName) {
    activePanel = panelName;
    renderPanel(panelName);
    update();
    pingChrome();
  }

  function closePanel() {
    activePanel = null;
    panelElement?.remove();
    panelElement = null;
    update();
  }

  function renderPanel(panelName) {
    if (!root) return;
    if (!panelElement) {
      panelElement = document.createElement('div');
      panelElement.className = 'runtime-popover';
      root.appendChild(panelElement);
    }

    const state = getState();
    if (panelName === 'speed') renderSpeedPanel(panelElement, state);
    if (panelName === 'filters') renderFiltersPanel(panelElement, state);
    if (panelName === 'duration') renderDurationPanel(panelElement, state);
    if (panelName === 'amplification') renderAmplificationPanel(panelElement, state);
    if (panelName === 'audio') renderAudioPanel(panelElement, state);
    if (panelName === 'photo') renderPhotoPanel(panelElement);
  }

  function renderSpeedPanel(panel, state) {
    panel.innerHTML = `<p class="runtime-popover-title">Rate of Charge</p><div class="runtime-option-grid speed-grid"></div>`;
    const grid = panel.querySelector('.runtime-option-grid');
    for (let speed = 1; speed <= 10; speed += 1) {
      const button = createOptionButton({
        active: Math.round(state.targetSpeed) === speed,
        label: String(speed),
        onClick: () => {
          actions.setTargetSpeed(speed);
          update();
        },
      });
      grid.appendChild(button);
    }
  }

  function renderFiltersPanel(panel, state) {
    panel.innerHTML = `<p class="runtime-popover-title">Filters</p><div class="runtime-option-grid"></div>`;
    const grid = panel.querySelector('.runtime-option-grid');
    Object.entries(filters).forEach(([key, filter]) => {
      grid.appendChild(createOptionButton({
        active: state.filters.has(key),
        label: filter.label.replace(' Filter', ''),
        onClick: () => {
          actions.toggleFilter(key);
          update();
        },
      }));
    });
  }

  function renderDurationPanel(panel, state) {
    panel.innerHTML = `<p class="runtime-popover-title">Session Duration</p><div class="runtime-option-grid"></div>`;
    const grid = panel.querySelector('.runtime-option-grid');
    Object.entries(durations).forEach(([key, duration]) => {
      grid.appendChild(createOptionButton({
        active: state.duration === key,
        label: duration.label,
        onClick: () => {
          if (actions.durationNeedsConfirmation(key)) {
            showConfirm({
              confirmLabel: 'Shorten Session',
              description: 'This will shorten the active AMRITA session timer.',
              onConfirm: () => actions.setDuration(key),
              title: 'Shorten session?',
            });
            return;
          }
          actions.setDuration(key);
          update();
        },
      }));
    });
  }

  function renderAmplificationPanel(panel, state) {
    panel.innerHTML = `<p class="runtime-popover-title">Amplification</p><div class="runtime-option-grid"></div>`;
    const grid = panel.querySelector('.runtime-option-grid');
    AMPLIFICATION_LEVELS.forEach((level) => {
      grid.appendChild(createOptionButton({
        active: state.amplification === level.id,
        label: level.label,
        onClick: () => {
          actions.setAmplification(level.id);
          update();
        },
      }));
    });
  }

  function renderAudioPanel(panel, state) {
    const hasAudioLayer = state.audioTrack !== 'none';
    const isSilent = !hasAudioLayer || state.audioMuted;
    const volumePercent = Math.round(state.audioVolume * 100);
    const volumeMeta = !hasAudioLayer
      ? 'Choose Expansion or Premium to adjust volume.'
      : isSilent
        ? 'Muted'
        : `${volumePercent}%`;

    panel.innerHTML = `
      <p class="runtime-popover-title">Audio</p>
      <div class="runtime-option-list"></div>
      <div class="runtime-audio-volume">
        <div class="runtime-audio-volume-heading">
          <span class="runtime-audio-volume-label">Volume</span>
          <span class="runtime-audio-volume-meta">${volumeMeta}</span>
        </div>
        <div class="runtime-audio-volume-controls">
          ${state.audioUnlockRequired && hasAudioLayer
            ? '<button class="runtime-button" type="button" data-runtime-audio-start>Start Audio</button>'
            : ''}
          <button
            class="runtime-button secondary"
            type="button"
            data-runtime-audio-mute
            ${hasAudioLayer ? '' : 'disabled'}
          >
            ${isSilent ? 'Unmute' : 'Mute'}
          </button>
          <label class="runtime-audio-volume-slider">
            <span class="sr-only">Audio volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value="${state.audioVolume}"
              data-runtime-audio-volume
              ${hasAudioLayer ? '' : 'disabled'}
            />
          </label>
        </div>
      </div>
    `;

    const list = panel.querySelector('.runtime-option-list');
    audioTracks.forEach((track) => {
      const button = createOptionButton({
        active: state.audioTrack === track.id,
        disabled: !track.available,
        label: track.label,
        meta: track.available ? track.description : 'Coming Soon',
        onClick: () => {
          if (!track.available) return;
          actions.setAudioTrack(track.id);
          update();
        },
      });
      list.appendChild(button);
    });

    panel.querySelector('[data-runtime-audio-mute]')?.addEventListener('click', () => {
      if (!hasAudioLayer) return;
      actions.toggleAudioMute();
      update();
    });

    panel.querySelector('[data-runtime-audio-start]')?.addEventListener('click', () => {
      actions.resumeAudio();
      update();
    });

    panel.querySelector('[data-runtime-audio-volume]')?.addEventListener('input', (event) => {
      if (!hasAudioLayer) return;
      const nextVolume = Number(event.target.value);
      actions.setAudioVolume(nextVolume);
      panel.querySelector('.runtime-audio-volume-meta').textContent =
        nextVolume === 0 ? 'Muted' : `${Math.round(nextVolume * 100)}%`;
      const muteButton = panel.querySelector('[data-runtime-audio-mute]');
      if (muteButton && nextVolume > 0) {
        muteButton.textContent = 'Mute';
      }
    });

    panel.querySelector('[data-runtime-audio-volume]')?.addEventListener('change', () => {
      update();
    });
  }

  function renderPhotoPanel(panel) {
    if (!personalResonance) return;
    personalResonance.renderPanel(panel);
  }

  function createOptionButton({ active, disabled = false, label, meta = '', onClick }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `runtime-option${active ? ' active' : ''}`;
    button.disabled = disabled;
    button.innerHTML = `<strong>${label}</strong>${meta ? `<span>${meta}</span>` : ''}`;
    button.addEventListener('click', () => {
      pingChrome();
      onClick();
    });
    return button;
  }

  function showExitConfirm() {
    showConfirm({
      confirmLabel: 'Exit AMRITA',
      description: 'Your AMRITA rejuvenation session will end and return to the control panel.',
      onConfirm: actions.exitSession,
      title: 'Exit Session?',
    });
  }

  function showConfirm({ confirmLabel, description, onConfirm, title }) {
    closeConfirm();
    confirmElement = document.createElement('div');
    confirmElement.className = 'runtime-confirm';
    confirmElement.setAttribute('role', 'dialog');
    confirmElement.setAttribute('aria-modal', 'true');
    confirmElement.innerHTML = `
      <div class="runtime-confirm-card">
        <p class="eyebrow">AMRITA</p>
        <h2>${title}</h2>
        <p>${description}</p>
        <div class="runtime-confirm-actions">
          <button class="runtime-button" type="button" data-confirm-cancel>Continue Session</button>
          <button class="runtime-button secondary" type="button" data-confirm-ok>${confirmLabel}</button>
        </div>
      </div>
    `;
    root.appendChild(confirmElement);
    confirmElement.querySelector('[data-confirm-cancel]').addEventListener('click', closeConfirm);
    confirmElement.querySelector('[data-confirm-ok]').addEventListener('click', () => {
      closeConfirm();
      onConfirm();
      update();
    });
    pingChrome();
  }

  function closeConfirm() {
    confirmElement?.remove();
    confirmElement = null;
  }

  function pingChrome() {
    if (!root) return;
    root.classList.remove('is-hidden');
    if (hideTimerId !== null) window.clearTimeout(hideTimerId);
    hideTimerId = window.setTimeout(() => {
      if (!activePanel && !confirmElement && getState().runtime === 'running') {
        root?.classList.add('is-hidden');
      }
    }, CHROME_IDLE_MS);
  }

  function scheduleActivityPing() {
    if (activityFrameId !== null) return;
    activityFrameId = window.requestAnimationFrame(() => {
      activityFrameId = null;
      pingChrome();
    });
  }

  function addActivityListener(target, eventName) {
    target.addEventListener(eventName, scheduleActivityPing, { passive: true });
    cleanupCallbacks.push(() => target.removeEventListener(eventName, scheduleActivityPing));
  }

  return {
    closePanel,
    mount,
    setStatus,
    unmount,
    update,
  };
}
