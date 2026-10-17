let currentSelectedInstance = null;
let lastContinueInstance = null;

function updateDynamicGreeting(username, skinUrl) {
  const now = new Date();
  const hour = now.getHours();
  let greetingPrefix = '¡Buenos Días,';

  if (hour >= 13 && hour < 20) {
    greetingPrefix = '¡Buenas Tardes,';
  } else if (hour >= 20 || hour < 6) {
    greetingPrefix = '¡Buenas Noches,';
  }

  const timeEl = document.getElementById('greeting-time-text');
  const nickEl = document.getElementById('greeting-player-nick');
  const headEl = document.getElementById('greeting-avatar-head');

  if (timeEl) timeEl.textContent = greetingPrefix;
  if (nickEl) nickEl.textContent = username || 'Jugador';
  if (headEl) {
    headEl.src = skinUrl || `https://minotar.net/avatar/${username || 'Steve'}/64.png`;
  }
}

async function showHomeView() {
  document.querySelectorAll('.panel-screen').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-home').classList.add('active');

  // Reset wallpaper to default
  const backdrop = document.getElementById('wallpaper-backdrop');
  backdrop.style.backgroundImage = 'radial-gradient(circle at 70% 30%, #311b92 0%, #07050e 75%)';

  // Load "Continuar Jugando" with last played instance
  try {
    const storeData = await window.api.getStore();
    const instances = storeData.instances || [];
    const lastId = storeData.last_played_instance_id;
    let targetInst = instances.find(i => i.id === lastId);
    if (!targetInst && instances.length > 0) {
      targetInst = instances[0];
    }

    const container = document.getElementById('continue-playing-container');
    if (targetInst && container) {
      lastContinueInstance = targetInst;
      const apiUrl = storeData.settings?.api_url || 'http://localhost:3001';
      document.getElementById('continue-inst-title').textContent = targetInst.name || targetInst.id;
      document.getElementById('continue-inst-version').textContent = `MC ${targetInst.mc_version || '1.20.1'}`;
      document.getElementById('continue-inst-loader').textContent = (targetInst.loader?.type || 'Fabric').toUpperCase();

      const logoEl = document.getElementById('continue-inst-logo');
      if (targetInst.logo) {
        logoEl.src = `${apiUrl}${targetInst.logo}`;
      } else {
        logoEl.src = 'assets/default-instance.png';
      }
      container.style.display = 'block';
    } else if (container) {
      container.style.display = 'none';
      lastContinueInstance = null;
    }
  } catch (err) {
    console.warn('Error loading continue playing instance:', err);
  }
}

async function triggerPlayLastInstance() {
  if (!lastContinueInstance) return;
  await selectInstance(lastContinueInstance.id);
  triggerPlayInstance();
}

async function showInstanceView(instanceId) {
  const storeData = await window.api.getStore();
  const inst = (storeData.instances || []).find(i => i.id === instanceId);
  if (!inst) return;

  currentSelectedInstance = inst;

  document.querySelectorAll('.panel-screen').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-instance').classList.add('active');

  // Metadata
  document.getElementById('inst-view-title').textContent = inst.name || inst.id;
  document.getElementById('inst-view-description').textContent = inst.description || 'Instancia oficial para los eventos organizados por EsquizoStudios.';
  document.getElementById('inst-view-version').textContent = `Minecraft ${inst.mc_version || '1.20.1'}`;
  document.getElementById('inst-view-loader').textContent = (inst.loader?.type || 'Fabric').toUpperCase();

  const apiUrl = storeData.settings.api_url || 'http://localhost:3001';

  // Logo
  const logoEl = document.getElementById('inst-view-logo');
  if (inst.logo) {
    logoEl.src = `${apiUrl}${inst.logo}`;
  } else {
    logoEl.src = 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23a855f7\' stroke-width=\'2\'><rect x=\'3\' y=\'3\' width=\'18\' height=\'18\' rx=\'2\'/></svg>';
  }

  // Banner / Wallpaper
  const backdrop = document.getElementById('wallpaper-backdrop');
  if (inst.banner) {
    backdrop.style.backgroundImage = `url('${apiUrl}${inst.banner}')`;
  } else {
    backdrop.style.backgroundImage = 'radial-gradient(circle at 70% 30%, #2e1065 0%, #07050e 75%)';
  }

  // Reset Play Button State
  resetPlayButton();
}

function resetPlayButton() {
  const btn = document.getElementById('btn-play-game');
  btn.disabled = false;
  document.getElementById('btn-play-label').textContent = 'JUGAR';
  document.getElementById('launch-progress-container').style.display = 'none';
  document.getElementById('launch-progress-bar').style.width = '0%';
}

// PLAY INSTANCE ACTION
async function triggerPlayInstance() {
  if (!currentSelectedInstance) return;

  const btn = document.getElementById('btn-play-game');
  btn.disabled = true;

  const progressContainer = document.getElementById('launch-progress-container');
  const progressBar = document.getElementById('launch-progress-bar');
  const statusText = document.getElementById('launch-status-text');
  const percentText = document.getElementById('launch-status-percent');

  progressContainer.style.display = 'flex';
  statusText.textContent = 'Verificando estado con EsquizoStudios...';
  percentText.textContent = '0%';
  progressBar.style.width = '0%';

  try {
    const res = await window.api.launchGame(currentSelectedInstance.id);
    if (!res.success) {
      alert(`No se pudo iniciar el juego: ${res.error}`);
      resetPlayButton();
    }
  } catch (err) {
    alert(`Error al iniciar Minecraft: ${err.message}`);
    resetPlayButton();
  }
}

// Setup IPC listeners for game progress and state
function setupGameEventListeners() {
  window.api.onLaunchProgress((data) => {
    const progressBar = document.getElementById('launch-progress-bar');
    const statusText = document.getElementById('launch-status-text');
    const percentText = document.getElementById('launch-status-percent');

    if (progressBar && statusText) {
      progressBar.style.width = `${data.percent || 0}%`;
      percentText.textContent = `${data.percent || 0}%`;
      statusText.textContent = data.message || 'Cargando...';
    }
  });

  window.api.onGameState(({ state, detail }) => {
    const btn = document.getElementById('btn-play-game');
    const btnLabel = document.getElementById('btn-play-label');
    const progressContainer = document.getElementById('launch-progress-container');

    if (state === 'running') {
      btnLabel.textContent = 'EN JUEGO';
      btn.disabled = true;
      progressContainer.style.display = 'none';
    } else if (state === 'stopped') {
      // Game closed -> mods deleted automatically by anti-leak cleaner!
      console.log('[UI] Juego cerrado. Mods borrados automáticamente por seguridad.');
      resetPlayButton();
    } else if (state === 'error') {
      alert(`Error en Minecraft: ${detail.error}`);
      resetPlayButton();
    }
  });
}
