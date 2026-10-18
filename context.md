# 🧠 CONTEXT.MD — EsquizoLauncher & Panel de Administración

> **REGLA OBLIGATORIA PARA DESARROLLADORES Y SESIONES DE ANTIGRAVITY:**  
> Cualquier modificación, refactorización, añadido o corrección en este repositorio **DEBE documentarse obligatoriamente** en la sección [Registro de Cambios (Changelog)](#-registro-de-cambios-changelog) al final de este documento, incluyendo:
> 1. Marca de tiempo exacta (`YYYY-MM-DD HH:mm:ss`).
> 2. Autor o sesión responsable.
> 3. Archivos modificados o creados.
> 4. Justificación técnica y pruebas realizadas.

---

## 📌 1. Visión General del Proyecto

**EsquizoLauncher** es una solución propietaria completa diseñada para **EsquizoStudios**, creada específicamente para centralizar, controlar y facilitar la participación de los jugadores en eventos, torneos y series de Minecraft organizadas por el estudio.

El proyecto es **estrictamente de código cerrado y privado**. No debe incluir licencias open-source permisivas.

El sistema se compone de dos aplicaciones totalmente desacopladas:
1. **Cliente Descargable (`client/`)**: Aplicación de escritorio desarrollada con **Electron**, con una interfaz estética en tonos oscuros, violetas y azulados, vinculación obligatoria de Discord para cuentas no premium, menú interactivo y un **motor Anti-Leak** que elimina automáticamente los mods de las instancias al cerrar el juego.
2. **Panel de Administración Web Privado (`server/`)**: Backend con **Node.js + Express** y base de datos persistente atómica. Cuenta con autenticación vía **Discord OAuth2 con Whitelist estricta**, procesador de archivos `.mrpack` (Modrinth) que extrae dependencias y overrides, y generación de **códigos de acceso alfanuméricos únicos de 18 caracteres**.

---

## 🏗️ 2. Arquitectura del Repositorio

```
EsquizoLauncher/
├── client/                         # Aplicación de Escritorio (Electron)
│   ├── package.json                # Dependencias: electron, adm-zip, axios, uuid
│   ├── main.js                     # Proceso Principal de Electron e IPC Handlers
│   ├── preload.js                  # Puente seguro (contextBridge) hacia el renderer
│   ├── src/
│   │   ├── config.js               # Rutas locales (%APPDATA%/.esquizolauncher), branding y API
│   │   ├── store.js                # Gestor de persistencia atómica (cuentas, TOS, instancias)
│   │   ├── api.js                  # Cliente HTTP Axios hacia el backend de EsquizoStudios
│   │   ├── discord-rpc.js          # Integración de Discord Rich Presence (RPC) con estados dinámicos
│   │   ├── gallery.js              # Escaneo y gestión de capturas de pantalla tomadas con F2 (copiar/eliminar)
│   │   ├── auth/
│   │   │   ├── microsoft.js        # Flujo Device Code OAuth + Verificación de compra Minecraft Java
│   │   │   └── offline.js          # Cuenta offline + vinculación obligatoria y única de Discord
│   │   └── minecraft/
│   │       ├── java.js             # Detección automática de Java (JRE/JDK 8, 17, 21) en Windows
│   │       ├── downloader.js       # Descarga y verificación SHA1 de archivos, overrides y mods
│   │       ├── launcher.js         # Constructor de JVM arguments, spawn de proceso y hooks
│   │       └── cleaner.js          # 🛡️ PROTOCOLO ANTI-LEAK: Borrado inmediato de mods al salir
│   └── renderer/                   # Interfaz de Usuario (HTML5 + CSS3 + Vanilla JS)
│       ├── index.html              # Shell HTML principal con titlebar personalizada y vistas
│       ├── css/
│       │   ├── variables.css       # Paleta oficial: violeta, azul neón y negro profundo
│       │   ├── style.css           # Estilos base, titlebar borderless y onboarding
│       │   └── components.css      # Botones, tabs, sliders, modales, galería y tarjetas
│       ├── js/
│       │   ├── app.js              # Coordinador maestro del ciclo de vida de la UI
│       │   ├── onboarding.js       # Pasos de bienvenida, TOS obligatorios y login
│       │   ├── sidebar.js          # Barra lateral izquierda (logos dinámicos, navegación)
│       │   ├── main-view.js        # Saludo dinámico según reloj de PC y botón JUGAR
│       │   ├── gallery-view.js     # Visor de capturas F2 con modal a pantalla completa
│       │   ├── settings-view.js    # Ajustes de RAM (slider), Java y desvinculación de Discord
│       │   └── modals.js           # Modal de código de 18 caracteres y selector de cuenta
│       └── assets/                 # Iconos y texturas (steve.png, default-instance.png, etc.)
│
├── server/                         # Backend y Panel Web Administrativo
│   ├── package.json                # Dependencias: express, multer, adm-zip, dotenv, axios, etc.
│   ├── .env                        # Variables de entorno privadas (Discord Client ID, Secret, etc.)
│   ├── .env.example                # Plantilla de variables de entorno
│   ├── data/
│   │   └── database.json           # Base de datos persistente atómica en formato JSON
│   ├── src/
│   │   ├── server.js               # Punto de entrada Express y configuración de middlewares
│   │   ├── config.js               # Configuración del servidor y constantes
│   │   ├── db.js                   # Capa de base de datos con generador de códigos de 18 chars
│   │   ├── mrpack.js               # Descompresor y analizador de archivos .mrpack de Modrinth
│   │   └── routes/
│   │       ├── auth.js             # Discord OAuth2 y verificación de Whitelist de Staff
│   │       ├── admin.js            # API privada para gestión de instancias, usuarios y staff
│   │       └── api.js              # API pública para el cliente (claim, login, TOS, manifests)
│   └── public/
│       ├── admin/                  # Panel de Administración Web Privado (SPA)
│       │   ├── index.html          # Interfaz web con pestañas de administración
│       │   ├── css/admin.css       # Estilos oscuros profesionales con acentos violetas
│       │   └── js/admin.js         # Lógica interactiva del panel de control
│       └── uploads/                # Archivos servidos: logos, banners y overrides de instancias
│
├── test_system.js                  # Suite de pruebas automatizadas para validar reglas críticas
├── README.md                       # Documentación ejecutiva del proyecto
└── .gitignore                      # Exclusión de credenciales, node_modules y binarios pesados
```

---

## 💻 3. Detalle Técnico del Cliente (`client/`)

### 3.1. Identidad Visual y Estilo
- **Colores primarios:** `#07050e` (fondo negro absoluto), `#0c0919` (superficie principal), `#140f2b` (tarjetas esmeriladas).
- **Acentos:** `#8b5cf6` y `#7c3aed` (violetas vibrantes con brillo neón `rgba(139, 92, 246, 0.4)`), `#3b82f6` (azul secundario), `#5865f2` (Discord).
- **Tipografía:** *Plus Jakarta Sans* para interfaz general y *JetBrains Mono* para códigos de acceso y hashes.
- **Ventana:** Borderless (sin marco nativo del SO), con titlebar personalizada que incluye controles de ventana (minimizar, maximizar, cerrar) y región de arrastre `-webkit-app-region: drag`.

### 3.2. Flujo de Primer Inicio (Onboarding)
1. **Bienvenida:** Pantalla ilustrada con el logotipo de EsquizoStudios y resumen de características.
2. **Términos y Condiciones (TOS Obligatorios):**
   - El texto formal se obtiene del backend (editable en tiempo real desde el panel de administración).
   - Incluye advertencias explícitas sobre la propiedad del software y la prohibición de filtraciones.
   - **El botón "Aceptar y Continuar" permanece deshabilitado** hasta que el usuario marque la casilla de verificación.
3. **Inicio de Sesión:**
   - **Pestaña Microsoft:** Flujo *OAuth 2.0 Device Code*. Presenta el código y enlace (`microsoft.com/link`). Una vez autenticado, **comprueba obligatoriamente** la posesión de Minecraft Java en `https://api.minecraftservices.com/entitlements/mcstore`. Si la cuenta no posee el juego comprado, la rechaza con un mensaje explicativo.
   - **Pestaña Offline:** Solicita nombre de usuario (3-16 caracteres) y vinculación de cuenta de Discord (`discord_id` y `discord_username`). El backend valida que la cuenta de Discord no esté previamente enlazada a otro nombre de usuario, bloqueando cuentas duplicadas.

### 3.3. Menú Principal y Vistas
- **Barra Lateral Izquierda:**
  - Logotipo del estudio en la parte superior.
  - Botón **Inicio** (Home).
  - Botón **Galería**: Escanea la carpeta `screenshots/` de las instancias y de `%APPDATA%/.minecraft/screenshots`, mostrando capturas tomadas con **F2** en una cuadrícula con fecha, tamaño y botón para abrir la carpeta local en el Explorador de Windows.
  - Divisor y lista dinámica de instancias añadidas (botones circulares con logo y anillo de selección violeta).
  - Botón **`+` (Añadir Instancia)**: Abre el modal que solicita el código de acceso único de 18 caracteres.
  - Avatar de la skin del jugador (inferior): Al hacer clic, abre el modal de gestión de cuentas (cambiar entre cuentas registradas, añadir nueva cuenta o cerrar sesión).
  - Icono de tuerca de Ajustes (abajo del todo): Permite regular la memoria RAM con slider (en GB), seleccionar la ruta de Java y desvincular la cuenta de Discord.
- **Centro de la Pantalla:**
  - Wallpaper dinámico (cambia automáticamente al banner de la instancia seleccionada o al fondo degradado oficial de EsquizoStudios).
  - **Saludo Dinámico en Tiempo Real:**
    - `06:00` a `12:59` &rarr; *"¡Buenos Días, {Usuario}!"*
    - `13:00` a `19:59` &rarr; *"¡Buenas Tardes, {Usuario}!"*
    - `20:00` a `05:59` &rarr; *"¡Buenas Noches, {Usuario}!"*
  - Vista de la instancia con logo, banner, título, descripción, versión de Minecraft, loader (Fabric/Forge) y el botón **JUGAR** con barra de progreso interactiva.

### 3.4. Motor Anti-Leak (Regla de Seguridad Fundamental)
Implementado en `client/src/minecraft/cleaner.js` y coordinado por `client/src/minecraft/launcher.js`:
- Cuando el jugador pulsa "JUGAR":
  1. El cliente comprueba actualizaciones con el backend.
  2. Descarga los archivos de configuración (`overrides/`) y los mods efímeros necesarios en `instances/<id>/mods/`.
  3. Ejecuta el proceso Java de Minecraft (`javaw.exe`).
- **Al cerrarse el juego (`child.on('exit')` o `child.on('close')`):**
  - El launcher detecta la terminación del proceso y **ejecuta inmediatamente y sin confirmación el borrado total de la carpeta `mods/`**.
  - **Archivos estrictamente preservados:** `config/`, `screenshots/`, `options.txt`, `resourcepacks/`, `shaderpacks/` y `saves/`.
  - Se garantiza que los mods de eventos privados no queden expuestos en el equipo del jugador.

---

## 🌐 4. Detalle Técnico del Panel de Administración (`server/`)

### 4.1. Aislamiento y Privacidad
- La URL y endpoints administrativos (`/admin`) **NO se mencionan ni se exponen en ninguna parte del código del cliente descargable**.
- El cliente solo se comunica mediante endpoints públicos prefijados con `/api/client/`.

### 4.2. Autenticación Discord OAuth2 & Whitelist
- Implementado en `server/src/routes/auth.js`.
- El acceso al panel requiere iniciar sesión con Discord.
- **Comprobación Estricta:** Al recibir los datos del usuario desde `https://discord.com/api/users/@me`, el servidor consulta la tabla `staff` en `db.js`.
- Si el ID de Discord **no está en la whitelist**, el inicio de sesión se aborta de inmediato devolviendo error HTTP 403 y una pantalla de acceso denegado.
- *Modo Dev / Inicial:* Si aún no se configuran las credenciales de Discord en `.env`, el panel ofrece un formulario seguro para ingresar el Discord ID maestro y auto-habilitarse como administrador inicial.

### 4.3. Procesamiento Automático de `.mrpack`
- Implementado en `server/src/mrpack.js`.
- Modrinth modpacks son archivos ZIP estándar. Al subir un `.mrpack` desde el panel:
  1. Descomprime y lee `modrinth.index.json`.
  2. Extrae la versión de Minecraft (ej: `1.20.1`) y el loader (ej: `fabric-loader: 0.15.11`, Forge o NeoForge).
  3. Extrae el directorio `overrides/` hacia `public/uploads/instances/<id>/overrides/`.
  4. Filtra los archivos requeridos para el cliente (`env.client != "unsupported"`), registrando URLs de descarga, tamaños y hashes SHA1/SHA512.
  5. Genera un archivo compilado `manifest.json` en la carpeta de la instancia.

### 4.4. Reglas de Validación de Instancias y Códigos
- **ID de Instancia:** Obligatoriamente **solo letras minúsculas** (`^[a-z]+$`). No se permiten números, letras mayúsculas, espacios ni caracteres especiales.
- **Código de Acceso Único (18 caracteres):** Generado con `crypto.randomBytes` a partir del alfabeto alfanumérico mixto (`[a-zA-Z0-9]{18}`). Es imposible acceder a una instancia desde el cliente sin este código.

### 4.5. Gestión de Usuarios y Sanciones
- Registro de cuentas Microsoft y Offline.
- Para cuentas offline, el servidor vincula el `discord_id`. Si otro usuario intenta registrarse con ese mismo Discord, el servidor devuelve HTTP 409 (Conflicto).
- Los administradores pueden sancionar (banear con motivo), desbanear o desvincular Discord manualmente desde la tabla de usuarios.

---

## ⚙️ 5. Lo que Falta Configurar (Guía de Producción)

Para poner el ecosistema en producción en un servidor remoto o VPS, se deben completar los siguientes pasos:

### 5.1. Variables de Entorno del Servidor (`server/.env`)
Crear una aplicación en el [Discord Developer Portal](https://discord.com/developers/applications):
```env
PORT=3001
SESSION_SECRET=genera_una_clave_larga_y_segura_aqui

# Credenciales de Discord Developer Portal
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=tu_client_secret_de_discord
DISCORD_REDIRECT_URI=https://tu-dominio.com/auth/discord/callback
DISCORD_BOT_TOKEN=opcional_para_verificaciones_avanzadas

# IDs de Discord de los dueños del estudio (separados por coma)
DEFAULT_ADMIN_IDS=712345678901234567,812345678901234568
```
*En el portal de Discord, agregar `https://tu-dominio.com/auth/discord/callback` (o `http://localhost:3001/auth/discord/callback` para pruebas locales) en la sección **OAuth2 &rarr; Redirects**.*

### 5.2. Configuración de URL del Backend en el Cliente
En `client/src/config.js`:
- Cambiar `DEFAULT_API_URL: 'http://localhost:3001'` por la URL pública con HTTPS del servidor del estudio (ej: `https://api.esquizostudios.com`).
- Los usuarios también pueden cambiar esta URL temporalmente en los Ajustes del launcher si es necesario.

### 5.3. Empaquetado del Cliente (.exe)
Para generar el ejecutable instalable o portable para los jugadores:
1. Instalar `electron-builder` en el cliente:
   ```powershell
   cd client
   npm install --save-dev electron-builder
   ```
2. Añadir la configuración en `client/package.json`:
   ```json
   "build": {
     "appId": "com.esquizostudios.launcher",
     "productName": "EsquizoLauncher",
     "win": {
       "target": "nsis",
       "icon": "renderer/assets/icon.png"
     }
   }
   ```
3. Ejecutar `npm run build` para generar el instalador en `client/dist/`.

---

## 🧪 6. Cómo Probar el Sistema Completo Localmente

1. **Iniciar el Servidor:**
   ```powershell
   cd server
   npm start
   ```
   *Acceso al panel admin: `http://localhost:3001/admin`*

2. **Iniciar el Cliente:**
   ```powershell
   cd client
   npm start
   ```

3. **Ejecutar la Suite de Pruebas Automatizada:**
   ```powershell
   node test_system.js
   ```
   *Verifica la generación de códigos de 18 caracteres, la validación estricta de IDs en minúsculas, la prevención de cuentas de Discord duplicadas y la limpieza inmediata de mods.*

---

## 💡 7. Lista de Ideas para Futuras Versiones

A continuación se listan ideas y mejoras sugeridas para expandir las capacidades de EsquizoLauncher y los eventos de EsquizoStudios:

1. **Discord Rich Presence (RPC) Dinámico:** *(✅ IMPLEMENTADO)*
   - Muestra en el perfil de Discord: estado de inicio/standby, progreso de descargas de assets y estado jugando (singleplayer/multiplayer) con nombre de la instancia, logo y tiempo transcurrido.
2. **Auto-Configuración de Simple Voice Chat:**
   - Detectar la presencia del mod de voz y sincronizar automáticamente los puertos, servidor de voz y teclas asignadas en `config/voicechat.json` según el evento.
3. **Actualizador Silencioso en Segundo Plano (`electron-updater`):**
   - Descarga de nuevas versiones del cliente directamente desde un bucket privado o GitHub Releases privados sin requerir reinstalación manual por parte de los jugadores.
4. **Sistema de Reporte de Crashes hacia Webhook de Discord:**
   - Si el juego crashea (`exit code != 0`), capturar las últimas 50 líneas del log de Minecraft (`logs/latest.log`) y enviarlas de forma anónima a un canal privado de Discord del Staff para depuración rápida en vivo.
5. **Monitor de Estado y Ping del Servidor de Minecraft:**
   - Mostrar directamente sobre la tarjeta de la instancia si el servidor del evento está encendido, el ping en milisegundos y la cantidad de jugadores conectados en tiempo real.
6. **Música Ambiental y Efectos de Sonido por Instancia:**
   - Posibilidad de adjuntar una pista de audio (tema oficial del evento) en el panel de administración que se reproduzca sutilmente de fondo al seleccionar la instancia en el launcher.
7. **Pestaña de Clasificaciones y Torneos en Vivo:**
   - Un módulo dentro del launcher donde los participantes puedan consultar la tabla de puntos, llaves de eliminación o lore del evento sin salir de la aplicación.
8. **Selector de Capas y Cosméticos Propios del Estudio:**
   - Servidor local de texturas para inyectar capas y cosméticos exclusivos de EsquizoStudios visibles para todos los usuarios que usen el launcher oficial.
9. **Verificación de Integridad de Memoria / Anti-Cheat Básico:**
   - Comprobación de que no se hayan inyectado librerías `.dll` sospechosas en el proceso Java durante la partida.
10. **Grabador de Replays / Clips Automático:**
    - Integración de ReplayMod pre-configurado para renderizar los mejores momentos de los participantes del evento sin pérdida de rendimiento.

---

## 📝 8. Registro de Cambios (Changelog)

> **AVISO:** Cada desarrollador o sesión de IA que realice modificaciones en este repositorio debe añadir una entrada en esta tabla detallando los cambios.

| Fecha y Hora (Local) | Autor / Agente | Archivos Afectados | Descripción del Cambio |
| :--- | :--- | :--- | :--- |
| **2026-10-16 20:00:00** | Antigravity AI | Todo el proyecto | Creación inicial de EsquizoLauncher (Cliente Electron + Panel Admin Express + Suite de pruebas). Implementación del flujo de onboarding con TOS obligatorios, login Microsoft Premium con chequeo de compra y login Offline con Discord. Motor Anti-Leak con borrado de mods al salir. Subida inicial a GitHub (`https://github.com/AlexCAC0/esquizolauncher`). |
| **2026-10-16 20:53:00** | Antigravity AI | `context.md` | Creación del archivo de contexto técnico maestro exhaustivo con documentación de arquitectura, seguridad, configuración pendiente, protocolo de changelog y lista de ideas futuras. |
| **2026-10-16 21:12:00** | Antigravity AI | `client/package.json`, `client/src/minecraft/launcher.js`, `client/src/minecraft/downloader.js`, `client/src/minecraft/java.js`, `test_system.js`, `context.md` | Implementación completa de la función de apertura real de Minecraft con la Opción A: integración de `minecraft-launcher-core` (MCLC). Se implementó la descarga automática y verificación SHA1 del cliente base de Mojang (`ensureVanillaJar`), generación automática de perfiles de Fabric Loader desde la API oficial (`prepareFabricProfile`), resolución dinámica de Classpath/Natives/Assets, canalización de eventos de progreso hacia la UI, detección robusta de Java 17/21 con mensajes explicativos, preservación intacta del protocolo Anti-Leak (`cleanInstanceMods`), y nuevo caso de prueba en `test_system.js` validado al 100%. |
| **2026-10-16 21:23:00** | Antigravity AI | `client/src/config.js`, `client/src/minecraft/java.js`, `client/src/minecraft/launcher.js`, `test_system.js`, `context.md` | Implementación del sistema inteligente de detección y descarga automática de Java: determina dinámicamente si la versión de Minecraft requiere Java 8 (<=1.16.5), Java 17 (1.17-1.20.4) o Java 21 (1.20.5+ y 1.21+). Si la máquina del jugador no tiene la versión correspondiente instalada, descarga automáticamente un runtime JRE oficial portátil de Eclipse Temurin (Adoptium) en `.esquizolauncher/runtimes/java-<ver>/`, lo descomprime y lo configura de inmediato con seguimiento de progreso en la UI. Añadido el Test 6 en `test_system.js` superado al 100%. |
| **2026-10-16 22:09:00** | Antigravity AI | `client/src/gallery.js`, `client/src/minecraft/downloader.js`, `client/src/minecraft/launcher.js`, `test_system.js`, `context.md` | Centralización automática de capturas de pantalla tomadas con F2 en Minecraft hacia la carpeta `screenshots` del launcher (`%APPDATA%/.esquizolauncher/screenshots`). Se implementó `linkScreenshotsFolder` utilizando Junctions de NTFS en Windows al preparar cada instancia, vinculando de forma transparente `instances/<id>/screenshots` con la carpeta central sin necesidad de mods. Se añadió sincronizador de respaldo en `launcher.on('close')`, soporte canónico en `getScreenshots()` para evitar duplicados y el Test 7 en `test_system.js` validado al 100%. |
| **2026-10-16 22:26:00** | Antigravity AI | `client/src/minecraft/downloader.js`, `client/src/minecraft/launcher.js`, `context.md` | Corrección del problema de audio inaudible / mudo en Minecraft. Se identificó en `latest.log` que Minecraft arrojaba `[Render thread/ERROR]: Can't open the resource index file: .../assets/indexes/1.20.1.json`, lo que provocaba que el SoundManager no cargara los archivos de sonido `.ogg`. Se corrigió implementando la descarga y replicación automática del índice de recursos para versiones vanilla y cargadores Fabric en `downloader.js`, y asegurando la ruta canónica `assetRoot` en los argumentos de inicio de `launcher.js`. |
| **2026-10-16 23:42:00** | Antigravity AI | `client/package.json`, `client/src/discord-rpc.js`, `client/src/store.js`, `client/src/gallery.js`, `client/preload.js`, `client/main.js`, `client/renderer/index.html`, `client/renderer/css/components.css`, `client/renderer/js/app.js`, `client/renderer/js/main-view.js`, `client/renderer/js/gallery-view.js`, `client/renderer/js/settings-view.js`, `client/renderer/js/sidebar.js`, `test_system.js`, `context.md`, `esquizo.png` | **Actualización integral de experiencia de usuario y presencia digital:**<br>1. **Continuar Jugando:** Nueva tarjeta destacada en la pantalla de inicio con la última instancia jugada (o primera disponible) mostrando carátula, versión, modloader y botón de inicio directo.<br>2. **Saludo Dinámico con Avatar:** Inclusión de la cabeza de la skin del jugador (`greeting-avatar-head`) junto a la hora del día en color blanco puro (`#ffffff`) y el nombre del jugador destacado en color violeta vibrante (`#c084fc`).<br>3. **Animaciones Fluidas de Pestañas:** Transiciones suaves `@keyframes panelFadeSlide` entre pantallas, dotando de dinamismo y vida al cliente.<br>4. **Integración con Discord RPC:** Integración completa de presencia enriquecida en Discord (Standby en inicio, Descargando assets, y Jugando Singleplayer/Multiplayer con logotipo de la instancia y duración de sesión).<br>5. **Acciones en Galería F2:** Botones interactivos al hacer hover sobre cualquier captura para copiar la imagen directamente al portapapeles (`clipboard.writeImage`) o eliminarla de disco con confirmación; toolbar funcional análoga en el visor modal a pantalla completa.<br>6. **Ajustes Reorganizados en Sub-secciones & Acción al Jugar:** Organización por pestañas (*Rendimiento & Java*, *Comportamiento*, *Cuenta & Discord*, *Comunidad*) y nueva configuración para mantener abierto, minimizar u ocultar y restaurar la ventana al jugar.<br>7. **Acceso Oficial a Discord:** Botones de invitación directa a `discord.gg/VgxHfRkYPn` en la barra lateral y en la pestaña de comunidad.<br>8. **Logo Oficial:** Adopción del archivo `esquizo.png` oficial en todas las vistas y ejecutables. Test 8 implementado y aprobado al 100%. |
| **2026-10-17 00:14:00** | Antigravity AI | `client/src/discord-rpc.js`, `client/src/config.js`, `client/src/store.js`, `client/main.js`, `client/renderer/index.html`, `client/renderer/js/settings-view.js`, `context.md` | **Diagnóstico y solución de Discord RPC:** Se detectó que la conexión IPC de Discord se cerraba (`connection closed`) debido a que Discord rechaza IDs de aplicación no registrados en su backend. Se implementó: 1) Campo configurable en Ajustes > Cuenta & Discord para ingresar el Client ID de la aplicación de Discord Developer; 2) Sistema de reconexión automática periódica (cada 15s) en `discord-rpc.js` en caso de que Discord se inicie después del launcher; 3) Recarga en caliente del cliente RPC al modificar los ajustes. |
| **2026-10-17 01:32:00** | Antigravity AI | `client/main.js`, `client/renderer/index.html`, `client/renderer/assets/logo.png`, `logo.png`, `context.md` | **Separación y asignación del logo oficial del Launcher (`logo.png`):** Se integró `logo.png` como icono oficial de la aplicación (icono nativo de la ventana Electron, icono en titlebar, badge de bienvenida del onboarding, logo superior en sidebar y hero card de inicio). Se conservó `esquizo.png` exclusivamente para la representación del estudio en Discord (tarjetas de comunidad e invitaciones) y assets de Discord Rich Presence. |
| **2026-10-18 20:23:00** | Antigravity AI | `server/public/admin/js/admin.js`, `server/src/routes/auth.js`, `client/src/api.js`, `client/main.js`, `client/preload.js`, `client/renderer/index.html`, `client/renderer/js/onboarding.js`, `client/renderer/js/main-view.js`, `context.md` | **Actualización de instancias, Login de Discord 1-Click y Eliminación de Instancias:**<br>1. **Edición y actualización de instancias con .mrpack:** Añadido botón "Editar" en las tarjetas del panel admin, función `openEditInstanceModal` y rama `PUT /admin/api/instances/:id` en `handleInstanceSubmit`, permitiendo actualizar nombre, descripción, imágenes o subir un nuevo archivo modpack `.mrpack`.<br>2. **Flujo de Discord OAuth en el Cliente:** Implementado flujo seguro en navegador del sistema (`/auth/discord/client-start`, `/auth/discord/client-callback`, `/auth/discord/client-result`), con botón 1-click "Conectar con Discord" y sondeo automático en el onboarding offline, eliminando la necesidad de que los jugadores copien a mano su ID de 18 dígitos.<br>3. **Eliminar instancias del cliente:** Añadido botón "Eliminar" en la vista de la instancia (`#panel-instance`) con confirmación, llamada a `window.api.removeInstance(id)` y recarga automática de la barra lateral y vista principal. |




