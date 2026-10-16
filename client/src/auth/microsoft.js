const axios = require('axios');
const api = require('../api');

// Microsoft Azure Client ID for Minecraft
const MS_CLIENT_ID = '00000000402b5328'; // Standard Mojang public client ID
const MS_DEVICE_CODE_URL = 'https://login.live.com/oauth20_connect.srf';
const MS_TOKEN_URL = 'https://login.live.com/oauth20_token.srf';

/**
 * Initiates Microsoft Device Code Flow for Minecraft Authentication
 */
async function startDeviceAuth() {
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    scope: 'service::user.auth.xboxlive.com::MBI_SSL',
    response_type: 'device_code'
  });

  const res = await axios.post(
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode',
    params.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  );

  return {
    device_code: res.data.device_code,
    user_code: res.data.user_code,
    verification_uri: res.data.verification_uri,
    expires_in: res.data.expires_in,
    interval: res.data.interval || 5
  };
}

/**
 * Polls Microsoft token endpoint until user enters the code in browser
 */
async function pollDeviceAuth(deviceCode, interval = 5, onProgress = () => {}) {
  const startTime = Date.now();
  const maxTimeout = 15 * 60 * 1000; // 15 mins

  while (Date.now() - startTime < maxTimeout) {
    await new Promise(r => setTimeout(r, interval * 1000));
    try {
      const params = new URLSearchParams({
        client_id: MS_CLIENT_ID,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: deviceCode
      });

      const res = await axios.post(
        'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
        params.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      if (res.data.access_token) {
        onProgress('Token de Microsoft obtenido. Verificando Xbox Live...');
        return await completeMinecraftAuth(res.data.access_token, onProgress);
      }
    } catch (err) {
      const errCode = err.response?.data?.error;
      if (errCode === 'authorization_pending') {
        // Still waiting for user, continue polling
        continue;
      } else if (errCode === 'slow_down') {
        interval += 2;
      } else if (errCode === 'expired_token') {
        throw new Error('El código de verificación ha expirado. Inténtalo de nuevo.');
      } else {
        throw new Error('Error de autenticación con Microsoft: ' + (err.response?.data?.error_description || err.message));
      }
    }
  }
  throw new Error('Tiempo de espera agotado al iniciar sesión.');
}

/**
 * Exchanges Microsoft Access Token for Xbox Live -> XSTS -> Minecraft Token,
 * and strictly verifies Minecraft Java game ownership!
 */
async function completeMinecraftAuth(msAccessToken, onProgress = () => {}) {
  // 1. Xbox Live User Token
  onProgress('Autenticando con Xbox Live...');
  const xblRes = await axios.post(
    'https://user.auth.xboxlive.com/user/authenticate',
    {
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msAccessToken}`
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    },
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
  );

  const xblToken = xblRes.data.Token;
  const uhs = xblRes.data.DisplayClaims.xui[0].uhs;

  // 2. XSTS Token
  onProgress('Obteniendo autorización de seguridad (XSTS)...');
  const xstsRes = await axios.post(
    'https://xsts.auth.xboxlive.com/xsts/authorize',
    {
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken]
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    },
    { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
  );

  const xstsToken = xstsRes.data.Token;

  // 3. Minecraft Service Authentication
  onProgress('Conectando con los servicios de Minecraft...');
  const mcAuthRes = await axios.post(
    'https://api.minecraftservices.com/authentication/login_with_xbox',
    {
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  const mcToken = mcAuthRes.data.access_token;

  // 4. STRICT OWNERSHIP CHECK: Must own Minecraft Java Edition
  onProgress('Verificando licencia premium de Minecraft...');
  const storeRes = await axios.get(
    'https://api.minecraftservices.com/entitlements/mcstore',
    { headers: { Authorization: `Bearer ${mcToken}` } }
  );

  const items = storeRes.data.items || [];
  const ownsGame = items.some(
    item => item.name === 'game_minecraft' || item.name === 'product_minecraft'
  );

  if (!ownsGame) {
    throw new Error(
      'Esta cuenta de Microsoft no posee una copia oficial comprada de Minecraft Java Edition. Para ingresar a EsquizoStudios con Microsoft debes contar con el juego premium.'
    );
  }

  // 5. Fetch Profile (Username, UUID, Skin)
  onProgress('Cargando perfil del jugador...');
  const profileRes = await axios.get(
    'https://api.minecraftservices.com/minecraft/profile',
    { headers: { Authorization: `Bearer ${mcToken}` } }
  );

  const profile = profileRes.data;
  const skin = profile.skins && profile.skins.find(s => s.state === 'ACTIVE');
  const skinUrl = skin ? skin.url : `https://minotar.net/avatar/${profile.name}/64.png`;

  // Register in Esquizo backend
  await api.loginMicrosoft(profile.name);

  return {
    username: profile.name,
    uuid: profile.id,
    type: 'microsoft',
    token: mcToken,
    skinUrl: skinUrl,
    created_at: new Date().toISOString()
  };
}

module.exports = {
  startDeviceAuth,
  pollDeviceAuth,
  completeMinecraftAuth
};
