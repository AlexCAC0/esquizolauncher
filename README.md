# EsquizoLauncher & Panel de Administración

> **AVISO IMPORTANTE DE PROPIEDAD INTELECTUAL:**  
> Este software y todos sus recursos pertenecen exclusivamente a **EsquizoStudios**. **NO es de código abierto**. Queda estrictamente prohibida su redistribución, descompilación o uso comercial sin autorización expresa de EsquizoStudios.

---

## 🌌 Descripción del Proyecto

**EsquizoLauncher** es una plataforma creada para **EsquizoStudios** orientada a facilitar y controlar el acceso de los jugadores a eventos y torneos de Minecraft organizados por el estudio.

El proyecto está dividido en dos aplicaciones independientes y altamente seguras:
1. **Cliente Descargable (`client/`)**: Launcher moderno y profesional en tonos violetas, azulados y negros con protocolo Anti-Leak y gestión de instancias por código de acceso.
2. **Panel Web de Administración (`server/`)**: Página web estrictamente **privada** con autenticación vía Discord y whitelist para la creación de instancias, procesamiento automático de archivos `.mrpack` y gestión de usuarios.

---

## 🎨 Paleta y Estilo Visual

- **Fondo Profundo:** `#07050e` / `#0c0919` / `#140f2b`
- **Acentos Violetas / Neón:** `#8b5cf6` / `#7c3aed` / `#6d28d9` / `#c4b5fd`
- **Acentos Azulados:** `#3b82f6` / `#5865f2` (Discord) / `#38bdf8`
- **Superficies:** Tarjetas de vidrio esmerilado con *backdrop-filter*, efectos de brillo violeta y tipografía de alto contraste (*Plus Jakarta Sans* y *JetBrains Mono*).

---

## 🚀 Inicio Rápido

### Requisitos Previos
- **Node.js**: v20 o superior (instalado v24 LTS).
- **Java**: JRE / JDK 17 o 21 (para ejecutar Minecraft).

---

### 1. Iniciar el Servidor & Panel de Administración

El servidor se encarga de servir la API privada, gestionar las instancias y alojar el panel de administración.

```powershell
cd server
npm start
```
*El panel de administración estará disponible en: [http://localhost:3001/admin](http://localhost:3001/admin)*

#### Configuración de Discord OAuth2 (Producción):
En `server/.env`, puedes configurar tus credenciales de la aplicación de Discord:
```env
PORT=3001
SESSION_SECRET=tu-clave-secreta-de-sesion

# Discord Developer Portal:
DISCORD_CLIENT_ID=tu_client_id
DISCORD_CLIENT_SECRET=tu_client_secret
DISCORD_REDIRECT_URI=http://localhost:3001/auth/discord/callback

# IDs de Discord con acceso de Administrador inicial (separados por coma):
DEFAULT_ADMIN_IDS=123456789012345678
```

> 💡 **Modo Desarrollo / Inicial:** Si aún no has creado una aplicación en Discord Developer Portal, el sistema incluye un login inicial seguro para ingresar tu Discord ID y acceder de inmediato como Administrador Maestro.

---

### 2. Iniciar el Cliente (Launcher)

```powershell
cd client
npm start
```

---

## 🛡️ Arquitectura y Reglas de Funcionamiento

### 1. Cliente (EsquizoLauncher)

#### Flujo de Primer Inicio (Onboarding):
1. **Mensaje de Bienvenida:** Presentación visual con el lore y ventajas de EsquizoStudios.
2. **Términos y Condiciones (Obligatorios):** Deben ser aceptados obligatoriamente para habilitar el botón de continuar.
3. **Inicio de Sesión:**
   - **Microsoft (Premium):** Se autentica mediante el flujo OAuth2 de Microsoft y comprueba obligatoriamente que la cuenta posea una licencia comprada de Minecraft Java Edition. Si no la tiene, deniega el acceso.
   - **Cuenta Offline:** Requiere ingresar el nombre de usuario de Minecraft y **vincular una cuenta de Discord**. El servidor comprueba que esa cuenta de Discord no esté vinculada a otro usuario, impidiendo cuentas duplicadas.

#### Menú Principal:
- **Barra Lateral Izquierda:**
  - Botón **Inicio (Home)**.
  - Botón **Galería:** Muestra las capturas tomadas dentro de Minecraft con **F2** (con visor a pantalla completa y botón para abrir la carpeta local en el Explorador de Windows).
  - **Logos de las Instancias:** Accesos directos a las instancias que el jugador ha registrado.
  - **Botón `+` (Añadir Instancia):** Solicita el código único de 18 caracteres. Si es válido, registra la instancia y coloca su logo en la barra.
  - **Cabeza de la Skin del Jugador (abajo):** Al hacer clic, abre el modal de gestión de cuentas (cambiar de cuenta, añadir otra cuenta o cerrar sesión).
  - **Rueda de Ajustes (abajo del todo):** Slider de asignación de memoria RAM, selector o explorador de rutas de Java, estado de vinculación de Discord y opción para desvincularlo.
- **Centro de la Pantalla:**
  - Fondo dinámico con el wallpaper/banner de la instancia seleccionada o el fondo oficial de EsquizoStudios.
  - **Saludo Dinámico:** Calculado con el reloj local de la PC del jugador:
    - `06:00 a 12:59` &rarr; *"Buenos Días, {Usuario}"*
    - `13:00 a 19:59` &rarr; *"Buenas Tardes, {Usuario}"*
    - `20:00 a 05:59` &rarr; *"Buenas Noches, {Usuario}"*
  - **Botón JUGAR:** Estado en tiempo real ("Comprobando actualizaciones...", "Descargando mods...", "En juego").

#### Regla Crítica: Protocolo Anti-Leak (Limpieza Automática)
Al pulsar "Jugar":
1. Comprueba si hay actualizaciones de la instancia en el servidor.
2. Descarga los archivos y mods efímeros necesarios.
3. Inicia el proceso del juego.
4. **Al cerrarse Minecraft:** El launcher detecta la finalización del proceso y **elimina automáticamente y sin confirmación la carpeta `mods/`**, preservando intactos los archivos de configuración (`config/`), capturas (`screenshots/`), opciones de vídeo/teclas (`options.txt`) y paquetes de recursos.  
*Esto garantiza que los mods privados de EsquizoStudios no queden almacenados en el disco del usuario.*

---

### 2. Página Web de Administración (`server/`)

- **Privacidad Total:** La URL del panel de administración no se menciona ni se expone dentro del cliente bajo ninguna circunstancia.
- **Acceso Restringido (Whitelist):**
  - Requiere login con Discord OAuth2.
  - Solo las cuentas de Discord dadas de alta en la whitelist (`staff`) pueden ingresar. Cualquier intento de acceso con una cuenta no autorizada es rechazado automáticamente con código 403.
- **Módulos del Panel:**
  1. **Instancias:**
     - Formulario de creación: Logo, Banner, Archivo `.mrpack` (Modrinth), ID único y privado (**estrictamente letras minúsculas: `^[a-z]+$`**), Nombre público y Descripción.
     - **Procesamiento de `.mrpack`:** Extrae automáticamente el manifiesto `modrinth.index.json`, dependencias de versión, loader (Fabric/Forge), overrides y lista de mods con sus hashes.
     - **Código de 18 caracteres:** Genera y muestra un código alfanumérico único de 18 caracteres (`[a-zA-Z0-9]{18}`), el cual es la **única forma** en que un jugador puede registrar la instancia desde el cliente.
     - Opciones para regenerar el código o eliminar la instancia.
  2. **Usuarios Registrados:**
     - Tabla con todos los usuarios (Microsoft y Offline vinculados a Discord).
     - Buscador por nombre o ID de Discord.
     - Funciones de **Banear** (con motivo), **Desbanear** y **Desvincular Discord**.
  3. **Staff & Permisos:**
     - Gestión de la whitelist de Discord IDs autorizados para administrar el panel.
  4. **Configuración Global:**
     - Edición en tiempo real de los Términos y Condiciones obligatorios y comunicados globales.

---

## 📂 Estructura de Directorios

```
EsquizoLauncher/
├── client/                     # Aplicación de escritorio (Electron)
│   ├── package.json
│   ├── main.js                 # Proceso principal IPC y ciclo de vida Anti-Leak
│   ├── preload.js              # ContextBridge seguro
│   ├── src/
│   │   ├── config.js           # Rutas y configuración de cliente
│   │   ├── store.js            # Persistencia local de cuentas e instancias
│   │   ├── api.js              # Cliente HTTP para consultar el servidor
│   │   ├── gallery.js          # Escaneo de capturas F2
│   │   ├── auth/
│   │   │   ├── microsoft.js    # Flujo OAuth Device Code y chequeo de compra
│   │   │   └── offline.js      # Cuenta offline + vinculación obligatoria Discord
│   │   └── minecraft/
│   │       ├── java.js         # Detección de versiones de Java 8/17/21
│   │       ├── downloader.js   # Sincronización y descarga de archivos/mods
│   │       ├── launcher.js     # Constructor de JVM arguments y ejecución
│   │       └── cleaner.js      # BORRADO SEGURO DE MODS AL SALIR
│   └── renderer/               # Interfaz gráfica (HTML5 / CSS3 / JS)
│       ├── index.html
│       ├── css/
│       │   ├── variables.css   # Paleta violeta / azulada / negra
│       │   ├── style.css       # Layout base y Onboarding
│       │   └── components.css  # Componentes interactivos y modales
│       └── js/
│           ├── app.js          # Coordinador principal
│           ├── onboarding.js   # Bienvenida, TOS obligatorios y Login
│           ├── sidebar.js      # Barra lateral izquierda
│           ├── main-view.js    # Saludo dinámico, selector y botón Jugar
│           ├── gallery-view.js # Visor de capturas F2
│           ├── settings-view.js# Ajustes de RAM, Java y desvinculación
│           └── modals.js       # Registro con código de 18 caracteres y cuentas
│
├── server/                     # Backend y Panel Web de Administración
│   ├── package.json
│   ├── .env                    # Variables de entorno y credenciales
│   ├── src/
│   │   ├── server.js           # Servidor Express
│   │   ├── config.js           # Configuración del servidor
│   │   ├── db.js               # Base de datos persistente atómica
│   │   ├── mrpack.js           # Procesador automático de paquetes .mrpack
│   │   └── routes/
│   │       ├── auth.js         # Discord OAuth2 y verificación de whitelist
│   │       ├── admin.js        # API privada para gestión de instancias/usuarios
│   │       └── api.js          # API pública para clientes (sin acceso admin)
│   └── public/
│       ├── admin/              # Panel de administración Web (SPA)
│       │   ├── index.html
│       │   ├── css/admin.css
│       │   └── js/admin.js
│       └── uploads/            # Almacenamiento de banners, logos y mods
│
└── README.md
```

---

*EsquizoStudios &copy; 2026. Todos los derechos reservados.*
