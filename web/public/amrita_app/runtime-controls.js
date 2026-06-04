const AMPLIFICATION_LEVELS = [
  { id: 'off', label: 'Off' },
  { id: '5x', label: '5x' },
  { id: '10x', label: '10x' },
  { id: '20x', label: '20x' },
];

const CHROME_IDLE_MS = 2400;

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
          <button class="runtime-button" type="button" data-runtime-action="fullscreen">Fullscreen</button>
          <button class="runtime-button secondary" type="button" data-runtime-action="exit">Exit</button>
        </div>
      </div>
      <div class="runtime-chrome-bottom">
        <button class="runtime-button" type="button" data-runtime-action="pause">Pause</button>
        <button class="runtime-button" type="button" data-runtime-panel="speed">Speed</button>
        <button class="runtime-button" type="button" data-runtime-panel="filters">Filters</button>
        <button class="runtime-button" type="button" data-runtime-panel="duration">Duration</button>
        <button class="runtime-button" type="button" data-runtime-panel="amplification">Amplify</button>
        <button class="runtime-button" type="button" data-runtime-panel="audio">Audio</button>
        <button class="runtime-button" type="button" data-runtime-panel="photo">Photo</button>
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
    root.querySelector('[data-runtime-action="pause"]').textContent =
      state.runtime === 'paused' ? 'Resume' : 'Pause';
    root.querySelector('[data-runtime-action="fullscreen"]').textContent =
      state.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
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
