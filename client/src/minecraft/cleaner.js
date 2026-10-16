const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Anti-Leak Ephemeral Cleaner
 * Deletes all mod files from the instance directory upon Minecraft process termination,
 * while strictly preserving configuration files, options, screenshots/gallery, resourcepacks, saves, etc.
 *
 * @param {string} instanceId - The unique private ID of the instance
 */
function cleanInstanceMods(instanceId) {
  const instanceDir = path.join(config.PATHS.INSTANCES, instanceId);
  const modsDir = path.join(instanceDir, 'mods');

  console.log(`[Anti-Leak Cleaner] Iniciando protocolo de limpieza para instancia '${instanceId}'...`);

  if (!fs.existsSync(modsDir)) {
    console.log(`[Anti-Leak Cleaner] Directorio de mods no existe o ya está vacío.`);
    return { success: true, count: 0 };
  }

  let deletedCount = 0;

  try {
    const files = fs.readdirSync(modsDir);
    for (const file of files) {
      const fullPath = path.join(modsDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(fullPath);
        }
        deletedCount++;
      } catch (err) {
        console.error(`[Anti-Leak Cleaner] Error al eliminar archivo de mod '${file}':`, err);
      }
    }

    console.log(
      `[Anti-Leak Cleaner] Protocolo completado: ${deletedCount} archivos de mods eliminados automáticamente sin confirmación. Los recursos privados de EsquizoStudios han sido protegidos.`
    );
    console.log(
      `[Anti-Leak Cleaner] Configuraciones, capturas (F2), opciones y mundos preservados intactos en: ${instanceDir}`
    );

    return { success: true, count: deletedCount };
  } catch (err) {
    console.error(`[Anti-Leak Cleaner] Error general limpiando mods:`, err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  cleanInstanceMods
};
