const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const config = require('./config');
const store = require('./store');

/**
 * Retrieves all F2 screenshots from instances and common folders.
 */
function getScreenshots(selectedInstanceId = null) {
  const screenshots = [];

  const dirsToScan = [];

  if (selectedInstanceId) {
    const instDir = path.join(config.PATHS.INSTANCES, selectedInstanceId, 'screenshots');
    dirsToScan.push({ dir: instDir, instanceId: selectedInstanceId });
  } else {
    // Scan all registered instances
    const instances = store.getInstances();
    instances.forEach(inst => {
      const instDir = path.join(config.PATHS.INSTANCES, inst.id, 'screenshots');
      dirsToScan.push({ dir: instDir, instanceId: inst.id });
    });

    // Also scan common .minecraft if exists
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
        console.error(`[Gallery] Error scanning ${dir}:`, err);
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
  if (instanceId) {
    targetDir = path.join(config.PATHS.INSTANCES, instanceId, 'screenshots');
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  shell.openPath(targetDir);
}

module.exports = {
  getScreenshots,
  openScreenshotsFolder
};
