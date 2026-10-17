const path = require('path');
const fs = require('fs');
const { Client } = require('minecraft-launcher-core');
const config = require('../config');
const store = require('../store');
const { ensureJavaRuntime, resolveJavaPath } = require('./java');
const { prepareInstance } = require('./downloader');
const { cleanInstanceMods } = require('./cleaner');
const { syncScreenshots } = require('../gallery');

let activeMinecraftProcess = null;
let activeInstanceId = null;

// Fail-safe cleanup if the launcher app itself is closed prematurely
process.on('exit', () => {
  if (activeInstanceId) {
    cleanInstanceMods(activeInstanceId);
  }
});
process.on('SIGINT', () => {
  if (activeInstanceId) {
    cleanInstanceMods(activeInstanceId);
  }
  process.exit();
});

/**
 * Launches an instance of Minecraft with full anti-leak mod protection and real file execution.
 *
 * @param {string} instanceId - Unique private ID of the instance
 * @param {Object} account - Current user account object
 * @param {Function} onProgress - Progress reporter ({ step, percent, message })
 * @param {Function} onStateChange - State reporter (status, detail)
 */
async function launchGame(instanceId, account, onProgress = () => {}, onStateChange = () => {}) {
  if (activeMinecraftProcess) {
    throw new Error('Ya hay una instancia de Minecraft ejecutándose en este momento.');
  }

  activeInstanceId = instanceId;

  try {
    // 1. Prepare and update files (overrides, mods, vanilla jar, and fabric loader profile)
    const prepData = await prepareInstance(instanceId, onProgress);
    const instanceDir = prepData.instanceDir;

    // 2. Automatically detect and ensure compatible Java runtime (downloading if missing)
    const javaPath = await ensureJavaRuntime(prepData.mcVersion, onProgress);

    // 3. Resolve RAM allocations
    const settings = store.getSettings();
    const ramMin = settings.ram_min || 2048;
    const ramMax = settings.ram_max || 4096;

    // 4. Initialize Minecraft Launcher Core
    const launcher = new Client();

    launcher.on('progress', (e) => {
      let pct = 75;
      if (e.total > 0) {
        pct = Math.min(95, Math.round(75 + (e.task / e.total) * 20));
      }
      const labels = {
        'assets': 'Descargando recursos de Minecraft',
        'classes': 'Descargando librerías oficiales',
        'classes-custom': 'Descargando librerías de Fabric',
        'natives': 'Extrayendo componentes gráficos nativos'
      };
      const label = labels[e.type] || `Descargando componentes (${e.type})`;
      onProgress({
        step: e.type,
        percent: pct,
        message: `${label} (${e.task}/${e.total})...`
      });
    });

    launcher.on('data', (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[Minecraft] ${line}`);
    });

    launcher.on('debug', (debug) => {
      console.log(`[Launcher Debug] ${debug}`);
    });

    launcher.on('close', (code) => {
      console.log(`[Launcher] Minecraft finalizado (código de salida: ${code}).`);
      console.log(`[Launcher] Ejecutando borrado seguro de mods para proteger los assets de EsquizoStudios...`);

      // DELETE MODS IMMEDIATELY AND SILENTLY (ANTI-LEAK PROTOCOL)
      cleanInstanceMods(instanceId);

      // Ensure any screenshots are synced to central gallery
      syncScreenshots(instanceDir);

      activeMinecraftProcess = null;
      activeInstanceId = null;
      onStateChange('stopped', { code });
    });

    const mclcOptions = {
      authorization: {
        access_token: account.token || 'offline_token',
        client_token: account.uuid || '00000000-0000-0000-0000-000000000000',
        uuid: account.uuid || '00000000-0000-0000-0000-000000000000',
        name: account.username,
        user_properties: '{}',
        meta: {
          type: account.type === 'microsoft' ? 'msa' : 'mojang'
        }
      },
      root: config.PATHS.ROOT,
      javaPath: javaPath,
      version: {
        number: prepData.mcVersion,
        type: 'release',
        custom: prepData.fabricVersionId || undefined
      },
      memory: {
        min: `${ramMin}M`,
        max: `${ramMax}M`
      },
      overrides: {
        detached: false,
        gameDirectory: instanceDir,
        cwd: instanceDir,
        assetIndex: prepData.mcVersion,
        assetRoot: config.PATHS.ASSETS,
        minecraftJar: path.join(config.PATHS.ROOT, 'versions', prepData.mcVersion, `${prepData.mcVersion}.jar`)
      },
      customArgs: [
        `-Dminecraft.launcher.brand=${config.APP_TITLE}`,
        `-Dminecraft.launcher.version=${config.VERSION}`
      ]
    };

    onProgress({ step: 'launching', percent: 98, message: '¡Iniciando ventana de Minecraft!' });
    onStateChange('launching', { javaPath, instanceDir });

    console.log(`[Launcher] Iniciando Minecraft con runtime: ${javaPath}`);
    console.log(`[Launcher] Carpeta de instancia: ${instanceDir}`);

    const proc = await launcher.launch(mclcOptions);

    if (!proc) {
      throw new Error('No se pudo iniciar el proceso de Minecraft. Verifica que la versión de Java sea compatible.');
    }

    activeMinecraftProcess = proc;
    onStateChange('running', { pid: proc.pid });
    onProgress({ step: 'running', percent: 100, message: '¡Minecraft en ejecución!' });

    proc.on('error', (err) => {
      console.error(`[Launcher] Error del proceso de Minecraft:`, err.message);

      // Clean mods in case of failure as well
      cleanInstanceMods(instanceId);

      activeMinecraftProcess = null;
      activeInstanceId = null;
      onStateChange('error', { error: err.message });
    });

    return { pid: proc.pid };
  } catch (err) {
    // If any error occurs prior to launch, ensure no leaked files
    cleanInstanceMods(instanceId);
    activeMinecraftProcess = null;
    activeInstanceId = null;
    throw err;
  }
}

function isGameRunning() {
  return !!activeMinecraftProcess;
}

function killActiveGame() {
  if (activeMinecraftProcess) {
    activeMinecraftProcess.kill();
  }
}

module.exports = {
  launchGame,
  isGameRunning,
  killActiveGame
};
