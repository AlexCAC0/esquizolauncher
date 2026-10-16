const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const api = require('../api');

/**
 * Downloads a file to a destination path, verifying SHA1 if provided.
 */
async function downloadFile(url, destPath, expectedSha1 = null, onChunk = () => {}) {
  const parent = path.dirname(destPath);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });

  // If already exists and sha1 matches, skip
  if (fs.existsSync(destPath) && expectedSha1) {
    const existingSha1 = crypto.createHash('sha1').update(fs.readFileSync(destPath)).digest('hex');
    if (existingSha1.toLowerCase() === expectedSha1.toLowerCase()) {
      return;
    }
  }

  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    timeout: 30000
  });

  const totalLength = parseInt(response.headers['content-length'] || '0', 10);
  let downloadedLength = 0;

  const writer = fs.createWriteStream(destPath);
  response.data.on('data', chunk => {
    downloadedLength += chunk.length;
    onChunk(downloadedLength, totalLength);
  });

  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Prepares and updates the instance files before launch:
 * 1. Checks for updates from Esquizo backend
 * 2. Downloads instance overrides (configs, options, etc.)
 * 3. Downloads instance mods into instances/<id>/mods/
 *
 * @param {string} instanceId
 * @param {Function} onProgress - Callback ({ step, percent, message })
 */
async function prepareInstance(instanceId, onProgress = () => {}) {
  const instanceDir = path.join(config.PATHS.INSTANCES, instanceId);
  const modsDir = path.join(instanceDir, 'mods');
  const configDir = path.join(instanceDir, 'config');
  const screenshotsDir = path.join(instanceDir, 'screenshots');

  // Create standard directories
  [instanceDir, modsDir, configDir, screenshotsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  onProgress({ step: 'check_updates', percent: 10, message: 'Comprobando actualizaciones con EsquizoStudios...' });

  const manifestData = await api.fetchInstanceManifest(instanceId);
  const manifest = manifestData.manifest || {};

  const files = manifest.files || [];
  const overrides = manifest.overrides || [];

  const totalItems = files.length + overrides.length;
  let completedItems = 0;

  // 1. Download Overrides (configs, options, resources)
  if (overrides.length > 0) {
    onProgress({ step: 'overrides', percent: 20, message: 'Sincronizando archivos de configuración del evento...' });

    for (const relPath of overrides) {
      const destPath = path.join(instanceDir, relPath);
      const fileUrl = `${api.getBaseUrl()}/api/client/instance/${instanceId}/file?path=${encodeURIComponent('overrides/' + relPath)}`;

      try {
        await downloadFile(fileUrl, destPath);
      } catch (err) {
        console.warn(`[Downloader] Advertencia al descargar override ${relPath}:`, err.message);
      }

      completedItems++;
      const currentPct = Math.round(20 + (completedItems / Math.max(totalItems, 1)) * 30);
      onProgress({ step: 'overrides', percent: currentPct, message: `Configurando: ${path.basename(relPath)}` });
    }
  }

  // 2. Download Ephemeral Mods
  if (files.length > 0) {
    onProgress({ step: 'mods', percent: 50, message: 'Descargando mods del evento...' });

    for (const fileObj of files) {
      const targetDest = path.join(instanceDir, fileObj.path);
      const downloadUrls = fileObj.downloads || [];
      const sha1 = fileObj.hashes?.sha1 || null;

      if (downloadUrls.length > 0) {
        let downloaded = false;
        for (const url of downloadUrls) {
          try {
            await downloadFile(url, targetDest, sha1);
            downloaded = true;
            break;
          } catch (e) {
            console.warn(`[Downloader] Reintentando mod desde URL alternativa:`, e.message);
          }
        }
        if (!downloaded) {
          console.error(`[Downloader] No se pudo descargar el mod: ${fileObj.path}`);
        }
      }

      completedItems++;
      const currentPct = Math.round(50 + (completedItems / Math.max(totalItems, 1)) * 45);
      onProgress({ step: 'mods', percent: currentPct, message: `Descargando mod: ${path.basename(fileObj.path)}` });
    }
  }

  onProgress({ step: 'ready', percent: 100, message: '¡Archivos e instancia sincronizados!' });

  return {
    instanceDir,
    mcVersion: manifest.mc_version || '1.20.1',
    loader: manifest.loader || { type: 'fabric', version: 'latest' }
  };
}

module.exports = {
  downloadFile,
  prepareInstance
};
