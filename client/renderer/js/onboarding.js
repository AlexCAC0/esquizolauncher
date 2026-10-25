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

### 2. Política de Recursos y Archivos de Eventos
Los recursos, modificaciones y complementos utilizados durante las partidas son suministrados por los servidores de **EsquizoStudios** para la ejecución exclusiva de las sesiones oficiales. Queda prohibida la extracción, redistribución o copia no autorizada de dichos elementos.
El incumplimiento resultará en el cese inmediato de acceso y la revocación de la participación en futuros eventos.

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

// DISCORD OAUTH FLOW (Client)
let isDiscordPolling = false;

async function startDiscordOAuthFlow() {
  const errBox = document.getElementById('offline-login-error');
  errBox.style.display = 'none';

  const btn = document.getElementById('btn-oauth-discord');
  const btnLabel = document.getElementById('btn-oauth-discord-label');
  btn.disabled = true;
  btnLabel.textContent = 'Abriendo navegador...';

  try {
    const res = await window.api.startDiscordOAuth();
    if (!res.success) {
      throw new Error(res.error || 'No se pudo iniciar el proceso de Discord');
    }

    // Open Discord OAuth URL in user's default browser
    let targetUrl = res.url;
    if (res.isDev) {
      const storeData = await window.api.getStore();
      const apiUrl = storeData.settings?.api_url || 'http://localhost:3001';
      targetUrl = `${apiUrl}${res.url}`;
    }

    await window.api.openExternalUrl(targetUrl);
    btnLabel.textContent = 'Esperando autorización en Discord...';

    // Start polling in background
    pollDiscordOAuthResult(res.sessionId);
  } catch (err) {
    btn.disabled = false;
    btnLabel.textContent = 'Conectar con Discord';
    errBox.textContent = err.message || 'Error al conectar con Discord.';
    errBox.style.display = 'block';
  }
}

async function pollDiscordOAuthResult(sessionId) {
  const errBox = document.getElementById('offline-login-error');
  const btn = document.getElementById('btn-oauth-discord');
  const btnLabel = document.getElementById('btn-oauth-discord-label');
  const statusBox = document.getElementById('discord-oauth-status');

  const startTime = Date.now();
  const maxWait = 120 * 1000; // 2 minutes

  const check = async () => {
    if (Date.now() - startTime > maxWait) {
      btn.disabled = false;
      btnLabel.textContent = 'Reintentar conexión con Discord';
      errBox.textContent = 'El tiempo de espera para vincular Discord expiró.';
      errBox.style.display = 'block';
      return;
    }

    try {
      const res = await window.api.pollDiscordOAuth(sessionId);
      if (res.status === 'completed' && res.user) {
        // Connected!
        document.getElementById('offline-discord-id').value = res.user.id;
        document.getElementById('offline-discord-user').value = res.user.username;

        document.getElementById('discord-linked-name').textContent = `@${res.user.username}`;
        document.getElementById('discord-linked-id').textContent = res.user.id;
        statusBox.style.display = 'flex';

        btn.style.display = 'none';
        return;
      }

      if (res.status === 'error') {
        btn.disabled = false;
        btnLabel.textContent = 'Conectar con Discord';
        errBox.textContent = res.error || 'Error al vincular Discord.';
        errBox.style.display = 'block';
        return;
      }

      // Still pending -> poll again in 1.5s
      setTimeout(check, 1500);
    } catch (err) {
      setTimeout(check, 2000);
    }
  };

  setTimeout(check, 1000);
}

// OFFLINE LOGIN
async function handleOfflineLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('offline-username').value.trim();
  const discord_id = document.getElementById('offline-discord-id').value.trim();
  const discord_username = document.getElementById('offline-discord-user').value.trim();

  const errBox = document.getElementById('offline-login-error');
  errBox.style.display = 'none';

  if (!discord_id) {
    errBox.textContent = 'Debes presionar "Conectar con Discord" antes de ingresar.';
    errBox.style.display = 'block';
    return;
  }

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
    if (window.api && window.api.onMicrosoftProgress) {
      window.api.onMicrosoftProgress((msg) => {
        const statusEl = document.getElementById('ms-status-text');
        if (statusEl) statusEl.textContent = msg;
      });
    }
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
  if (window.api && window.api.openExternalUrl) {
    window.api.openExternalUrl(url);
  } else {
    window.open(url, '_blank');
  }
}
