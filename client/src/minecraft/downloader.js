const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const store = require('../store');
const api = require('../api');
const { linkScreenshotsFolder } = require('../gallery');

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
 * Ensures the vanilla Minecraft client JAR and version JSON exist locally in versions/<mcVersion>/
 */
async function ensureVanillaJar(mcVersion, onProgress = () => {}) {
  const versionDir = path.join(config.PATHS.ROOT, 'versions', mcVersion);
  const jarPath = path.join(versionDir, `${mcVersion}.jar`);
  const jsonPath = path.join(versionDir, `${mcVersion}.json`);

  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  let verData = null;
  if (!fs.existsSync(jsonPath)) {
    onProgress({ step: 'vanilla_meta', percent: 50, message: `Consultando versión de Minecraft ${mcVersion}...` });
    const manifestRes = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 15000 });
    const verInfo = (manifestRes.data.versions || []).find(v => v.id === mcVersion);
    if (!verInfo) {
      throw new Error(`La versión de Minecraft '${mcVersion}' no fue encontrada en los servidores de Mojang.`);
    }

    const verRes = await axios.get(verInfo.url, { timeout: 15000 });
    verData = verRes.data;
    fs.writeFileSync(jsonPath, JSON.stringify(verData, null, 2), 'utf8');
  } else {
    try {
      verData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
      // Re-download if corrupted
      const manifestRes = await axios.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', { timeout: 15000 });
      const verInfo = (manifestRes.data.versions || []).find(v => v.id === mcVersion);
      const verRes = await axios.get(verInfo.url, { timeout: 15000 });
      verData = verRes.data;
      fs.writeFileSync(jsonPath, JSON.stringify(verData, null, 2), 'utf8');
    }
  }

  if (!fs.existsSync(jarPath) && verData?.downloads?.client?.url) {
    onProgress({ step: 'vanilla_jar', percent: 55, message: `Descargando cliente base de Minecraft ${mcVersion}...` });
    const clientDownload = verData.downloads.client;
    await downloadFile(clientDownload.url, jarPath, clientDownload.sha1, (downloaded, total) => {
      if (total > 0) {
        const mbDone = (downloaded / (1024 * 1024)).toFixed(1);
        const mbTotal = (total / (1024 * 1024)).toFixed(1);
        const pct = Math.min(65, Math.round(55 + (downloaded / total) * 10));
        onProgress({ step: 'vanilla_jar', percent: pct, message: `Descargando Minecraft ${mcVersion} (${mbDone} MB / ${mbTotal} MB)` });
      }
    });
  }

  // Ensure Minecraft sound/resource asset index exists in assets/indexes/<mcVersion>.json
  // SoundManager requires this file to map and play all game audio/music
  const assetIndexesDir = path.join(config.PATHS.ASSETS, 'indexes');
  if (!fs.existsSync(assetIndexesDir)) {
    fs.mkdirSync(assetIndexesDir, { recursive: true });
  }
  const assetIndexJson = path.join(assetIndexesDir, `${mcVersion}.json`);
  if (!fs.existsSync(assetIndexJson) && verData?.assetIndex?.url) {
    onProgress({ step: 'asset_index', percent: 66, message: `Descargando índice de sonidos y recursos para Minecraft ${mcVersion}...` });
    try {
      const res = await axios.get(verData.assetIndex.url, { timeout: 15000 });
      fs.writeFileSync(assetIndexJson, JSON.stringify(res.data, null, 2), 'utf8');
      console.log(`[Assets] Guardado índice de recursos ${mcVersion}.json`);
    } catch (err) {
      console.warn(`[Assets] Error al descargar índice de recursos:`, err.message);
    }
  }

  return { jarPath, jsonPath };
}

/**
 * Downloads and prepares the Fabric Loader profile JSON if the instance uses Fabric
 */
async function prepareFabricProfile(mcVersion, loaderVersion = 'latest', onProgress = () => {}) {
  let resolvedLoader = loaderVersion;
  if (!resolvedLoader || resolvedLoader === 'latest') {
    try {
      const res = await axios.get(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`, { timeout: 10000 });
      if (Array.isArray(res.data) && res.data.length > 0) {
        resolvedLoader = res.data[0].loader?.version || '0.15.11';
      } else {
        resolvedLoader = '0.15.11';
      }
    } catch (e) {
      resolvedLoader = '0.15.11';
    }
  }

  const versionId = `fabric-loader-${resolvedLoader}-${mcVersion}`;
  const versionDir = path.join(config.PATHS.ROOT, 'versions', versionId);
  const versionJsonPath = path.join(versionDir, `${versionId}.json`);

  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  if (!fs.existsSync(versionJsonPath)) {
    onProgress({ step: 'fabric_profile', percent: 66, message: `Configurando Fabric Loader ${resolvedLoader}...` });
    try {
      const url = `https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${resolvedLoader}/profile/json`;
      const res = await axios.get(url, { timeout: 15000 });
      fs.writeFileSync(versionJsonPath, JSON.stringify(res.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Fabric] Error al obtener profile JSON:', err.message);
      throw new Error(`No se pudo obtener el perfil de Fabric para Minecraft ${mcVersion}: ${err.message}`);
    }
  }

  return versionId;
}

/**
 * Prepares and updates the instance files before launch:
 * 1. Checks for updates from Esquizo backend
 * 2. Downloads instance overrides (configs, options, etc.)
 * 3. Downloads instance mods into instances/<id>/mods/
 * 4. Ensures vanilla Minecraft base jar and fabric loader profile are downloaded
 *
 * @param {string} instanceId
 * @param {Function} onProgress - Callback ({ step, percent, message })
 */
async function prepareInstance(instanceId, onProgress = () => {}) {
  const instanceDir = path.join(config.PATHS.INSTANCES, instanceId);
  const modsDir = path.join(instanceDir, 'mods');
  const configDir = path.join(instanceDir, 'config');

  // Create standard directories and link screenshots to launcher central folder
  [instanceDir, modsDir, configDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  linkScreenshotsFolder(instanceDir);

  onProgress({ step: 'check_updates', percent: 5, message: 'Comprobando actualizaciones con EsquizoStudios...' });

  let manifest = {};
  try {
    const manifestData = await api.fetchInstanceManifest(instanceId);
    manifest = manifestData.manifest || {};
  } catch (err) {
    console.warn(`[Downloader] No se pudo obtener manifest del backend para '${instanceId}':`, err.message);
    const localInst = store.getInstance(instanceId);
    if (localInst) {
      manifest = {
        mc_version: localInst.mc_version || '1.20.1',
        loader: localInst.loader || { type: 'fabric', version: 'latest' },
        files: [],
        overrides: []
      };
    }
  }

  const files = manifest.files || [];
  const overrides = manifest.overrides || [];

  const totalItems = files.length + overrides.length;
  let completedItems = 0;

  // 1. Download Overrides (configs, options, resources)
  if (overrides.length > 0) {
    onProgress({ step: 'overrides', percent: 10, message: 'Sincronizando archivos de configuración del evento...' });

    for (const relPath of overrides) {
      const destPath = path.join(instanceDir, relPath);
      const fileUrl = `${api.getBaseUrl()}/api/client/instance/${instanceId}/file?path=${encodeURIComponent('overrides/' + relPath)}`;

      try {
        await downloadFile(fileUrl, destPath);
      } catch (err) {
        console.warn(`[Downloader] Advertencia al descargar override ${relPath}:`, err.message);
      }

      completedItems++;
      const currentPct = Math.round(10 + (completedItems / Math.max(totalItems, 1)) * 15);
      onProgress({ step: 'overrides', percent: currentPct, message: `Configurando: ${path.basename(relPath)}` });
    }
  }

  // 2. Download Ephemeral Mods
  if (files.length > 0) {
    onProgress({ step: 'mods', percent: 25, message: 'Descargando mods del evento...' });

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
      const currentPct = Math.round(25 + (completedItems / Math.max(totalItems, 1)) * 20);
      onProgress({ step: 'mods', percent: currentPct, message: `Descargando mod: ${path.basename(fileObj.path)}` });
    }
  }

  const mcVersion = manifest.mc_version || '1.20.1';
  const loader = manifest.loader || { type: 'fabric', version: 'latest' };

  // 3. Ensure Vanilla Minecraft Client Jar exists
  await ensureVanillaJar(mcVersion, onProgress);

  // 4. If loader is Fabric, prepare Fabric Profile JSON
  let fabricVersionId = null;
  if (loader && loader.type && loader.type.toLowerCase() === 'fabric') {
    fabricVersionId = await prepareFabricProfile(mcVersion, loader.version, onProgress);
  }

  // 5. Replicate asset index between vanilla and fabric version IDs
  // Ensures Minecraft SoundManager always finds the index file regardless of loader arguments
  const assetIndexesDir = path.join(config.PATHS.ASSETS, 'indexes');
  const vanillaIdx = path.join(assetIndexesDir, `${mcVersion}.json`);
  if (fabricVersionId) {
    const fabricIdx = path.join(assetIndexesDir, `${fabricVersionId}.json`);
    if (fs.existsSync(vanillaIdx) && !fs.existsSync(fabricIdx)) {
      try { fs.copyFileSync(vanillaIdx, fabricIdx); } catch (e) {}
    } else if (fs.existsSync(fabricIdx) && !fs.existsSync(vanillaIdx)) {
      try { fs.copyFileSync(fabricIdx, vanillaIdx); } catch (e) {}
    }
  }

  onProgress({ step: 'ready', percent: 70, message: '¡Archivos de instancia listos!' });

  return {
    instanceDir,
    mcVersion,
    loader,
    fabricVersionId
  };
}

module.exports = {
  downloadFile,
  ensureVanillaJar,
  prepareFabricProfile,
  prepareInstance
};
