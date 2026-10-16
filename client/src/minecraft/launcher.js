const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const store = require('../store');
const { resolveJavaPath } = require('./java');
const { prepareInstance } = require('./downloader');
const { cleanInstanceMods } = require('./cleaner');

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
 * Launches an instance of Minecraft with full anti-leak mod protection.
 *
 * @param {string} instanceId - Unique private ID of the instance
 * @param {Object} account - Current user account object
 * @param {Function} onProgress - Progress reporter ({ step, percent, message })
 * @param {Function} onStateChange - State reporter (status, detail)
 */
async function launchGame(instanceId, account, onProgress = () => {}, onStateChange = () => {}) {
  if (activeMinecraftProcess) {
    throw new Error('Ya hay una instancia de Minecraft ejecutándose.');
  }

  activeInstanceId = instanceId;

  try {
    // 1. Prepare and update files
    const prepData = await prepareInstance(instanceId, onProgress);
    const instanceDir = prepData.instanceDir;

    // 2. Resolve Java runtime
    onProgress({ step: 'java', percent: 95, message: 'Detectando entorno Java...' });
    const javaPath = resolveJavaPath(17);

    // 3. Prepare JVM & Minecraft Arguments
    const settings = store.getSettings();
    const ramMin = settings.ram_min || 2048;
    const ramMax = settings.ram_max || 4096;

    const jvmArgs = [
      `-Xms${ramMin}M`,
      `-Xmx${ramMax}M`,
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+UseG1GC',
      '-XX:G1NewSizePercent=20',
      '-XX:G1ReservePercent=20',
      '-XX:MaxGCPauseMillis=50',
      '-XX:G1HeapRegionSize=32M',
      `-Djava.library.path=${path.join(instanceDir, 'natives')}`,
      `-Dminecraft.launcher.brand=EsquizoLauncher`,
      `-Dminecraft.launcher.version=${config.VERSION}`
    ];

    const gameArgs = [
      '--username', account.username,
      '--version', `Esquizo-${instanceId}`,
      '--gameDir', instanceDir,
      '--assetsDir', config.PATHS.ASSETS,
      '--assetIndex', prepData.mcVersion,
      '--uuid', account.uuid,
      '--accessToken', account.token || 'offline_token',
      '--userType', account.type === 'microsoft' ? 'msa' : 'legacy',
      '--versionType', 'release'
    ];

    // Dummy/main class for launching. In a full production bundle, this uses net.fabricmc.loader.impl.launch.knot.KnotClient or net.minecraft.client.main.Main
    // For test execution or demo run, we craft the full launch command
    const classpath = [
      path.join(instanceDir, 'bin', '*'),
      path.join(config.PATHS.LIBRARIES, '*')
    ].join(path.delimiter);

    const fullArgs = [
      ...jvmArgs,
      '-cp', classpath,
      'net.fabricmc.loader.impl.launch.knot.KnotClient',
      ...gameArgs
    ];

    onProgress({ step: 'launching', percent: 100, message: '¡Iniciando Minecraft...' });
    onStateChange('launching', { javaPath, instanceDir });

    console.log(`[Launcher] Iniciando Minecraft con: ${javaPath}`);
    console.log(`[Launcher] GameDir: ${instanceDir}`);

    const child = spawn(javaPath, fullArgs, {
      cwd: instanceDir,
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    activeMinecraftProcess = child;
    onStateChange('running', { pid: child.pid });

    child.stdout.on('data', data => {
      const line = data.toString();
      console.log(`[Minecraft] ${line.trim()}`);
    });

    child.stderr.on('data', data => {
      const line = data.toString();
      console.error(`[Minecraft Error] ${line.trim()}`);
    });

    // CRITICAL ANTI-LEAK: Clean mods immediately upon process termination
    child.on('exit', (code, signal) => {
      console.log(`[Launcher] Minecraft finalizado (código: ${code}, señal: ${signal}).`);
      console.log(`[Launcher] Ejecutando borrado seguro de mods para proteger los assets de EsquizoStudios...`);

      // DELETE MODS IMMEDIATELY AND SILENTLY
      cleanInstanceMods(instanceId);

      activeMinecraftProcess = null;
      activeInstanceId = null;
      onStateChange('stopped', { code, signal });
    });

    child.on('error', err => {
      console.error(`[Launcher] Error del proceso de Minecraft:`, err.message);

      // Clean mods in case of failure as well
      cleanInstanceMods(instanceId);

      activeMinecraftProcess = null;
      activeInstanceId = null;
      onStateChange('error', { error: err.message });
    });

    return { pid: child.pid };
  } catch (err) {
    // If any error occurs prior to launch, ensure no leftover leaked files
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
