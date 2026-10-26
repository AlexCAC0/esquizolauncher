// Master Application Controller

let pendingUpdateData = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupWindowControls();
  setupSidebarEvents();
  setupGameEventListeners();

  await initApp();
  // Check for updates automatically in the background
  checkAppUpdatesSilently();
  // Iniciar telemetría periódica & escuchar broadcasts
  setupTelemetryAndBroadcasts();
});

// Window Titlebar Controls
function setupWindowControls() {
  document.getElementById('win-min').addEventListener('click', () => window.api.minimizeWindow());
  document.getElementById('win-max').addEventListener('click', () => window.api.maximizeWindow());
  document.getElementById('win-close').addEventListener('click', () => window.api.closeWindow());
}

async function initApp() {
  try {
    const storeData = await window.api.getStore();

    // 1. Check if user accepted TOS
    if (!storeData.tos_accepted) {
      document.getElementById('view-onboarding').classList.add('active');
      document.getElementById('view-main').style.display = 'none';
      goToOnboardingStep('welcome');
      return;
    }

    // 2. Check if user has an active account
    if (!storeData.current_account) {
      document.getElementById('view-onboarding').classList.add('active');
      document.getElementById('view-main').style.display = 'none';
      goToOnboardingStep('login');
      return;
    }

    // 3. User is ready: Enter Main Menu
    enterMainMenu(storeData);
  } catch (err) {
    console.error('Error initializing app:', err);
  }
}

function onLoginSuccessful(account) {
  document.getElementById('view-onboarding').classList.remove('active');
  document.getElementById('view-main').style.display = 'flex';

  window.api.getStore().then(storeData => {
    enterMainMenu(storeData);
  });
}

function enterMainMenu(storeData) {
  document.getElementById('view-onboarding').classList.remove('active');
  document.getElementById('view-main').style.display = 'flex';

  const account = storeData.current_account;

  // Initialize Dynamic Greeting based on PC Clock & Username & Avatar
  updateDynamicGreeting(account?.username, account?.skinUrl);

  // Render Sidebar
  renderSidebar(storeData);

  // If there's an instance selected, display it; else show Home
  if (storeData.selected_instance_id && storeData.instances.some(i => i.id === storeData.selected_instance_id)) {
    showInstanceView(storeData.selected_instance_id);
  } else {
    setActiveSidebarNav('home');
    showHomeView();
  }
}

// Global Toast Notification Helper
let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

// Auto-Updater Controller
async function checkAppUpdatesSilently() {
  try {
    const res = await window.api.checkUpdate();
    if (res && res.success && res.has_update) {
      pendingUpdateData = res;
      showUpdateModal(res);
    }
  } catch (err) {
    console.log('[Updater] Error comprobando actualización:', err);
  }
}

async function manualCheckForUpdates() {
  const statusEl = document.getElementById('settings-update-status');
  const btn = document.getElementById('btn-manual-check-update');
  if (statusEl) statusEl.textContent = 'Comprobando servidores de EsquizoStudios...';
  if (btn) btn.disabled = true;

  try {
    const res = await window.api.checkUpdate();
    if (res && res.success) {
      if (res.has_update) {
        if (statusEl) statusEl.textContent = `¡Nueva versión v${res.latest_version} disponible!`;
        pendingUpdateData = res;
        showUpdateModal(res);
      } else {
        if (statusEl) statusEl.textContent = `Tu versión (${res.current_version}) está al día.`;
        showToast('Ya tienes la versión más reciente de EsquizoLauncher.');
      }
    } else {
      if (statusEl) statusEl.textContent = 'No se pudo contactar al servidor de actualizaciones.';
      showToast('No se pudo verificar actualizaciones.');
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Error al comprobar actualizaciones.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

function showUpdateModal(updateInfo) {
  const modal = document.getElementById('modal-updater');
  if (!modal) return;

  document.getElementById('updater-version-tag').textContent = `Versión v${updateInfo.latest_version}`;
  const sizeMb = (updateInfo.file_size / (1024 * 1024)).toFixed(1);
  document.getElementById('updater-size-tag').textContent = `Tamaño: ${sizeMb} MB &bull; Fecha: ${new Date(updateInfo.published_at).toLocaleDateString()}`;

  const notesBox = document.getElementById('updater-notes-box');
  if (notesBox) {
    notesBox.textContent = updateInfo.notes ? `Novedades:\n${updateInfo.notes}` : 'Mejoras de rendimiento y estabilidad para eventos.';
  }

  // Handle mandatory update
  const cancelBtn = document.getElementById('btn-updater-cancel');
  const closeBtn = document.getElementById('updater-btn-close');
  if (updateInfo.is_mandatory) {
    if (cancelBtn) cancelBtn.style.display = 'none';
    if (closeBtn) closeBtn.style.display = 'none';
    document.getElementById('updater-description').innerHTML = '<strong style="color:var(--danger)">Esta actualización es obligatoria</strong> para poder conectarse y jugar en los eventos de EsquizoStudios.';
  } else {
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    if (closeBtn) closeBtn.style.display = 'block';
  }

  document.getElementById('updater-progress-container').style.display = 'none';
  document.getElementById('updater-error-box').style.display = 'none';
  document.getElementById('btn-updater-start').disabled = false;
  document.getElementById('btn-updater-start').textContent = 'Descargar e Instalar Ahora';

  modal.classList.add('open');
}

async function startUpdateDownload() {
  if (!pendingUpdateData || !pendingUpdateData.download_url) return;

  const btnStart = document.getElementById('btn-updater-start');
  const cancelBtn = document.getElementById('btn-updater-cancel');
  const progressBox = document.getElementById('updater-progress-container');
  const errorBox = document.getElementById('updater-error-box');
  const progressBar = document.getElementById('updater-progress-bar');
  const percentText = document.getElementById('updater-progress-percent');
  const statusText = document.getElementById('updater-progress-text');

  btnStart.disabled = true;
  btnStart.textContent = 'Descargando...';
  if (cancelBtn) cancelBtn.style.display = 'none';
  errorBox.style.display = 'none';
  progressBox.style.display = 'block';

  // Progress listener
  window.api.onUpdateProgress((data) => {
    progressBar.style.width = `${data.percent}%`;
    percentText.textContent = `${data.percent}%`;
    const dlMb = (data.downloaded / (1024 * 1024)).toFixed(1);
    const totMb = (data.total / (1024 * 1024)).toFixed(1);
    statusText.textContent = `Descargando: ${dlMb} MB de ${totMb} MB...`;
  });

  const res = await window.api.downloadAndInstallUpdate(pendingUpdateData.download_url);
  if (!res.success) {
    errorBox.textContent = `Error al actualizar: ${res.error || 'Fallo desconocido'}`;
    errorBox.style.display = 'block';
    btnStart.disabled = false;
    btnStart.textContent = 'Reintentar Descarga';
  } else {
    statusText.textContent = '¡Descarga completada! Reiniciando launcher con el instalador...';
  }
}

/* ==========================================================================
   TELEMETRÍA HEARTBEAT & POP-UP BROADCASTS
   ========================================================================== */
let activeBroadcastId = null;

function setupTelemetryAndBroadcasts() {
  // Listener de broadcasts que envia el main process
  window.api.onBroadcastAlert((broadcast) => {
    handleIncomingBroadcast(broadcast);
  });

  // Enviar heartbeat inicial y luego cada 25 segundos
  sendClientHeartbeat();
  setInterval(sendClientHeartbeat, 25000);
}

async function sendClientHeartbeat() {
  try {
    const storeData = await window.api.getStore();
    const isPlaying = await window.api.isGameRunning();
    const selectedInst = storeData.selected_instance_id;
    const currentAcc = storeData.current_account;

    const res = await window.api.sendHeartbeat({
      username: currentAcc ? currentAcc.username : 'Invitado',
      instance_id: isPlaying ? selectedInst : (selectedInst || 'Menu'),
      status: isPlaying ? 'playing' : 'idle',
      java_version: storeData.settings?.java_path ? 'Custom' : 'Default'
    });

    if (res && res.broadcast) {
      handleIncomingBroadcast(res.broadcast);
    }
  } catch (err) {
    // Silencioso
  }
}

function handleIncomingBroadcast(broadcast) {
  if (!broadcast || !broadcast.id) return;

  // Si ya lo desestimó en esta sesión o antes
  const dismissedId = localStorage.getItem('dismissed_broadcast_id');
  if (dismissedId === broadcast.id) return;

  activeBroadcastId = broadcast.id;

  const modal = document.getElementById('modal-broadcast-alert');
  const badge = document.getElementById('broadcast-alert-badge');
  const title = document.getElementById('broadcast-alert-title');
  const msg = document.getElementById('broadcast-alert-message');
  const author = document.getElementById('broadcast-alert-author');
  const icon = document.getElementById('broadcast-alert-icon');

  if (!modal) return;

  title.textContent = broadcast.title || 'Aviso Oficial';
  msg.textContent = broadcast.message || '';
  author.textContent = `Emitido por: ${broadcast.author || 'Staff'} · EsquizoStudios`;

  if (broadcast.type === 'urgent') {
    badge.textContent = 'URGENTE / CRÍTICO';
    badge.style.background = 'rgba(239, 68, 68, 0.2)';
    badge.style.color = '#ef4444';
    badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    icon.textContent = '🚨';
  } else if (broadcast.type === 'warning') {
    badge.textContent = 'ADVERTENCIA';
    badge.style.background = 'rgba(245, 158, 11, 0.2)';
    badge.style.color = '#f59e0b';
    badge.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    icon.textContent = '⚠️';
  } else {
    badge.textContent = 'COMUNICADO OFICIAL';
    badge.style.background = 'rgba(59, 130, 246, 0.2)';
    badge.style.color = '#38bdf8';
    badge.style.borderColor = 'rgba(59, 130, 246, 0.4)';
    icon.textContent = '📢';
  }

  modal.classList.add('open');
}

function closeBroadcastAlert() {
  if (activeBroadcastId) {
    localStorage.setItem('dismissed_broadcast_id', activeBroadcastId);
  }
  const modal = document.getElementById('modal-broadcast-alert');
  if (modal) modal.classList.remove('open');
}
