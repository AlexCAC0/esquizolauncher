const crypto = require('crypto');
const api = require('../api');

/**
 * Standard Minecraft offline UUID calculation (Version 3 UUID / MD5 name-based)
 */
function getOfflineUuid(username) {
  const hash = crypto.createHash('md5').update('OfflinePlayer:' + username).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30; // Version 3
  hash[8] = (hash[8] & 0x3f) | 0x80; // Variant 1 (IETF)
  return hash.toString('hex');
}

/**
 * Logs in or registers an offline user, enforcing Discord linkage
 * and duplicate check via the Esquizo backend.
 */
async function loginOffline({ username, discord_id, discord_username, discord_avatar }) {
  if (!username || !username.trim()) {
    throw new Error('Debes ingresar un nombre de usuario de Minecraft.');
  }

  const cleanName = username.trim();

  if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanName)) {
    throw new Error('El nombre de usuario debe contener entre 3 y 16 caracteres alfanuméricos.');
  }

  if (!discord_id || !discord_id.trim()) {
    throw new Error('La vinculación de tu cuenta de Discord es obligatoria para cuentas offline.');
  }

  // Communicate with Esquizo backend to register and check duplicate / ban
  const res = await api.loginOffline({
    username: cleanName,
    discord_id: discord_id.trim(),
    discord_username: (discord_username || '').trim(),
    discord_avatar: discord_avatar || null
  });

  if (!res.success) {
    throw new Error(res.error || 'No se pudo registrar la cuenta offline.');
  }

  const uuid = getOfflineUuid(cleanName);
  const skinUrl = `https://minotar.net/avatar/${cleanName}/64.png`;

  return {
    username: cleanName,
    uuid: uuid,
    type: 'offline',
    discord_id: discord_id.trim(),
    discord_username: discord_username || null,
    discord_avatar: discord_avatar || null,
    skinUrl: skinUrl,
    created_at: new Date().toISOString()
  };
}

module.exports = {
  loginOffline,
  getOfflineUuid
};
