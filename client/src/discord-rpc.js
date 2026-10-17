const DiscordRPC = require('discord-rpc');

// Default Discord Application ID for EsquizoLauncher Rich Presence
const CLIENT_ID = '1342674338947268688';

let rpc = null;
let isConnected = false;
let startPlayTimestamp = null;

function initRpc() {
  try {
    DiscordRPC.register(CLIENT_ID);
    rpc = new DiscordRPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      isConnected = true;
      console.log('[Discord RPC] Conectado exitosamente con Discord Rich Presence');
      setStandby();
    });

    rpc.on('disconnected', () => {
      isConnected = false;
      console.log('[Discord RPC] Desconectado de Discord');
    });

    rpc.login({ clientId: CLIENT_ID }).catch(err => {
      console.log('[Discord RPC] Discord no está abierto o no disponible:', err.message);
      isConnected = false;
    });
  } catch (err) {
    console.warn('[Discord RPC] Error inicializando cliente RPC:', err.message);
  }
}

function setStandby() {
  if (!rpc || !isConnected) return;
  startPlayTimestamp = null;
  try {
    rpc.setActivity({
      details: 'EsquizoLauncher',
      state: 'En el inicio',
      largeImageKey: 'esquizo',
      largeImageText: 'EsquizoStudios',
      instance: false
    }).catch(() => {});
  } catch (e) {}
}

function setDownloading(assetDetail = 'Descargando assets') {
  if (!rpc || !isConnected) return;
  try {
    rpc.setActivity({
      details: 'EsquizoLauncher',
      state: assetDetail || 'Descargando assets',
      largeImageKey: 'esquizo',
      largeImageText: 'EsquizoStudios - Descargando',
      instance: false
    }).catch(() => {});
  } catch (e) {}
}

function setPlaying(instanceName, isMultiplayer = false, logoUrl = null) {
  if (!rpc || !isConnected) return;
  if (!startPlayTimestamp) {
    startPlayTimestamp = Date.now();
  }

  const mode = isMultiplayer ? 'Multiplayer' : 'Singleplayer';
  const cleanName = instanceName || 'Evento';

  try {
    rpc.setActivity({
      details: 'EsquizoLauncher',
      state: `Jugando ${mode}, ${cleanName}`,
      largeImageKey: logoUrl || 'esquizo',
      largeImageText: cleanName,
      smallImageKey: 'esquizo',
      smallImageText: 'EsquizoStudios',
      startTimestamp: startPlayTimestamp,
      instance: false
    }).catch(() => {});
  } catch (e) {}
}

module.exports = {
  initRpc,
  setStandby,
  setDownloading,
  setPlaying
};
