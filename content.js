// Estado de la extensión
let audioCtx;
let source;
let delayNode;
let isRadioActive = false;
let radioAudio = null;
let useWebAudioAPI = false;
let shadowRoot = null;

const STREAM_URL = 'https://19983.live.streamtheworld.com/CADENASERAAC_SC';

// Crear el elemento de audio bajo demanda
const createRadioAudio = () => {
  if (radioAudio) {
    radioAudio.pause();
    radioAudio.removeAttribute('src');
    radioAudio.load();
    // Si había un source conectado, desconectar
    if (source) {
      try { source.disconnect(); } catch(e) {}
      source = null;
    }
    if (delayNode) {
      try { delayNode.disconnect(); } catch(e) {}
      delayNode = null;
    }
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
    }
    useWebAudioAPI = false;
  }
  
  radioAudio = new Audio();
  
  // Eventos de error para debug
  radioAudio.addEventListener('error', (e) => {
    console.error('[Radio SER] Error de audio:', radioAudio.error?.message || e);
    updateStatus('Error al cargar audio');
  });
  
  radioAudio.addEventListener('playing', () => {
    console.log('[Radio SER] Audio reproduciéndose');
    updateStatus('Reproduciendo...');
  });
  
  radioAudio.addEventListener('waiting', () => {
    console.log('[Radio SER] Audio cargando...');
    updateStatus('Cargando...');
  });
  
  radioAudio.addEventListener('stalled', () => {
    console.log('[Radio SER] Audio estancado, reintentando...');
    updateStatus('Reconectando...');
  });
  
  radioAudio.src = STREAM_URL;
  radioAudio.load();
  
  return radioAudio;
};

// Actualizar estado en la UI
const updateStatus = (text) => {
  if (!shadowRoot) return;
  const statusEl = shadowRoot.getElementById('radio-ser-status');
  if (statusEl) {
    statusEl.textContent = text;
  }
};

// Crear botón flotante principal
const createFloatingButton = () => {
  const btn = document.createElement('button');
  btn.id = 'radio-ser-btn';
  btn.innerHTML = `<span class="radio-icon">📻</span> SER`;
  btn.title = 'Activar Radio Cadena SER';
  return btn;
};

// Crear panel de control con slider de delay
const createControlPanel = () => {
  const panel = document.createElement('div');
  panel.id = 'radio-ser-panel';
  panel.innerHTML = `
    <div class="panel-header">
      <span class="live-badge">● EN VIVO</span>
      <span>Cadena SER</span>
    </div>
    <div class="panel-body">
      <label class="delay-label">
        Retraso: <strong id="delay-value">0</strong> segundos
      </label>
      <input type="range" id="delay-slider" min="0" max="179" value="0" step="0.1">
      <small class="hint">Ajusta el retraso para sincronizar con el vídeo</small>
      <div id="radio-ser-status" class="status">Listo</div>
      <div class="buttons">
        <button id="btn-play-pause" class="btn-play">▶ Reproducir</button>
        <button id="btn-close-radio" class="btn-close-panel">✕</button>
      </div>
    </div>
  `;
  return panel;
};

// Silenciar todos los elementos de audio/vídeo de la página
let mediaObserver = null;

const mutePageMedia = (mute = true) => {
  const mediaElements = document.querySelectorAll('audio, video');
  mediaElements.forEach(element => {
    if (element === radioAudio) return; // No mutear nuestra propia radio
    if (mute) {
      element.muted = true;
      element.dataset.wasMutedBySER = 'true';
    } else if (element.dataset.wasMutedBySER === 'true') {
      element.muted = false;
      delete element.dataset.wasMutedBySER;
    }
  });
  
  // Observar nuevos elementos multimedia que se añadan (ej: Twitch crea videos dinámicamente)
  if (mute && !mediaObserver) {
    mediaObserver = new MutationObserver(() => {
      document.querySelectorAll('audio, video').forEach(el => {
        if (el === radioAudio) return;
        if (!el.dataset.wasMutedBySER) {
          el.muted = true;
          el.dataset.wasMutedBySER = 'true';
        }
      });
    });
    mediaObserver.observe(document.body, { childList: true, subtree: true });
  } else if (!mute && mediaObserver) {
    mediaObserver.disconnect();
    mediaObserver = null;
  }
};

// Configurar el grafo de audio Web Audio API (solo cuando se necesita delay)
const setupAudioGraph = () => {
  if (!audioCtx && radioAudio) {
    try {
      // Para usar Web Audio API necesitamos CORS
      radioAudio.crossOrigin = 'anonymous';
      // Recargar con CORS habilitado
      const currentTime = radioAudio.currentTime;
      const wasPlaying = !radioAudio.paused;
      radioAudio.src = STREAM_URL;
      radioAudio.load();
      
      audioCtx = new AudioContext();
      source = audioCtx.createMediaElementSource(radioAudio);
      delayNode = audioCtx.createDelay(179); // Máximo ~3 minutos de buffer
      
      // Conexión: Radio -> Retraso -> Altavoces
      source.connect(delayNode);
      delayNode.connect(audioCtx.destination);
      useWebAudioAPI = true;
      
      if (wasPlaying) {
        radioAudio.play().catch(e => console.error('[Radio SER] Error al reproducir tras setup:', e));
      }
      
      console.log('[Radio SER] Web Audio API configurada correctamente');
    } catch (e) {
      console.error('[Radio SER] Error al configurar Web Audio API:', e);
      updateStatus('Error al configurar delay');
    }
  }
};

// Inicializar la extensión
const init = () => {
  // Crear contenedor Shadow DOM (aislado del CSS de la página)
  const host = document.createElement('div');
  host.id = 'radio-ser-host';
  document.body.appendChild(host);
  shadowRoot = host.attachShadow({ mode: 'open' });
  
  // Estilos encapsulados dentro del Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    #radio-ser-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border: none;
      border-radius: 50px;
      background: #dc3545;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    }
    #radio-ser-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(220,53,69,0.4);
      background: #c82333;
    }
    #radio-ser-btn.playing {
      background: #28a745;
      box-shadow: 0 4px 12px rgba(40,167,69,0.4);
    }
    #radio-ser-btn.playing:hover {
      background: #218838;
      box-shadow: 0 6px 20px rgba(40,167,69,0.5);
    }
    .radio-icon { font-size: 18px; }

    #radio-ser-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      width: 300px;
      max-width: calc(100vw - 40px);
      background: #1a1a2e;
      color: #eee;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
      overflow: hidden;
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #16213e;
      font-weight: 600;
    }
    .live-badge {
      color: #ff4444;
      font-size: 12px;
      animation: pulse 2s ease-in-out infinite;
    }

    .panel-body {
      padding: 14px 16px;
    }
    .delay-label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      color: #ccc;
    }
    .delay-label strong { color: #fff; }

    input[type="range"] {
      width: 100%;
      height: 6px;
      -webkit-appearance: none;
      appearance: none;
      background: #333;
      border-radius: 3px;
      outline: none;
      margin: 8px 0;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      background: #dc3545;
      border-radius: 50%;
      cursor: pointer;
    }

    .hint { display: block; color: #888; font-size: 11px; margin-bottom: 8px; }
    .status { color: #aaa; font-size: 12px; margin-bottom: 10px; }

    .buttons {
      display: flex;
      gap: 8px;
    }
    .btn-play {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 8px;
      background: #28a745;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-play:hover { background: #218838; }
    .btn-play.playing {
      background: #ffc107;
      color: #333;
    }
    .btn-play.playing:hover { background: #e0a800; }

    .btn-close-panel {
      padding: 10px 14px;
      border: 1px solid #555;
      border-radius: 8px;
      background: transparent;
      color: #ccc;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-close-panel:hover {
      background: #dc3545;
      border-color: #dc3545;
      color: white;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  shadowRoot.appendChild(style);
  
  const floatingBtn = createFloatingButton();
  const controlPanel = createControlPanel();
  controlPanel.style.display = 'none';
  shadowRoot.appendChild(floatingBtn);
  shadowRoot.appendChild(controlPanel);
  
  // Evento del botón flotante
  floatingBtn.addEventListener('click', () => {
    isRadioActive = true;
    controlPanel.style.display = 'block';
    floatingBtn.style.display = 'none';
  });
  
  // Evento del slider de delay
  shadowRoot.getElementById('delay-slider').addEventListener('input', (e) => {
    const delayValue = parseFloat(e.target.value);
    shadowRoot.getElementById('delay-value').textContent = delayValue.toFixed(1);
    
    // Si el usuario ajusta delay > 0 y aún no hay Web Audio API, configurarla
    if (delayValue > 0 && !useWebAudioAPI) {
      setupAudioGraph();
    }
    
    if (delayNode) {
      delayNode.delayTime.value = delayValue;
    }
  });
  
  // Evento del botón play/pause
  shadowRoot.getElementById('btn-play-pause').addEventListener('click', async () => {
    const playPauseBtn = shadowRoot.getElementById('btn-play-pause');
    
    try {
      // Crear audio si no existe
      if (!radioAudio) {
        createRadioAudio();
      }
      
      // Si usa Web Audio API, asegurar que el contexto esté activo
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      
      if (radioAudio.paused) {
        updateStatus('Conectando...');
        mutePageMedia(true);
        await radioAudio.play();
        playPauseBtn.innerHTML = '⏸ Pausar';
        playPauseBtn.className = 'btn-play playing';
        floatingBtn.classList.add('playing');
      } else {
        radioAudio.pause();
        mutePageMedia(false);
        updateStatus('Pausado');
        playPauseBtn.innerHTML = '▶ Reproducir';
        playPauseBtn.className = 'btn-play';
        floatingBtn.classList.remove('playing');
      }
    } catch (err) {
      console.error('[Radio SER] Error al reproducir:', err);
      updateStatus('Error: ' + err.message);
    }
  });
  
  // Evento del botón cerrar (solo oculta el panel, no detiene el audio)
  shadowRoot.getElementById('btn-close-radio').addEventListener('click', () => {
    isRadioActive = false;
    controlPanel.style.display = 'none';
    floatingBtn.style.display = 'flex';
    
    // Actualizar el botón flotante para indicar si está sonando
    if (radioAudio && !radioAudio.paused) {
      floatingBtn.innerHTML = `<span class="radio-icon">🔊</span> SER`;
      floatingBtn.classList.add('playing');
    } else {
      floatingBtn.innerHTML = `<span class="radio-icon">📻</span> SER`;
      floatingBtn.classList.remove('playing');
    }
  });
};

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}