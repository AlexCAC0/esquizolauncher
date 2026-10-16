const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const config = require('./src/config');
const store = require('./src/store');
const api = require('./src/api');
const offlineAuth = require('./src/auth/offline');
const msAuth = require('./src/auth/microsoft');
const { launchGame, isGameRunning } = require('./src/minecraft/launcher');
const { findJavaInstallations } = require('./src/minecraft/java');
const { getScreenshots, openScreenshotsFolder } = require('./src/gallery');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 980,
    minHeight: 620,
    frame: false,
    backgroundColor: '#090714',
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.png'),
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

    try {
      await launchGame(
        instanceId,
        account,
        (progress) => {
          if (mainWindow) {
            mainWindow.webContents.send('game:progress', progress);
          }
        },
        (state, detail) => {
          if (mainWindow) {
            mainWindow.webContents.send('game:state', { state, detail });
          }
        }
      );
      return { success: true };
    } catch (err) {
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

  // Settings
  ipcMain.handle('settings:get', () => {
    return store.getSettings();
  });

  ipcMain.handle('settings:update', (event, newSettings) => {
    return store.updateSettings(newSettings);
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
