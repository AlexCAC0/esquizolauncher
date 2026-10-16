const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Store & State
  getStore: () => ipcRenderer.invoke('store:get'),
  acceptTos: () => ipcRenderer.invoke('store:accept-tos'),

  // Auth
  loginOffline: (data) => ipcRenderer.invoke('auth:login-offline', data),
  startMicrosoftDevice: () => ipcRenderer.invoke('auth:start-microsoft-device'),
  pollMicrosoftDevice: (deviceCode, interval) => ipcRenderer.invoke('auth:poll-microsoft-device', deviceCode, interval),
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

  // Settings & System
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  getJavaList: () => ipcRenderer.invoke('system:get-javas'),
  browseJavaPath: () => ipcRenderer.invoke('system:browse-java'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close')
});
