const DiscordRPC = require('discord-rpc');
const config = require('./config');
const store = require('./store');

let currentClientId = null;
let rpc = null;
let isConnected = false;
let startPlayTimestamp = null;
let reconnectInterval = null;
let lastActivity = null;

function getActiveClientId() {
  try {
    const settings = store.getSettings();
    if (settings && settings.discord_client_id && settings.discord_client_id.trim()) {
      return settings.discord_client_id.trim();
    }
  } catch (e) {}
  return config.DEFAULT_DISCORD_CLIENT_ID || '1342674338947268688';
}

function initRpc(customClientId = null) {
  const clientId = customClientId || getActiveClientId();

  // If already connected with same client ID, do not recreate
  if (rpc && isConnected && currentClientId === clientId) {
    return;
  }

  // Destroy previous client if client ID changed
  if (rpc) {
    try {
      rpc.destroy();
    } catch (e) {}
    rpc = null;
    isConnected = false;
  }

  currentClientId = clientId;

  try {
    DiscordRPC.register(clientId);
    rpc = new DiscordRPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      isConnected = true;
      console.log(`[Discord RPC] Conectado exitosamente con Discord (App ID: ${clientId})`);
      if (lastActivity) {
        applyActivity(lastActivity);
      } else {
        setStandby();
      }
    });

    rpc.on('disconnected', () => {
      isConnected = false;
      console.log('[Discord RPC] Conexión con Discord perdida. Intentando reconectar...');
    });

    attemptLogin();

    // Start background reconnect monitor if not already running
    if (!reconnectInterval) {
      reconnectInterval = setInterval(() => {
        if (!isConnected && rpc) {
          attemptLogin();
        }
      }, 15000);
    }
  } catch (err) {
    console.warn('[Discord RPC] Error inicializando cliente RPC:', err.message);
  }
}

function attemptLogin() {
  if (!rpc || isConnected || !currentClientId) return;
  rpc.login({ clientId: currentClientId }).catch(err => {
    // If Discord is closed or App ID unknown, handle gracefully
    isConnected = false;
    console.log(`[Discord RPC] Estado: no conectado (${err.message})`);
  });
}

function applyActivity(activity) {
  lastActivity = activity;
  if (!rpc || !isConnected) return;
  try {
    rpc.setActivity(activity).catch(err => {
      console.warn('[Discord RPC] Error estableciendo actividad:', err.message);
    });
  } catch (e) {}
}

function setStandby() {
  startPlayTimestamp = null;
  applyActivity({
    details: 'EsquizoLauncher',
    state: 'En el inicio',
    largeImageKey: 'esquizo',
    largeImageText: 'EsquizoStudios',
    instance: false
  });
}

function setDownloading(assetDetail = 'Descargando assets') {
  applyActivity({
    details: 'EsquizoLauncher',
    state: assetDetail || 'Descargando assets',
    largeImageKey: 'esquizo',
    largeImageText: 'EsquizoStudios - Descargando',
    instance: false
  });
}

function setPlaying(instanceName, isMultiplayer = false, logoUrl = null) {
  if (!startPlayTimestamp) {
    startPlayTimestamp = Date.now();
  }

  const mode = isMultiplayer ? 'Multiplayer' : 'Singleplayer';
  const cleanName = instanceName || 'Evento';

  applyActivity({
    details: 'EsquizoLauncher',
    state: `Jugando ${mode}, ${cleanName}`,
    largeImageKey: logoUrl || 'esquizo',
    largeImageText: cleanName,
    smallImageKey: 'esquizo',
    smallImageText: 'EsquizoStudios',
    startTimestamp: startPlayTimestamp,
    instance: false
  });
}

module.exports = {
  initRpc,
  setStandby,
  setDownloading,
  setPlaying,
  getActiveClientId
};
