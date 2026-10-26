const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Store & State
  getStore: () => ipcRenderer.invoke('store:get'),
  acceptTos: () => ipcRenderer.invoke('store:accept-tos'),

  // Auth
  loginOffline: (data) => ipcRenderer.invoke('auth:login-offline', data),
  startMicrosoftDevice: () => ipcRenderer.invoke('auth:start-microsoft-device'),
  pollMicrosoftDevice: (deviceCode, interval) => ipcRenderer.invoke('auth:poll-microsoft-device', deviceCode, interval),
  onMicrosoftProgress: (callback) => {
    const handler = (event, msg) => callback(msg);
    ipcRenderer.on('auth:ms-progress', handler);
    return () => ipcRenderer.removeListener('auth:ms-progress', handler);
  },
  startDiscordOAuth: () => ipcRenderer.invoke('auth:discord-client-start'),
  pollDiscordOAuth: (sessionId) => ipcRenderer.invoke('auth:discord-client-poll', sessionId),
  unlinkDiscord: (username) => ipcRenderer.invoke('auth:unlink-discord', username),
  logout: () => ipcRenderer.invoke('auth:logout'),
  switchAccount: (account) => ipcRenderer.invoke('auth:switch-account', account),

  // Instances
  claimInstance: (accessCode) => ipcRenderer.invoke('instance:claim', accessCode),
  selectInstance: (id) => ipcRenderer.invoke('instance:select', id),
  removeInstance: (id) => ipcRenderer.invoke('instance:remove', id),

  // Game Launcher
  launchGame: (instanceId) => ipcRenderer.invoke('game:launch', instanceId),
  isGameRunning: () => ipcRenderer.invoke('game:is-running'),
  onLaunchProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('game:progress', handler);
    return () => ipcRenderer.removeListener('game:progress', handler);
  },
  onGameState: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('game:state', handler);
    return () => ipcRenderer.removeListener('game:state', handler);
  },

  // Gallery
  getScreenshots: (instanceId) => ipcRenderer.invoke('gallery:get', instanceId),
  openScreenshotsFolder: (instanceId) => ipcRenderer.invoke('gallery:open-folder', instanceId),
  copyScreenshot: (filePath) => ipcRenderer.invoke('gallery:copy', filePath),
  deleteScreenshot: (filePath) => ipcRenderer.invoke('gallery:delete', filePath),
  showScreenshotInFolder: (filePath) => ipcRenderer.invoke('gallery:show-in-folder', filePath),

  // Settings & System
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  getJavaList: () => ipcRenderer.invoke('system:get-javas'),
  browseJavaPath: () => ipcRenderer.invoke('system:browse-java'),
  openExternalUrl: (url) => ipcRenderer.invoke('system:open-url', url),
  getServerStatus: (instanceId) => ipcRenderer.invoke('instance:server-status', instanceId),
  getCrashLogs: (instanceId) => ipcRenderer.invoke('system:get-crash-logs', instanceId),

  // Auto-Updates
  checkUpdate: () => ipcRenderer.invoke('updater:check'),
  downloadAndInstallUpdate: (downloadUrl) => ipcRenderer.invoke('updater:download-and-install', downloadUrl),
  onUpdateProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('updater:progress', handler);
    return () => ipcRenderer.removeListener('updater:progress', handler);
  },

  // Telemetry & Broadcast
  sendHeartbeat: (data) => ipcRenderer.invoke('telemetry:heartbeat', data),
  onBroadcastAlert: (callback) => {
    const handler = (event, alert) => callback(alert);
    ipcRenderer.on('telemetry:broadcast', handler);
    return () => ipcRenderer.removeListener('telemetry:broadcast', handler);
  },

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close')
});
