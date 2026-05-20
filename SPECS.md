# SPECS — Radio Sync Extension

## 1. Visión General

Extensión de Chrome (Manifest V3) que reproduce emisoras de radio en vivo en cualquier página web, con control de retraso para sincronizar con contenido de vídeo. Diseño vintage tipo radio antigua. Permite elegir entre múltiples emisoras.

---

## 2. Arquitectura

```
┌─────────────────────────────────────────────┐
│               content.js                     │
│  ┌──────────┐    ┌──────────────────────┐   │
│  │ ESTADO   │    │     SHADOW DOM       │   │
│  │ - emisora│    │  ┌────────────────┐  │   │
│  │ - delay  │    │  │ floatingBtn    │  │   │
│  │ - playing│    │  ├────────────────┤  │   │
│  │ - audio  │    │  │ selectorPanel  │  │   │
│  └──────────┘    │  ├────────────────┤  │   │
│                  │  │ controlPanel   │  │   │
│  ┌──────────┐    │  │ - knobs        │  │   │
│  │ AUDIO    │    │  │ - slider       │  │   │
│  │ - <Audio>│    │  │ - status       │  │   │
│  │ - WebAPI │    │  └────────────────┘  │   │
│  │ - Delay  │    └──────────────────────┘   │
│  └──────────┘                               │
└─────────────────────────────────────────────┘
         │
         ▼
    styles.css  (estilos vintage inyectados en Shadow DOM)
```

### Flujo de UI

```
[Página web]
    │
    ▼
[Botón flotante] ───clic───► [Selector emisoras]
                                    │
                            elige SER o COPE
                                    │
                                    ▼
                            [Panel de control]
                            │ slider delay
                            │ play/pause
                            │ cambiar emisora
                            │ cerrar
```

### Flujo de audio

```
[Stream URL] ──► <Audio> ──► (sin delay) ──► altavoces
                │
                └── (delay > 0) ──► AudioContext ──► DelayNode ──► altavoces
```

---

## 3. Configuración de Emisoras (`STATIONS`)

Objeto en `content.js`. Tú introduces las URLs de los streams.

```js
const STATIONS = {
  ser: {
    id: 'ser',
    name: 'Cadena SER',
    shortName: 'SER',
    streamUrl: '',            // ← TÚ PONES LA URL
    color: '#dc3545',         // rojo
    colorHover: '#c82333',
    colorPlaying: '#28a745',
    icon: '📻',
    iconPlaying: '🔊'
  },
  cope: {
    id: 'cope',
    name: 'COPE',
    shortName: 'COPE',
    streamUrl: '',            // ← TÚ PONES LA URL
    color: '#1a5276',         // azul
    colorHover: '#154360',
    colorPlaying: '#28a745',
    icon: '🎙️',
    iconPlaying: '🔊'
  }
};
```

---

## 4. Estados del Sistema

| Estado | Descripción | UI |
|---|---|---|
| `INIT` | Extensión cargada, botón flotante visible | Botón con emoji 📻 |
| `SELECTING` | Selector de emisora abierto | Dos botones estilo cassette |
| `IDLE` | Panel abierto, sin reproducir | Panel con slider, botón "▶" |
| `PLAYING` | Radio sonando | Botón "⏸", LED rojo pulsante |
| `PAUSED` | Radio pausada | Botón "▶", estado "Pausado" |
| `LOADING` | Conectando al stream | Estado "Conectando..." |
| `ERROR` | Error de conexión | Estado "Error: ..." |
| `HIDDEN` | Panel cerrado, audio en segundo plano | Botón flotante con icono 🔊 |

---

## 5. Componentes UI (Shadow DOM)

### 5.1 Botón Flotante (`floatingBtn`)

- Posición: fixed, abajo-derecha (20px)
- Forma: redondeado (border-radius 50px)
- Tamaño: padding 12px 20px
- Color de fondo: el de la emisora activa (`STATIONS[id].color`)
- Contenido: icono + nombre corto de la emisora (ej. `📻 SER`)
- Cuando está sonando en segundo plano: icono 🔊 y borde/efecto verde
- Transición suave al cambiar de emisora (cambio de color)
- Z-index: 999999

### 5.2 Selector de Emisoras (`selectorPanel`)

Se muestra al hacer clic en el botón flotante (si no hay emisora activa o se pulsa "cambiar").

- Diseño: dos botones grandes lado a lado, **estilo cassette / cartucho**
- Cada botón muestra: nombre de la emisora, color distintivo
- Al hacer clic en una emisora:
  - Se guarda la emisora activa
  - Se carga el stream correspondiente
  - Se cierra el selector
  - Se abre el panel de control (estado IDLE)

### 5.3 Panel de Control (`controlPanel`)

Se muestra tras seleccionar emisora.

- **Cabecera**: badge "EN VIVO" + nombre de la emisora
- **Slider de retraso**: horizontal, 0-180 segundos, paso 0.1s, styling vintage (madera/latón)
- **Label**: "Retraso: X.X segundos"
- **Estado**: texto informativo ("Listo", "Conectando...", etc.)
- **LED**: indicador rojo pulsante cuando está reproduciendo
- **Botones**:
  - Play/Pause (▶ / ⏸)
  - Cambiar emisora (vuelve al selector)
  - Cerrar (oculta panel, mantiene audio en segundo plano)

### 5.4 Perilla de Delay (opcional decorativo)

La sugerencia de perilla circular se descarta a favor de slider horizontal con styling vintage.

---

## 6. Estilo Vintage

### Paleta de colores

| Uso | Color |
|---|---|
| Fondo panel | `#f5e6c8` (crema vintage) |
| Cabecera panel | `#d4a76a` (madera clara) |
| Texto principal | `#3e2723` (marrón oscuro) |
| Acentos / bordes | `#c99a3b` (latón) |
| Secundario | `#8b5a2b` (marrón cuero) |
| SER | `#dc3545` (rojo) |
| COPE | `#1a5276` (azul) |

### Tipografía

- Cabeceras: serif / display retro (Google Fonts: `Playfair Display`)
- Cuerpo: serif (`Georgia`, `Times New Roman`)
- Labels y valores mono: `Courier New`

### Elementos decorativos

- LED rojo con `box-shadow` brillo pulsante (`@keyframes pulse`)
- Borde del panel con línea fina dorada/latón
- Slider con track de madera y thumb dorado/redondeado
- Botones con efecto de botón antiguo (bordes ligeramente elevados)

### Animaciones

- `slideIn` desde abajo al abrir panel (mantener existente, ajustar easing)
- `pulse` para el LED cuando está reproduciendo
- Transición de fade al cambiar entre selector y panel de control

---

## 7. Funcionalidades Clave

### 7.1 Silenciado automático de página

Al reproducir la radio:
1. Silencia todos los `<audio>` y `<video>` de la página (`element.muted = true`)
2. Marca cada elemento con `dataset.wasMutedByRadio = 'true'`
3. Activa `MutationObserver` para silenciar medios dinámicos (Twitch, etc.)
4. Al pausar/detener: restaura el `muted = false` solo en los elementos marcados

### 7.2 Web Audio API (Delay)

- Solo se activa cuando el slider de retraso > 0
- Crea `AudioContext` + `MediaElementSource` + `DelayNode` (maxDelay 179s)
- `delayNode.delayTime.value = valorDelSlider`
- No recargar el stream al activar (eliminar `radioAudio.load()` innecesario)
- Si falla: reintentar 1 vez tras 2 segundos

### 7.3 Cambio de emisora en caliente

Al cambiar de emisora:
1. Pausar audio actual
2. Desconectar y limpiar nodos Web Audio API
3. Cerrar AudioContext
4. Crear nuevo `<Audio>` con el nuevo stream URL
5. Restaurar delay si estaba activo
6. Si estaba reproduciendo, reanudar

---

## 8. Variables de Estado (módulo)

```js
let audioCtx          // AudioContext (solo si delay > 0)
let source            // MediaElementSource
let delayNode         // DelayNode
let currentStation    // 'ser' | 'cope'
let isPlaying         // boolean
let radioAudio        // <Audio> element
let useWebAudioAPI    // boolean
let shadowRoot        // ShadowRoot
let mediaObserver     // MutationObserver
let delayValue        // float (segundos)
```

---

## 9. Archivos del Proyecto (target)

```
radio-sync-extension/
├── manifest.json
├── content.js          # Toda la lógica y UI
├── styles.css          # Estilos vintage (importados en Shadow DOM)
├── icons/
│   ├── icon16.png
│   └── icon48.png
├── tests/
│   └── extension.spec.js   # Tests reales de la extensión
├── SPECS.md            # Este documento
├── package.json
└── .gitignore
```

---

## 10. Mejoras Técnicas (a implementar)

- [ ] Extraer CSS de `content.js` a `styles.css`, inyectar en Shadow DOM
- [ ] Committear `package-lock.json` (eliminar de `.gitignore`)
- [ ] No recargar stream al activar Web Audio API
- [ ] Reintentar `setupAudioGraph()` si falla
- [ ] Manejar `AudioContext.state === 'suspended'` automáticamente
- [ ] Unificar idioma: toda la UI en español
- [ ] Tests Playwright reales para la extensión

---

## 11. Roadmap

| Fase | Contenido |
|---|---|
| **Fase 1** | Selector de emisora SER / COPE (estilo cassette) + cambio de color botón flotante |
| **Fase 2** | Estilo vintage completo (colores, tipografía, LED, slider decorativo) |
| **Fase 3** | Refactor: CSS a archivo externo, correcciones técnicas (Web Audio API, errores) |
| **Fase 4** | Tests |

---

*Documento de especificaciones — v1.0*
