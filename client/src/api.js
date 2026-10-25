const axios = require('axios');
const store = require('./store');

function getBaseUrl() {
  return store.getSettings().api_url || 'http://localhost:3001';
}

async function fetchStatus() {
  const url = `${getBaseUrl()}/api/client/status`;
  const res = await axios.get(url, { timeout: 6000 });
  return res.data;
}

async function fetchTos() {
  const url = `${getBaseUrl()}/api/client/tos`;
  const res = await axios.get(url, { timeout: 6000 });
  return res.data;
}

async function loginOffline({ username, discord_id, discord_username, discord_avatar }) {
  const url = `${getBaseUrl()}/api/client/auth/offline`;
  const res = await axios.post(
    url,
    { username, discord_id, discord_username, discord_avatar },
    { timeout: 8000 }
  );
  return res.data;
}

async function loginMicrosoft(username) {
  const url = `${getBaseUrl()}/api/client/auth/microsoft`;
  const res = await axios.post(
    url,
    { username },
    { timeout: 8000 }
  );
  return res.data;
}

async function unlinkDiscord(username) {
  const url = `${getBaseUrl()}/api/client/auth/unlink-discord`;
  const res = await axios.post(url, { username }, { timeout: 6000 });
  return res.data;
}

async function claimInstance(accessCode) {
  const url = `${getBaseUrl()}/api/client/instance/claim`;
  const res = await axios.post(url, { access_code: accessCode }, { timeout: 8000 });
  return res.data;
}

async function fetchInstanceManifest(instanceId) {
  const url = `${getBaseUrl()}/api/client/instance/${instanceId}/manifest`;
  const res = await axios.get(url, { timeout: 10000 });
  return res.data;
}

async function startDiscordClientAuth() {
  const url = `${getBaseUrl()}/auth/discord/client-start`;
  const res = await axios.get(url, { timeout: 6000 });
  return res.data;
}

async function pollDiscordClientAuth(sessionId) {
  const url = `${getBaseUrl()}/auth/discord/client-result?session=${encodeURIComponent(sessionId)}`;
  const res = await axios.get(url, { timeout: 6000 });
  return res.data;
}

async function checkClientUpdate(currentVersion) {
  const url = `${getBaseUrl()}/api/client/updates/check?version=${encodeURIComponent(currentVersion)}`;
  const res = await axios.get(url, { timeout: 8000 });
  return res.data;
}

async function fetchInstanceServerStatus(instanceId) {
  const url = `${getBaseUrl()}/api/client/instance/${instanceId}/server-status`;
  const res = await axios.get(url, { timeout: 4500 });
  return res.data;
}

module.exports = {
  getBaseUrl,
  fetchStatus,
  fetchTos,
  loginOffline,
  loginMicrosoft,
  unlinkDiscord,
  claimInstance,
  fetchInstanceManifest,
  startDiscordClientAuth,
  pollDiscordClientAuth,
  checkClientUpdate,
  fetchInstanceServerStatus
};
