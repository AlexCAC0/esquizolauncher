const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const config = require('./config');
const store = require('./store');

/**
 * Links an instance's screenshots directory to the central launcher screenshots folder
 * via an NTFS directory junction on Windows.
 * This guarantees that when the player presses F2 in Minecraft, the screenshot is saved
 * directly into the launcher's central screenshots directory (%APPDATA%/.esquizolauncher/screenshots).
 *
 * @param {string} instanceDir - Absolute path to the instance directory
 */
function linkScreenshotsFolder(instanceDir) {
  const commonDir = config.PATHS.SCREENSHOTS_COMMON;
  if (!fs.existsSync(commonDir)) {
    fs.mkdirSync(commonDir, { recursive: true });
  }

  const instScreenshots = path.join(instanceDir, 'screenshots');

  try {
    let isLink = false;
    try {
      const lstat = fs.lstatSync(instScreenshots);
      isLink = lstat.isSymbolicLink();
    } catch (e) {}

    if (isLink) {
      return; // Already linked
    }

    // If it's a regular directory, migrate existing screenshots to central folder
    if (fs.existsSync(instScreenshots)) {
      const existingFiles = fs.readdirSync(instScreenshots);
      for (const file of existingFiles) {
        const src = path.join(instScreenshots, file);
        const dst = path.join(commonDir, file);
        if (!fs.existsSync(dst)) {
          try {
            fs.copyFileSync(src, dst);
          } catch (e) {}
        }
        try { fs.unlinkSync(src); } catch (e) {}
      }
      fs.rmdirSync(instScreenshots);
    }

    // Create the junction
    fs.symlinkSync(commonDir, instScreenshots, 'junction');
    console.log(`[Gallery] Enlazada carpeta screenshots de '${path.basename(instanceDir)}' hacia central: ${commonDir}`);
  } catch (err) {
    console.warn(`[Gallery] Advertencia al crear junction para screenshots (${err.message}). Creando carpeta estándar.`);
    if (!fs.existsSync(instScreenshots)) {
      fs.mkdirSync(instScreenshots, { recursive: true });
    }
  }
}

/**
 * Fallback synchronizer: copies any screenshot files from the instance folder to the central gallery
 */
function syncScreenshots(instanceDir) {
  const commonDir = config.PATHS.SCREENSHOTS_COMMON;
  const instScreenshots = path.join(instanceDir, 'screenshots');

  if (!fs.existsSync(commonDir)) {
    fs.mkdirSync(commonDir, { recursive: true });
  }

  if (fs.existsSync(instScreenshots)) {
    try {
      const files = fs.readdirSync(instScreenshots);
      for (const file of files) {
        if (/\.(png|jpe?g)$/i.test(file)) {
          const src = path.join(instScreenshots, file);
          const dst = path.join(commonDir, file);
          if (!fs.existsSync(dst)) {
            try {
              fs.copyFileSync(src, dst);
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.warn(`[Gallery] Error en sincronización de screenshots:`, err.message);
    }
  }
}

/**
 * Retrieves all F2 screenshots from the central launcher folder and instances.
 */
function getScreenshots(selectedInstanceId = null) {
  const screenshots = [];
  const scannedPaths = new Set();
  const dirsToScan = [];

  // 1. Central Launcher Screenshots Folder (Primary source)
  dirsToScan.push({ dir: config.PATHS.SCREENSHOTS_COMMON, instanceId: 'launcher' });

  // 2. Specific or all instances
  if (selectedInstanceId) {
    const instDir = path.join(config.PATHS.INSTANCES, selectedInstanceId, 'screenshots');
    dirsToScan.push({ dir: instDir, instanceId: selectedInstanceId });
  } else {
    const instances = store.getInstances();
    instances.forEach(inst => {
      const instDir = path.join(config.PATHS.INSTANCES, inst.id, 'screenshots');
      dirsToScan.push({ dir: instDir, instanceId: inst.id });
    });

    // Also check standard .minecraft if it exists
    const defaultMcScreenshots = path.join(
      process.env.APPDATA || '',
      '.minecraft',
      'screenshots'
    );
    if (fs.existsSync(defaultMcScreenshots)) {
      dirsToScan.push({ dir: defaultMcScreenshots, instanceId: 'minecraft' });
    }
  }

  dirsToScan.forEach(({ dir, instanceId }) => {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          if (/\.(png|jpe?g)$/i.test(file)) {
            const fullPath = path.join(dir, file);

            // Resolve real path in case of junctions/symlinks to avoid duplicate cards
            let canonical = fullPath;
            try {
              canonical = fs.realpathSync(fullPath);
            } catch (e) {}

            if (scannedPaths.has(canonical.toLowerCase())) return;
            scannedPaths.add(canonical.toLowerCase());

            try {
              const stat = fs.statSync(fullPath);
              screenshots.push({
                filename: file,
                path: fullPath,
                url: `file://${fullPath.replace(/\\/g, '/')}`,
                date: stat.mtime.toISOString(),
                size: stat.size,
                instanceId
              });
            } catch (e) {}
          }
        });
      } catch (err) {
        console.error(`[Gallery] Error al escanear directorio ${dir}:`, err);
      }
    }
  });

  // Sort newest first
  screenshots.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return screenshots;
}

/**
 * Opens screenshots folder in Windows Explorer
 */
function openScreenshotsFolder(instanceId = null) {
  let targetDir = config.PATHS.SCREENSHOTS_COMMON;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  shell.openPath(targetDir);
}

const { clipboard, nativeImage } = require('electron');

/**
 * Copies the image file directly to the system clipboard as image data
 */
function copyScreenshotToClipboard(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('El archivo de captura no existe.');
  }
  const img = nativeImage.createFromPath(filePath);
  clipboard.writeImage(img);
  return true;
}

/**
 * Deletes a screenshot file from disk
 */
function deleteScreenshot(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * Reveals screenshot in Windows Explorer
 */
function showScreenshotInFolder(filePath) {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
}

module.exports = {
  linkScreenshotsFolder,
  syncScreenshots,
  getScreenshots,
  openScreenshotsFolder,
  copyScreenshotToClipboard,
  deleteScreenshot,
  showScreenshotInFolder
};
