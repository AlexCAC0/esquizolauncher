async function showSettingsView() {
  document.querySelectorAll('.panel-screen').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-settings').classList.add('active');

  const storeData = await window.api.getStore();
  const settings = storeData.settings || {};
  const currentAccount = storeData.current_account;

  // 1. RAM Slider
  const ramMax = settings.ram_max || 4096;
  const slider = document.getElementById('ram-slider');
  slider.value = ramMax;
  updateRamSliderDisplay();

  // 2. Action on Play Radio
  const actionOnPlay = settings.action_on_play || 'keep';
  const radio = document.querySelector(`input[name="opt-action-on-play"][value="${actionOnPlay}"]`);
  if (radio) radio.checked = true;

  // Streamer Mode checkbox
  const streamerChk = document.getElementById('opt-streamer-mode');
  if (streamerChk) streamerChk.checked = isStreamerModeActive();

  // 5. Account Details
  if (currentAccount) {
    document.getElementById('settings-username').textContent = currentAccount.username;
    document.getElementById('settings-account-type').textContent = currentAccount.type === 'microsoft' ? 'Microsoft Premium' : 'Offline';

    const discordEl = document.getElementById('settings-discord-status');
    const unlinkBtn = document.getElementById('btn-unlink-discord');

    if (currentAccount.discord_id) {
      discordEl.textContent = `@${currentAccount.discord_username || currentAccount.discord_id}`;
      discordEl.style.color = '#818cf8';
      unlinkBtn.style.display = 'inline-block';
    } else {
      discordEl.textContent = 'No vinculado';
      discordEl.style.color = 'var(--text-muted)';
      unlinkBtn.style.display = 'none';
    }
  }

  // 5. Load Java List
  loadJavaInstallations(settings.java_path);
}

function switchSettingsSubtab(tabName) {
  document.querySelectorAll('.settings-subtab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-subtab') === tabName);
  });
  document.querySelectorAll('.settings-subtab-content').forEach(c => {
    c.classList.toggle('active', c.id === `subtab-${tabName}`);
  });
}

function updateRamSliderDisplay() {
  const slider = document.getElementById('ram-slider');
  const valGb = (slider.value / 1024).toFixed(1);
  document.getElementById('ram-slider-value').textContent = valGb;
}

async function loadJavaInstallations(selectedJavaPath = '') {
  const select = document.getElementById('java-select');
  select.innerHTML = '<option value="">Autodetectar / Descargar automáticamente (Recomendado)</option>';

  try {
    const list = await window.api.getJavaList();
    list.forEach(j => {
      const opt = document.createElement('option');
      opt.value = j.path;
      opt.textContent = `${j.name} - ${j.path}`;
      if (selectedJavaPath && selectedJavaPath.toLowerCase() === j.path.toLowerCase()) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
  } catch (err) {
    console.warn('Error fetching Java list:', err);
  }
}

async function browseCustomJava() {
  const customPath = await window.api.browseJavaPath();
  if (customPath) {
    const select = document.getElementById('java-select');
    const opt = document.createElement('option');
    opt.value = customPath;
    opt.textContent = `Personalizado: ${customPath}`;
    opt.selected = true;
    select.appendChild(opt);
  }
}

async function saveLauncherSettings() {
  const ramMax = parseInt(document.getElementById('ram-slider').value, 10);
  const javaPath = document.getElementById('java-select').value;
  
  const actionRadio = document.querySelector('input[name="opt-action-on-play"]:checked');
  const actionOnPlay = actionRadio ? actionRadio.value : 'keep';

  await window.api.updateSettings({
    ram_max: ramMax,
    java_path: javaPath,
    action_on_play: actionOnPlay
  });

  if (typeof showToast === 'function') {
    showToast('✅ Ajustes guardados correctamente');
  } else {
    alert('Ajustes guardados correctamente.');
  }
}

function openDiscordInvite() {
  window.api.openExternalUrl('https://discord.gg/VgxHfRkYPn');
}

async function unlinkDiscordFromSettings() {
  const storeData = await window.api.getStore();
  const acc = storeData.current_account;
  if (!acc) return;

  if (!confirm(`¿Estás seguro de que deseas desvincular tu cuenta de Discord de '${acc.username}'?`)) {
    return;
  }

  const res = await window.api.unlinkDiscord(acc.username);
  if (res.success) {
    if (typeof showToast === 'function') {
      showToast('Discord desvinculado exitosamente');
    } else {
      alert('Cuenta de Discord desvinculada exitosamente.');
    }
    showSettingsView();
  } else {
    alert(`Error: ${res.error || 'No se pudo desvincular Discord.'}`);
  }
}

// --- STREAMER MODE CONTROLLER ---
let streamerMode = localStorage.getItem('esquizo_streamer_mode') === 'true';

function isStreamerModeActive() {
  return streamerMode;
}

function toggleStreamerMode(enable) {
  streamerMode = enable;
  localStorage.setItem('esquizo_streamer_mode', enable ? 'true' : 'false');
  applyStreamerMode();
  showToast(enable ? '🛡️ Modo Streamer Activado' : 'Modo Streamer Desactivado');
}

function toggleStreamerModeQuick() {
  toggleStreamerMode(!streamerMode);
  const chk = document.getElementById('opt-streamer-mode');
  if (chk) chk.checked = streamerMode;
}

function applyStreamerMode() {
  document.body.classList.toggle('streamer-mode-active', streamerMode);
  const btn = document.getElementById('btn-toggle-streamer-quick');
  if (btn) {
    btn.style.color = streamerMode ? '#a855f7' : 'var(--text-muted)';
  }
}

// Initial apply
document.addEventListener('DOMContentLoaded', () => {
  applyStreamerMode();
});

// --- DIAGNOSTIC LOGS COPIER ---
async function copyDiagnosticLogs() {
  try {
    const storeData = await window.api.getStore();
    const instId = storeData.selected_instance_id || null;
    const res = await window.api.getCrashLogs(instId);

    if (res && res.success && res.log) {
      const formattedLog = `=== EsquizoLauncher Diagnóstico ===\nFecha: ${new Date().toLocaleString()}\nInstancia: ${instId || 'General'}\nArchivo: ${res.fullPath}\n====================================\n\n${res.log}`;
      await navigator.clipboard.writeText(formattedLog);
      showToast('📋 Logs de Minecraft copiados al portapapeles');
    } else {
      showToast(res.log || 'No se encontraron registros de error recientes.');
    }
  } catch (err) {
    showToast('Error al obtener los logs de diagnóstico');
  }
}
