// ============================================================
// CONFIGURACIÓN DE EMISORAS
// ============================================================
const STATIONS = {
  ser: {
    id: 'ser',
    name: 'Cadena SER',
    shortName: 'SER',
    streamUrl: 'https://19983.live.streamtheworld.com/CADENASERAAC_SC',
    color: '#dc3545',
    colorHover: '#c82333',
    colorPlaying: '#28a745',
    icon: '📻',
    iconPlaying: '🔊'
  },
  cope: {
    id: 'cope',
    name: 'COPE',
    shortName: 'COPE',
    streamUrl: '',
    color: '#1a5276',
    colorHover: '#154360',
    colorPlaying: '#28a745',
    icon: '🎙️',
    iconPlaying: '🔊'
  }
};

// ============================================================
// ESTADO
// ============================================================
let audioCtx;
let source;
let delayNode;
let isPlaying = false;
let radioAudio = null;
let useWebAudioAPI = false;
let shadowRoot = null;
let mediaObserver = null;
let currentStation = null;

// ============================================================
// HELPERS
// ============================================================
const getStation = () => currentStation ? STATIONS[currentStation] : null;

const updateStatus = (text) => {
  if (!shadowRoot) return;
  const statusEl = shadowRoot.getElementById('radio-ser-status');
  if (statusEl) statusEl.textContent = text;
};

const updateFloatingButton = () => {
  const btn = shadowRoot?.getElementById('radio-ser-btn');
  if (!btn) return;
  const station = getStation();
  if (station) {
    btn.style.background = isPlaying
      ? `linear-gradient(135deg, ${station.colorPlaying}, ${station.color})`
      : `linear-gradient(135deg, ${station.color}, #ffd65a)`;
    btn.innerHTML = `<span class="radio-icon">${isPlaying ? station.iconPlaying : station.icon}</span> ${station.shortName}`;
    btn.title = isPlaying ? `${station.name} — Reproduciendo` : station.name;
    btn.classList.toggle('playing', isPlaying);
  } else {
    btn.style.background = 'linear-gradient(135deg, #ffd65a, #ff9a3c)';
    btn.innerHTML = '<span class="radio-icon">📻</span> Radio';
    btn.title = 'Abrir radio';
    btn.classList.remove('playing');
  }
};

const updateControlPanel = () => {
  if (!shadowRoot) return;
  const station = getStation();
  if (!station) return;
  const nameEl = shadowRoot.getElementById('station-name');
  if (nameEl) nameEl.textContent = station.name;
  updateFloatingButton();
};

// ============================================================
// AUDIO — GESTIÓN DEL GRAPO
// ============================================================
const destroyAudioGraph = () => {
  if (source) {
    try { source.disconnect(); } catch (e) { /* ignore */ }
    source = null;
  }
  if (delayNode) {
    try { delayNode.disconnect(); } catch (e) { /* ignore */ }
    delayNode = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  useWebAudioAPI = false;
};

const createRadioAudio = (stationId) => {
  destroyAudioGraph();

  if (radioAudio) {
    radioAudio.pause();
    radioAudio.removeAttribute('src');
    radioAudio.load();
  }

  const station = STATIONS[stationId];
  radioAudio = new Audio();
  radioAudio.crossOrigin = 'anonymous';

  radioAudio.addEventListener('error', () => {
    console.error(`[Radio ${station.shortName}] Error de audio:`, radioAudio.error?.message || 'desconocido');
    updateStatus('Error al cargar audio');
  });

  radioAudio.addEventListener('playing', () => {
    console.log(`[Radio ${station.shortName}] Audio reproduciéndose`);
    updateStatus('Reproduciendo...');
  });

  radioAudio.addEventListener('waiting', () => {
    console.log(`[Radio ${station.shortName}] Audio cargando...`);
    updateStatus('Cargando...');
  });

  radioAudio.addEventListener('stalled', () => {
    console.log(`[Radio ${station.shortName}] Audio estancado, reintentando...`);
    updateStatus('Reconectando...');
  });

  radioAudio.src = station.streamUrl;
  radioAudio.load();

  return radioAudio;
};

const resumeAudioContext = async () => {
  if (audioCtx && audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch (e) {
      console.warn('[Radio] Error al reanudar AudioContext:', e);
    }
  }
};

const setupAudioGraph = (retried = false) => {
  if (!audioCtx && radioAudio && radioAudio.src) {
    try {
      audioCtx = new AudioContext();
      audioCtx.addEventListener('statechange', () => {
        if (audioCtx.state === 'suspended' && isPlaying) {
          audioCtx.resume();
        }
      });
      source = audioCtx.createMediaElementSource(radioAudio);
      delayNode = audioCtx.createDelay(179);
      source.connect(delayNode);
      delayNode.connect(audioCtx.destination);
      useWebAudioAPI = true;
      console.log('[Radio] Web Audio API configurada correctamente');
    } catch (e) {
      console.error('[Radio] Error al configurar Web Audio API:', e);
      if (!retried) {
        setTimeout(() => setupAudioGraph(true), 2000);
      } else {
        updateStatus('Error al configurar delay');
      }
    }
  }
};

// ============================================================
// SILENCIADO AUTOMÁTICO DE PÁGINA
// ============================================================
const mutePageMedia = (mute = true) => {
  const mediaElements = document.querySelectorAll('audio, video');
  mediaElements.forEach((el) => {
    if (el === radioAudio) return;
    if (mute) {
      el.muted = true;
      el.dataset.wasMutedByRadio = 'true';
    } else if (el.dataset.wasMutedByRadio === 'true') {
      el.muted = false;
      delete el.dataset.wasMutedByRadio;
    }
  });

  if (mute && !mediaObserver) {
    mediaObserver = new MutationObserver(() => {
      document.querySelectorAll('audio, video').forEach((el) => {
        if (el === radioAudio) return;
        if (!el.dataset.wasMutedByRadio) {
          el.muted = true;
          el.dataset.wasMutedByRadio = 'true';
        }
      });
    });
    mediaObserver.observe(document.body, { childList: true, subtree: true });
  } else if (!mute && mediaObserver) {
    mediaObserver.disconnect();
    mediaObserver = null;
  }
};

// ============================================================
// CAMBIO DE EMISORA EN CALIENTE
// ============================================================
const switchStation = (newStationId) => {
  const wasPlaying = isPlaying;
  const delaySlider = shadowRoot?.getElementById('delay-slider');
  const delayVal = delaySlider ? parseFloat(delaySlider.value) : 0;

  // 1. Pausar audio actual
  if (radioAudio) radioAudio.pause();

  // 2-3. Limpiar nodos Web Audio API
  destroyAudioGraph();

  // 4. Crear nuevo Audio con el nuevo stream URL
  currentStation = newStationId;
  createRadioAudio(newStationId);

  // 5. Restaurar delay si estaba activo
  if (delayVal > 0) {
    setupAudioGraph();
    if (delayNode) delayNode.delayTime.value = delayVal;
  }

  // 6. Reanudar si estaba reproduciendo
  isPlaying = wasPlaying;
  const led = shadowRoot?.getElementById('radio-led');
  if (led) led.classList.toggle('active', wasPlaying);
  if (wasPlaying) {
    resumeAudioContext().then(() => {
      radioAudio.play().catch((e) => console.error('[Radio] Error al reanudar:', e));
    });
  }

  updateFloatingButton();
  updateControlPanel();
};

// ============================================================
// UI — CREACIÓN DE COMPONENTES
// ============================================================
const createFloatingButton = () => {
  const btn = document.createElement('button');
  btn.id = 'radio-ser-btn';
  btn.innerHTML = '<span class="radio-icon">📻</span> Radio';
  btn.title = 'Abrir radio';
  return btn;
};

const createSelectorPanel = () => {
  const panel = document.createElement('div');
  panel.id = 'radio-ser-selector';
  panel.innerHTML = `
    <div class="selector-title">Elige tu emisora</div>
    <div class="selector-buttons">
      <button class="station-btn" data-station="ser" style="--station-color: ${STATIONS.ser.color}; --station-hover: ${STATIONS.ser.colorHover};">
        <span class="station-icon">${STATIONS.ser.icon}</span>
        <span class="station-name">${STATIONS.ser.name}</span>
        <span class="station-short">${STATIONS.ser.shortName}</span>
      </button>
      <button class="station-btn" data-station="cope" style="--station-color: ${STATIONS.cope.color}; --station-hover: ${STATIONS.cope.colorHover};">
        <span class="station-icon">${STATIONS.cope.icon}</span>
        <span class="station-name">${STATIONS.cope.name}</span>
        <span class="station-short">${STATIONS.cope.shortName}</span>
      </button>
    </div>
  `;
  return panel;
};

const createControlPanel = () => {
  const panel = document.createElement('div');
  panel.id = 'radio-ser-panel';
  panel.innerHTML = `
    <div class="panel-header">
      <span class="live-badge">● EN VIVO</span>
      <span id="station-name">—</span>
    </div>
    <div class="panel-body">
      <label class="delay-label">
        Retraso: <strong id="delay-value">0</strong> segundos
      </label>
      <input type="range" id="delay-slider" min="0" max="179" value="0" step="0.1">
      <div class="status-row">
        <span class="led" id="radio-led"></span>
        <span id="radio-ser-status" class="status">Listo</span>
      </div>
      <div class="buttons">
        <button id="btn-play-pause" class="btn-play">▶ Reproducir</button>
        <button id="btn-change-station" class="btn-change">Cambiar</button>
        <button id="btn-close-radio" class="btn-close-panel">✕</button>
      </div>
    </div>
  `;
  return panel;
};

// ============================================================
// UI — FLUJO DE PANTALLAS
// ============================================================
const showFloatingButton = () => {
  const btn = shadowRoot?.getElementById('radio-ser-btn');
  const panel = shadowRoot?.getElementById('radio-ser-panel');
  const selector = shadowRoot?.getElementById('radio-ser-selector');
  if (btn) btn.style.display = 'flex';
  if (panel) panel.style.display = 'none';
  if (selector) selector.style.display = 'none';
  updateFloatingButton();
};

const showSelector = () => {
  const btn = shadowRoot?.getElementById('radio-ser-btn');
  const panel = shadowRoot?.getElementById('radio-ser-panel');
  const selector = shadowRoot?.getElementById('radio-ser-selector');
  if (btn) btn.style.display = 'none';
  if (panel) panel.style.display = 'none';
  if (selector) selector.style.display = 'block';
};

const showControlPanel = () => {
  const btn = shadowRoot?.getElementById('radio-ser-btn');
  const panel = shadowRoot?.getElementById('radio-ser-panel');
  const selector = shadowRoot?.getElementById('radio-ser-selector');
  if (btn) btn.style.display = 'none';
  if (panel) panel.style.display = 'block';
  if (selector) selector.style.display = 'none';
  updateControlPanel();
};

// ============================================================
// INICIALIZACIÓN
// ============================================================
const init = () => {
  const host = document.createElement('div');
  host.id = 'radio-ser-host';
  document.body.appendChild(host);
  shadowRoot = host.attachShadow({ mode: 'open' });

  // --- ESTILOS VINTAGE (cargados desde styles.css) ---
  const style = document.createElement('style');
  const cssUrl = chrome.runtime.getURL('styles.css');
  fetch(cssUrl)
    .then((r) => r.text())
    .then((css) => { style.textContent = css; })
    .catch(() => {
      style.textContent = 'body { font-family: Georgia, serif; }';
    });
  shadowRoot.appendChild(style);

  // --- ELEMENTOS ---
  const floatingBtn = createFloatingButton();
  const selectorPanel = createSelectorPanel();
  const controlPanel = createControlPanel();

  shadowRoot.appendChild(floatingBtn);
  shadowRoot.appendChild(selectorPanel);
  shadowRoot.appendChild(controlPanel);

  selectorPanel.style.display = 'none';
  controlPanel.style.display = 'none';

  // --- EVENTOS ---

  // Botón flotante
  floatingBtn.addEventListener('click', () => {
    if (currentStation) {
      showControlPanel();
    } else {
      showSelector();
    }
  });

  // Selector de emisoras
  selectorPanel.querySelectorAll('.station-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const stationId = btn.dataset.station;
      if (currentStation && currentStation !== stationId) {
        switchStation(stationId);
      } else {
        currentStation = stationId;
        createRadioAudio(stationId);
      }
      showControlPanel();
    });
  });

  // Slider de delay
  shadowRoot.getElementById('delay-slider').addEventListener('input', (e) => {
    const delayValue = parseFloat(e.target.value);
    shadowRoot.getElementById('delay-value').textContent = delayValue.toFixed(1);

    if (delayValue > 0 && !useWebAudioAPI && radioAudio && radioAudio.src) {
      setupAudioGraph();
    }

    if (delayNode) {
      delayNode.delayTime.value = delayValue;
    }
  });

  // Play / Pause
  shadowRoot.getElementById('btn-play-pause').addEventListener('click', async () => {
    const station = getStation();
    if (!station || !radioAudio) return;
    const playPauseBtn = shadowRoot.getElementById('btn-play-pause');

    try {
      await resumeAudioContext();

      if (radioAudio.paused) {
        updateStatus('Conectando...');
        mutePageMedia(true);
        await radioAudio.play();
        isPlaying = true;
        playPauseBtn.innerHTML = '⏸ Pausar';
        playPauseBtn.className = 'btn-play playing';
        shadowRoot.getElementById('radio-led')?.classList.add('active');
        updateFloatingButton();
      } else {
        radioAudio.pause();
        mutePageMedia(false);
        isPlaying = false;
        updateStatus('Pausado');
        playPauseBtn.innerHTML = '▶ Reproducir';
        playPauseBtn.className = 'btn-play';
        shadowRoot.getElementById('radio-led')?.classList.remove('active');
        updateFloatingButton();
      }
    } catch (err) {
      console.error('[Radio] Error al reproducir:', err);
      updateStatus('Error: ' + err.message);
    }
  });

  // Cambiar emisora
  shadowRoot.getElementById('btn-change-station').addEventListener('click', () => {
    if (isPlaying && radioAudio) {
      radioAudio.pause();
      mutePageMedia(false);
      isPlaying = false;
      shadowRoot.getElementById('radio-led')?.classList.remove('active');
      const playBtn = shadowRoot.getElementById('btn-play-pause');
      if (playBtn) {
        playBtn.innerHTML = '▶ Reproducir';
        playBtn.className = 'btn-play';
      }
    }
    showSelector();
  });

  // Cerrar (oculta panel, mantiene audio en segundo plano)
  shadowRoot.getElementById('btn-close-radio').addEventListener('click', () => {
    showFloatingButton();
    if (radioAudio && !radioAudio.paused) {
      updateFloatingButton();
    }
  });
};

// --- ARRANQUE ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
