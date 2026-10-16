const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const store = require('../store');

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

    if (fs.existsSync(clean)) {
      try {
        const out = execSync(`"${clean}" -version 2>&1`, { encoding: 'utf-8', timeout: 3000 });
        const match = out.match(/version "([^"]+)"/) || out.match(/build (\S+)/);
        const verStr = match ? match[1] : 'Desconocida';
        let major = 8;
        if (verStr.startsWith('1.8')) major = 8;
        else {
          const parts = verStr.split('.');
          major = parseInt(parts[0], 10) || 17;
        }

        found.push({
          path: clean,
          version: verStr,
          major: major,
          name: `Java ${major} (${verStr})`
        });
      } catch (err) {
        // Failed to execute
      }
    }
  }

  // Common Windows directories for JDK / JRE
  const searchRoots = [
    'C:\\Program Files\\Java',
    'C:\\Program Files (x86)\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\BellSoft',
    'C:\\Program Files\\Microsoft\\jdk',
    'C:\\Program Files\\Common Files\\Oracle\\Java\\javapath'
  ];

  searchRoots.forEach(root => {
    if (fs.existsSync(root)) {
      try {
        const sub = fs.readdirSync(root);
        sub.forEach(item => {
          const javaw = path.join(root, item, 'bin', 'javaw.exe');
          const java = path.join(root, item, 'bin', 'java.exe');
          testAndAdd(javaw);
          testAndAdd(java);
        });
      } catch (e) {}
      testAndAdd(path.join(root, 'javaw.exe'));
      testAndAdd(path.join(root, 'java.exe'));
    }
  });

  // Check PATH
  try {
    const whichJava = execSync('where javaw.exe 2>nul', { encoding: 'utf-8' }).trim().split('\r\n')[0];
    if (whichJava) testAndAdd(whichJava);
  } catch (e) {}

  return found;
}

/**
 * Resolves the best Java binary to use, checking store settings first.
 */
function resolveJavaPath(requiredMajor = 17) {
  const settings = store.getSettings();
  if (settings.java_path && fs.existsSync(settings.java_path)) {
    return settings.java_path;
  }

  const installations = findJavaInstallations();
  if (installations.length === 0) {
    // Fallback to plain javaw
    return 'javaw.exe';
  }

  // Find exact major or closest
  const match = installations.find(j => j.major === requiredMajor);
  if (match) return match.path;

  // Otherwise pick newest
  installations.sort((a, b) => b.major - a.major);
  return installations[0].path;
}

module.exports = {
  findJavaInstallations,
  resolveJavaPath
};
