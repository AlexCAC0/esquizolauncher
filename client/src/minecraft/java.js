const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');
const AdmZip = require('adm-zip');
const store = require('../store');
const config = require('../config');

// Known direct fallbacks in case the Adoptium API is unreachable
const FALLBACK_JRE_URLS = {
  8: 'https://github.com/adoptium/temurin8-binaries/releases/download/jdk8u504-b01/OpenJDK8U-jre_x64_windows_hotspot_8u504b01.zip',
  17: 'https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jre_x64_windows_hotspot_17.0.20.1_1.zip',
  21: 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jre_x64_windows_hotspot_21.0.12.1_1.zip'
};

/**
 * Determines the required Java major version according to the Minecraft version.
 * - Minecraft 1.20.5+ and 1.21+ require Java 21
 * - Minecraft 1.17 to 1.20.4 require Java 17
 * - Minecraft 1.16.5 and below require Java 8
 *
 * @param {string} mcVersion - e.g. "1.20.1", "1.21", "1.16.5"
 * @returns {number} 8, 17, or 21
 */
function getRequiredJavaVersion(mcVersion) {
  if (!mcVersion) return 17;
  const parts = mcVersion.split('.');
  const minor = parseInt(parts[1], 10) || 20;
  const patch = parseInt(parts[2], 10) || 0;

  if (minor > 20 || (minor === 20 && patch >= 5)) {
    return 21;
  }
  if (minor >= 17) {
    return 17;
  }
  return 8;
}

/**
 * Recursively locates javaw.exe (or java.exe) inside a directory.
 */
function findJavawInDir(dir) {
  if (!fs.existsSync(dir)) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findJavawInDir(fullPath);
        if (found) return found;
      } else if (entry.isFile() && entry.name.toLowerCase() === 'javaw.exe') {
        return fullPath;
      }
    }
    // Secondary check for java.exe if javaw.exe is not present
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'java.exe') {
        return fullPath;
      }
    }
  } catch (err) {}
  return null;
}

/**
 * Tests an executable path with -version and extracts its version info.
 */
function testJavaBinary(executablePath) {
  if (!executablePath || !fs.existsSync(executablePath)) return null;
  try {
    const out = execSync(`"${executablePath}" -version 2>&1`, { encoding: 'utf-8', timeout: 3000 });
    const match = out.match(/version "([^"]+)"/) || out.match(/build (\S+)/);
    const verStr = match ? match[1] : 'Desconocida';
    let major = 8;
    if (verStr.startsWith('1.8')) major = 8;
    else {
      const parts = verStr.split('.');
      major = parseInt(parts[0], 10) || 17;
    }
    return {
      path: path.normalize(executablePath),
      version: verStr,
      major: major,
      name: `Java ${major} (${verStr})`
    };
  } catch (err) {
    return null;
  }
}

/**
 * Finds all installed Java installations on the machine.
 */
function findJavaInstallations() {
  const found = [];
  const checked = new Set();

  function testAndAdd(executablePath) {
    if (!executablePath) return;
    const clean = path.normalize(executablePath);
    if (checked.has(clean.toLowerCase())) return;
    checked.add(clean.toLowerCase());

    const result = testJavaBinary(clean);
    if (result) found.push(result);
  }

  // Common Windows directories for JDK / JRE
  const searchRoots = [
    config.PATHS.RUNTIMES,
    path.join(config.PATHS.ROOT, 'runtime'),
    'C:\\Program Files\\Java',
    'C:\\Program Files (x86)\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files\\Microsoft\\jdk',
    'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath',
    'C:\\Program Files (x86)\\Minecraft Launcher\\runtime'
  ];

  searchRoots.forEach(root => {
    if (fs.existsSync(root)) {
      try {
        const sub = fs.readdirSync(root);
        sub.forEach(item => {
          const itemPath = path.join(root, item);
          const javawInSub = findJavawInDir(itemPath);
          if (javawInSub) testAndAdd(javawInSub);
        });
      } catch (e) {}
      testAndAdd(path.join(root, 'javaw.exe'));
      testAndAdd(path.join(root, 'bin', 'javaw.exe'));
    }
  });

  // Check PATH
  try {
    const whichJava = execSync('where.exe javaw.exe 2>nul', { encoding: 'utf-8' }).trim().split('\r\n')[0];
    if (whichJava) testAndAdd(whichJava);
  } catch (e) {}

  try {
    const whichJavaExe = execSync('where.exe java.exe 2>nul', { encoding: 'utf-8' }).trim().split('\r\n')[0];
    if (whichJavaExe) testAndAdd(whichJavaExe);
  } catch (e) {}

  return found;
}

/**
 * Downloads and extracts an official Eclipse Temurin portable JRE for Windows x64.
 *
 * @param {number} requiredMajor - 8, 17, or 21
 * @param {Function} onProgress - Progress reporter callback
 * @returns {Promise<string>} Path to extracted javaw.exe
 */
async function downloadJavaRuntime(requiredMajor, onProgress = () => {}) {
  const runtimesDir = config.PATHS.RUNTIMES;
  if (!fs.existsSync(runtimesDir)) {
    fs.mkdirSync(runtimesDir, { recursive: true });
  }

  const targetDir = path.join(runtimesDir, `java-${requiredMajor}`);
  const tempZipPath = path.join(runtimesDir, `temp-jre-${requiredMajor}.zip`);

  onProgress({
    step: 'java_resolve',
    percent: 68,
    message: `Java ${requiredMajor} no encontrado en el equipo. Obteniendo enlace oficial de descarga...`
  });

  // 1. Resolve download URL from Adoptium API or fallback
  let downloadUrl = null;
  let totalBytes = 0;

  try {
    const apiUrl = `https://api.adoptium.net/v3/assets/latest/${requiredMajor}/hotspot?os=windows&architecture=x64&image_type=jre`;
    const res = await axios.get(apiUrl, { timeout: 10000 });
    if (Array.isArray(res.data) && res.data.length > 0 && res.data[0].binary?.package?.link) {
      downloadUrl = res.data[0].binary.package.link;
      totalBytes = res.data[0].binary.package.size || 0;
    }
  } catch (err) {
    console.warn(`[Java] Fallback a enlace estático para Java ${requiredMajor}:`, err.message);
  }

  if (!downloadUrl) {
    downloadUrl = FALLBACK_JRE_URLS[requiredMajor] || FALLBACK_JRE_URLS[17];
  }

  console.log(`[Java] Descargando runtime portátil Java ${requiredMajor} desde: ${downloadUrl}`);
  onProgress({
    step: 'java_download',
    percent: 70,
    message: `Iniciando descarga de Java ${requiredMajor} portátil...`
  });

  // 2. Stream download the zip file
  const response = await axios({
    method: 'GET',
    url: downloadUrl,
    responseType: 'stream',
    maxRedirects: 5,
    timeout: 60000
  });

  const headerLength = parseInt(response.headers['content-length'] || '0', 10);
  if (headerLength > 0) totalBytes = headerLength;

  let downloadedBytes = 0;
  const writer = fs.createWriteStream(tempZipPath);

  response.data.on('data', chunk => {
    downloadedBytes += chunk.length;
    if (totalBytes > 0) {
      const mbDone = (downloadedBytes / (1024 * 1024)).toFixed(1);
      const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1);
      const subPct = Math.min(88, Math.round(70 + (downloadedBytes / totalBytes) * 18));
      onProgress({
        step: 'java_download',
        percent: subPct,
        message: `Descargando Java ${requiredMajor} portátil (${mbDone} MB / ${mbTotal} MB)...`
      });
    }
  });

  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  // 3. Extract the downloaded archive
  onProgress({
    step: 'java_extract',
    percent: 89,
    message: `Instalando Java ${requiredMajor} portátil en el launcher...`
  });

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  try {
    const zip = new AdmZip(tempZipPath);
    zip.extractAllTo(targetDir, true);
  } catch (extractErr) {
    throw new Error(`Error al descomprimir Java ${requiredMajor}: ${extractErr.message}`);
  } finally {
    // Delete temp zip
    if (fs.existsSync(tempZipPath)) {
      try { fs.unlinkSync(tempZipPath); } catch (e) {}
    }
  }

  // 4. Locate javaw.exe inside extracted folder
  const javawPath = findJavawInDir(targetDir);
  if (!javawPath || !fs.existsSync(javawPath)) {
    throw new Error(`No se encontró javaw.exe tras extraer Java ${requiredMajor} en: ${targetDir}`);
  }

  console.log(`[Java] Runtime Java ${requiredMajor} portátil instalado con éxito en: ${javawPath}`);
  onProgress({
    step: 'java_ready',
    percent: 92,
    message: `¡Java ${requiredMajor} portátil configurado con éxito!`
  });

  return javawPath;
}

/**
 * Automatically detects the required Java version for the game,
 * checks if it is available locally, and if not, automatically downloads it.
 *
 * @param {string} mcVersion - Minecraft version (e.g. "1.20.1", "1.21")
 * @param {Function} onProgress - Progress reporter ({ step, percent, message })
 * @returns {Promise<string>} Resolved javaw.exe path
 */
async function ensureJavaRuntime(mcVersion, onProgress = () => {}) {
  const requiredMajor = getRequiredJavaVersion(mcVersion);
  onProgress({
    step: 'java_detect',
    percent: 65,
    message: `Detectando Java ${requiredMajor} para Minecraft ${mcVersion || '1.20.1'}...`
  });

  // 1. Check user manual override in settings
  const settings = store.getSettings();
  if (settings.java_path && fs.existsSync(settings.java_path)) {
    const testRes = testJavaBinary(settings.java_path);
    if (testRes && testRes.major >= requiredMajor) {
      return settings.java_path;
    }
  }

  // 2. Check if already downloaded portably in launcher runtimes
  const portableDir = path.join(config.PATHS.RUNTIMES, `java-${requiredMajor}`);
  if (fs.existsSync(portableDir)) {
    const portableJavaw = findJavawInDir(portableDir);
    if (portableJavaw) {
      const testRes = testJavaBinary(portableJavaw);
      if (testRes && testRes.major >= requiredMajor) {
        return portableJavaw;
      }
    }
  }

  // 3. Search system installations
  const installations = findJavaInstallations();

  // Prefer exact match
  const exactMatch = installations.find(j => j.major === requiredMajor);
  if (exactMatch) return exactMatch.path;

  // Compatible higher version (e.g. Java 21 can run Java 17 games)
  if (requiredMajor === 17) {
    const higherMatch = installations.find(j => j.major === 21);
    if (higherMatch) return higherMatch.path;
  }

  // Check if standard PATH javaw works and has compatible version
  try {
    const pathTest = testJavaBinary('javaw.exe');
    if (pathTest && (pathTest.major === requiredMajor || (requiredMajor === 17 && pathTest.major === 21))) {
      return 'javaw.exe';
    }
  } catch (e) {}

  // 4. If not found anywhere on the machine, AUTOMATICALLY DOWNLOAD IT!
  console.log(`[Java] No se detectó Java ${requiredMajor} en el equipo. Iniciando descarga automática...`);
  return await downloadJavaRuntime(requiredMajor, onProgress);
}

/**
 * Backward compatibility fallback resolver
 */
function resolveJavaPath(requiredMajor = 17) {
  const portableDir = path.join(config.PATHS.RUNTIMES, `java-${requiredMajor}`);
  if (fs.existsSync(portableDir)) {
    const portableJavaw = findJavawInDir(portableDir);
    if (portableJavaw) return portableJavaw;
  }

  const installations = findJavaInstallations();
  const match = installations.find(j => j.major === requiredMajor);
  if (match) return match.path;
  if (requiredMajor === 17) {
    const higher = installations.find(j => j.major === 21);
    if (higher) return higher.path;
  }

  return 'javaw.exe';
}

module.exports = {
  getRequiredJavaVersion,
  findJavaInstallations,
  findJavawInDir,
  downloadJavaRuntime,
  ensureJavaRuntime,
  resolveJavaPath
};
