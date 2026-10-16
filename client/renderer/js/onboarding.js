let currentOnboardingStep = 'welcome';

function goToOnboardingStep(step) {
  currentOnboardingStep = step;
  document.querySelectorAll('.onboarding-step').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`onboarding-step-${step}`);
  if (target) target.classList.add('active');

  if (step === 'tos') {
    loadTosContent();
  }
}

async function loadTosContent() {
  const box = document.getElementById('tos-content-box');
  try {
    box.innerHTML = `
# Términos y Condiciones de EsquizoStudios

Bienvenido a **EsquizoLauncher**, la plataforma oficial de eventos de **EsquizoStudios**.

Al utilizar este cliente y participar en nuestros eventos, aceptas de manera obligatoria y vinculante los siguientes términos:

### 1. Propiedad y Confidencialidad
El software, las modificaciones propietarias, los complementos, la identidad visual y los recursos de los eventos son propiedad exclusiva de **EsquizoStudios** y **NO** son de código abierto.
Queda estrictamente prohibida la descompilación, extracción, redistribución o filtración de cualquier archivo, mod o asset entregado a través del launcher.

### 2. Política Anti-Filtraciones (Anti-Leak)
Para proteger la integridad y originalidad de los eventos, el launcher ejecuta un protocolo de protección estricto: todos los mods de cada instancia se almacenan de forma efímera durante la sesión de juego y son eliminados automáticamente al cerrarse Minecraft.
Cualquier intento deliberado de interceptar, clonar o evadir este mecanismo resultará en el veto permanente del usuario y de su cuenta de Discord asociada.

### 3. Conducta y Juego Limpio
- Está prohibido el uso de clientes modificados externos, hacks, macros o herramientas no autorizadas.
- Se prohíbe el uso de cuentas duplicadas o el intercambio no autorizado de códigos de acceso.
- La vinculación de Discord es obligatoria y única para jugadores offline para evitar suplantaciones.

### 4. Sanciones
La administración de EsquizoStudios se reserva el derecho de revocar el acceso al launcher, banear cuentas vinculadas y prohibir la participación en eventos futuros sin previo aviso ante el incumplimiento de estas normas.

*Última actualización: EsquizoStudios 2026*
    `.trim();
  } catch (err) {
    box.textContent = 'Error al cargar los términos.';
  }
}

function toggleTosAgreement() {
  const checkbox = document.getElementById('tos-checkbox');
  const btn = document.getElementById('btn-accept-tos');
  btn.disabled = !checkbox.checked;
}

async function acceptTosAndContinue() {
  await window.api.acceptTos();
  goToOnboardingStep('login');
}

function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.logintab === tab);
  });
  document.getElementById('tab-login-offline').classList.toggle('active', tab === 'offline');
  document.getElementById('tab-login-microsoft').classList.toggle('active', tab === 'microsoft');
}

// OFFLINE LOGIN
async function handleOfflineLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('offline-username').value.trim();
  const discord_id = document.getElementById('offline-discord-id').value.trim();
  const discord_username = document.getElementById('offline-discord-user').value.trim();

  const errBox = document.getElementById('offline-login-error');
  errBox.style.display = 'none';

  const btn = document.getElementById('btn-submit-offline');
  btn.disabled = true;
  btn.textContent = 'Verificando con EsquizoStudios...';

  try {
    const res = await window.api.loginOffline({
      username,
      discord_id,
      discord_username
    });

    if (res.success) {
      // Enter main launcher
      onLoginSuccessful(res.account);
    } else {
      errBox.textContent = res.error || 'Error al iniciar sesión.';
      errBox.style.display = 'block';
    }
  } catch (err) {
    errBox.textContent = 'Error de conexión con el servidor.';
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar al Launcher';
  }
}

// MICROSOFT LOGIN
let isPollingMs = false;

async function startMicrosoftLoginFlow() {
  const errBox = document.getElementById('ms-login-error');
  errBox.style.display = 'none';

  const btn = document.getElementById('btn-start-ms');
  btn.disabled = true;
  btn.textContent = 'Generando código...';

  try {
    const res = await window.api.startMicrosoftDevice();
    if (!res.success) {
      throw new Error(res.error || 'No se pudo iniciar el flujo de Microsoft');
    }

    // Display Code to User
    document.getElementById('ms-user-code').textContent = res.user_code;
    const linkEl = document.getElementById('ms-link-url');
    linkEl.href = res.verification_uri;
    linkEl.textContent = res.verification_uri;
    document.getElementById('ms-code-display').style.display = 'block';
    document.getElementById('ms-status-text').textContent = 'Esperando que ingreses el código en tu navegador...';

    // Start polling in background
    isPollingMs = true;
    pollMicrosoftAuth(res.device_code, res.interval);
  } catch (err) {
    errBox.textContent = err.message || 'Error al conectar con Microsoft.';
    errBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Iniciar con Microsoft';
  }
}

async function pollMicrosoftAuth(deviceCode, interval) {
  const errBox = document.getElementById('ms-login-error');
  const btn = document.getElementById('btn-start-ms');

  try {
    const res = await window.api.pollMicrosoftDevice(deviceCode, interval);
    if (res.success) {
      onLoginSuccessful(res.account);
    } else {
      errBox.textContent = res.error || 'Error en autenticación Microsoft.';
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Reintentar con Microsoft';
    }
  } catch (err) {
    errBox.textContent = err.message || 'Error al autenticar.';
    errBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Reintentar con Microsoft';
  }
}

function openExternalUrl(e, url) {
  e.preventDefault();
  // In Electron, opening external link in default browser
  window.open(url, '_blank');
}
