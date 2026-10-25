const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const config = require('./src/config');
const store = require('./src/store');
const api = require('./src/api');
const offlineAuth = require('./src/auth/offline');
const msAuth = require('./src/auth/microsoft');
const { launchGame, isGameRunning } = require('./src/minecraft/launcher');
const { findJavaInstallations } = require('./src/minecraft/java');
const {
  getScreenshots,
  openScreenshotsFolder,
  copyScreenshotToClipboard,
  deleteScreenshot,
  showScreenshotInFolder
} = require('./src/gallery');
const discordRpc = require('./src/discord-rpc');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 980,
    minHeight: 620,
    frame: false,
    backgroundColor: '#090714',
    icon: path.join(__dirname, 'renderer', 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  discordRpc.initRpc();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Setup IPC
function setupIpcHandlers() {
  // Store
  ipcMain.handle('store:get', () => {
    return store.data;
  });

  ipcMain.handle('store:accept-tos', () => {
    store.acceptTos();
    return true;
  });

  // Auth: Offline
  ipcMain.handle('auth:login-offline', async (event, data) => {
    try {
      const account = await offlineAuth.loginOffline(data);
      store.setCurrentAccount(account);
      return { success: true, account };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Auth: Microsoft Device Code Flow
  ipcMain.handle('auth:start-microsoft-device', async () => {
    try {
      const codeData = await msAuth.startDeviceAuth();
      return { success: true, ...codeData };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:poll-microsoft-device', async (event, deviceCode, interval) => {
    try {
      const account = await msAuth.pollDeviceAuth(deviceCode, interval, (msg) => {
        if (mainWindow) {
          mainWindow.webContents.send('auth:ms-progress', msg);
        }
      });
      store.setCurrentAccount(account);
      return { success: true, account };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:unlink-discord', async (event, username) => {
    try {
      const res = await api.unlinkDiscord(username);
      if (res.success) {
        store.unlinkDiscordCurrentAccount();
        return { success: true };
      }
      return { success: false, error: res.message || 'Error al desvincular' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:logout', () => {
    store.logout();
    return true;
  });

  ipcMain.handle('auth:discord-client-start', async () => {
    try {
      const res = await api.startDiscordClientAuth();
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:discord-client-poll', async (event, sessionId) => {
    try {
      const res = await api.pollDiscordClientAuth(sessionId);
      return res;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('auth:switch-account', (event, account) => {
    store.setCurrentAccount(account);
    return true;
  });

  // Instances
  ipcMain.handle('instance:claim', async (event, accessCode) => {
    try {
      const res = await api.claimInstance(accessCode);
      if (res.success && res.instance) {
        store.addInstance(res.instance);
        return { success: true, instance: res.instance };
      }
      return { success: false, error: res.error || 'Código inválido' };
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      return { success: false, error: errMsg };
    }
  });

  ipcMain.handle('instance:select', (event, id) => {
    store.setSelectedInstanceId(id);
    return true;
  });

  ipcMain.handle('instance:remove', (event, id) => {
    store.removeInstance(id);
    return true;
  });

  // Game Launcher
  ipcMain.handle('game:launch', async (event, instanceId) => {
    const account = store.getCurrentAccount();
    if (!account) {
      return { success: false, error: 'Debes iniciar sesión para jugar.' };
    }

    // Save as last played instance
    store.setLastPlayedInstanceId(instanceId);
    const instance = store.getInstance(instanceId);

    try {
      await launchGame(
        instanceId,
        account,
        (progress) => {
          if (mainWindow) {
            mainWindow.webContents.send('game:progress', progress);
          }
          discordRpc.setDownloading(progress.message || 'Descargando assets');
        },
        (state, detail) => {
          if (mainWindow) {
            mainWindow.webContents.send('game:state', { state, detail });
          }

          const settings = store.getSettings();
          if (state === 'running') {
            discordRpc.setPlaying(instance ? instance.name : instanceId, false, instance?.logo);

            if (settings.action_on_play === 'minimize' && mainWindow) {
              mainWindow.minimize();
            } else if (settings.action_on_play === 'hide' && mainWindow) {
              mainWindow.hide();
            }
          } else if (state === 'stopped' || state === 'error') {
            discordRpc.setStandby();

            if (settings.action_on_play === 'hide' && mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          }
        }
      );
      return { success: true };
    } catch (err) {
      discordRpc.setStandby();
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('game:is-running', () => {
    return isGameRunning();
  });

  // Gallery
  ipcMain.handle('gallery:get', (event, instanceId) => {
    return getScreenshots(instanceId);
  });

  ipcMain.handle('gallery:open-folder', (event, instanceId) => {
    openScreenshotsFolder(instanceId);
    return true;
  });

  ipcMain.handle('gallery:copy', (event, filePath) => {
    try {
      return { success: copyScreenshotToClipboard(filePath) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('gallery:delete', (event, filePath) => {
    try {
      return { success: deleteScreenshot(filePath) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('gallery:show-in-folder', (event, filePath) => {
    try {
      return { success: showScreenshotInFolder(filePath) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Settings
  ipcMain.handle('settings:get', () => {
    return store.getSettings();
  });

  ipcMain.handle('settings:update', (event, newSettings) => {
    const prevId = store.getSettings().discord_client_id;
    const updated = store.updateSettings(newSettings);
    if (newSettings && newSettings.discord_client_id !== undefined && newSettings.discord_client_id !== prevId) {
      discordRpc.initRpc(newSettings.discord_client_id);
    }
    return updated;
  });

  ipcMain.handle('system:get-javas', () => {
    return findJavaInstallations();
  });

  ipcMain.handle('system:browse-java', async () => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar ejecutable de Java (javaw.exe)',
      filters: [{ name: 'Ejecutable Java', extensions: ['exe'] }],
      properties: ['openFile']
    });
    if (!res.canceled && res.filePaths.length > 0) {
      return res.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('system:open-url', (event, url) => {
    if (url) {
      shell.openExternal(url);
    }
    return true;
  });

  // Client Auto-Updates
  ipcMain.handle('updater:check', async () => {
    try {
      const data = await api.checkClientUpdate(config.VERSION);
      return { success: true, ...data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('updater:download-and-install', async (event, downloadUrl) => {
    try {
      const axios = require('axios');
      const fs = require('fs');
      const os = require('os');
      const { spawn } = require('child_process');

      const fullUrl = downloadUrl.startsWith('http')
        ? downloadUrl
        : `${api.getBaseUrl()}${downloadUrl}`;

      const tempInstallerPath = path.join(os.tmpdir(), `EsquizoLauncher-Setup-Update-${Date.now()}.exe`);

      const response = await axios({
        method: 'GET',
        url: fullUrl,
        responseType: 'stream',
        timeout: 120000
      });

      const total = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;

      const writer = fs.createWriteStream(tempInstallerPath);
      response.data.on('data', chunk => {
        downloaded += chunk.length;
        const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0;
        if (mainWindow) {
          mainWindow.webContents.send('updater:progress', { downloaded, total, percent });
        }
      });

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Spawn installer detached and exit launcher
      setTimeout(() => {
        spawn(tempInstallerPath, ['--updated'], {
          detached: true,
          stdio: 'ignore'
        }).unref();
        app.quit();
      }, 800);

      return { success: true };
    } catch (err) {
      console.error('[Auto-Update Error]', err);
      return { success: false, error: err.message };
    }
  });

  // Window Controls
  ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    if (mainWindow) mainWindow.close();
  });
}
