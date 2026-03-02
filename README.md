# Radio Sync - Cadena SER

Extensión de Chrome que te permite escuchar la Cadena SER en cualquier página web y sincronizar el audio con el contenido de vídeo.

## 🚀 Instalación

1. Abre Chrome y ve a `chrome://extensions/`
2. Activa el **"Modo de desarrollador"** (esquina superior derecha)
3. Haz clic en **"Cargar extensión sin empaquetar"**
4. Selecciona la carpeta `radio-sync-extension`
5. ¡Listo! La extensión estará instalada

## 📻 Cómo usar

1. **Navega a cualquier página web** (YouTube, Twitch, DAZN, etc.)
2. Verás un **botón rojo flotante** con el icono de radio y el texto "SER" en la esquina inferior derecha
3. **Haz clic en el botón** para activar la radio
4. Se abrirá un panel de control con:
   - Badge "EN VIVO" 
   - Botón de **Reproducir/Pausar**
   - **Slider de retraso** (0-180 segundos)
   - Botón de **Cerrar**

## ⚙️ Funcionalidades

### 🔇 Silenciado automático
- Al activar la radio, la extensión **silencia automáticamente** todos los elementos `<audio>` y `<video>` de la página
- Cuando cierras la radio, restaura el audio original

### ⏱️ Sincronización con delay
- Usa el **slider de retraso** para ajustar el audio de la radio
- Rango: **0 a 180 segundos** (3 minutos)
- Útil para sincronizar con streams de vídeo que tienen retraso

### 📍 Botón flotante fijo
- El botón permanece visible en la **esquina inferior derecha**
- Funciona en **todas las páginas web** que visites
- Interfaz con Bootstrap moderna y responsive

## 🎯 Casos de uso

- Ver partidos de fútbol en streaming y escuchar la narración de la SER
- Sincronizar eventos deportivos en directo
- Escuchar la radio mientras navegas por cualquier sitio

## 🛠️ Tecnologías

- **Web Audio API** para procesamiento de audio
- **Bootstrap 5** para la interfaz
- **Manifest V3** de Chrome Extensions
- **DelayNode** para la sincronización temporal

## 📝 Notas

- La extensión usa el stream directo de la Cadena SER
- El audio se transmite con CORS habilitado
- Compatible con Chrome y navegadores basados en Chromium

---

**Stream**: Cadena SER (StreamTheWorld CDN)  
**Versión**: 1.0
