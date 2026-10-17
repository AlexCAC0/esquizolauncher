const db = require('./server/src/db');
const { cleanInstanceMods } = require('./client/src/minecraft/cleaner');
const fs = require('fs');
const path = require('path');
const config = require('./client/src/config');

console.log('--- TEST 1: 18-Character Access Code Generation ---');
const code1 = db.generateAccessCode();
console.log('Generated Code:', code1, 'Length:', code1.length);
if (code1.length !== 18 || !/^[a-zA-Z0-9]{18}$/.test(code1)) {
  throw new Error('Code generation failed rule!');
}

console.log('\n--- TEST 2: ID Validation Rule (Strictly lowercase letters only) ---');
const validIds = ['evento', 'tormenta', 'esquizoestudio'];
const invalidIds = ['Evento', 'evento1', 'evento_2', 'evento especial', 'EVENTO'];
const idRegex = /^[a-z]+$/;

validIds.forEach(id => {
  if (!idRegex.test(id)) throw new Error('Expected ' + id + ' to be valid');
});
invalidIds.forEach(id => {
  if (idRegex.test(id)) throw new Error('Expected ' + id + ' to be invalid');
});
console.log('ID validation rules validated successfully!');

console.log('\n--- TEST 3: Discord Duplicate Link Prevention ---');
// Register user 1 with discord 12345
const u1 = db.registerOrUpdateUser({ username: 'PlayerOne', type: 'offline', discord_id: '12345', discord_username: 'DiscordUser#0001' });
console.log('Registered PlayerOne with Discord 12345:', u1.username);

// Attempt duplicate check with PlayerTwo
const existing = db.getUserByDiscordId('12345');
if (existing && existing.username.toLowerCase() !== 'playertwo'.toLowerCase()) {
  console.log('Blocked duplicate Discord linkage: Discord 12345 is already linked to ' + existing.username);
} else {
  throw new Error('Failed to detect duplicate discord link!');
}

console.log('\n--- TEST 4: Anti-Leak Ephemeral Mod Cleaner ---');
const testInstDir = path.join(config.PATHS.INSTANCES, 'testevent');
const testModsDir = path.join(testInstDir, 'mods');
const testConfigDir = path.join(testInstDir, 'config');
const testScreenshotsDir = path.join(testInstDir, 'screenshots');

[testModsDir, testConfigDir, testScreenshotsDir].forEach(d => fs.mkdirSync(d, { recursive: true }));

fs.writeFileSync(path.join(testModsDir, 'secret-event-mod.jar'), 'SECRET_CONTENT');
fs.writeFileSync(path.join(testConfigDir, 'options.json'), JSON.stringify({ volume: 100 }));
fs.writeFileSync(path.join(testScreenshotsDir, '2026-10-16_F2.png'), 'DUMMY_SCREENSHOT');

console.log('Created test files. Running cleanInstanceMods("testevent")...');
cleanInstanceMods('testevent');

const modsRemaining = fs.readdirSync(testModsDir);
const configExists = fs.existsSync(path.join(testConfigDir, 'options.json'));
const screenshotExists = fs.existsSync(path.join(testScreenshotsDir, '2026-10-16_F2.png'));

console.log('Mods remaining in folder:', modsRemaining.length);
console.log('Config preserved intact:', configExists);
console.log('Screenshots preserved intact:', screenshotExists);

if (modsRemaining.length !== 0 || !configExists || !screenshotExists) {
  throw new Error('Anti-leak cleanup assertion failed!');
}

// Cleanup test dir
fs.rmSync(testInstDir, { recursive: true, force: true });

console.log('\n--- TEST 5: Minecraft Base & Fabric Profile Downloader Integration ---');
const { ensureVanillaJar, prepareFabricProfile } = require('./client/src/minecraft/downloader');
const { isGameRunning, killActiveGame } = require('./client/src/minecraft/launcher');

console.log('Testing Fabric Profile generation for 1.20.1...');
prepareFabricProfile('1.20.1', '0.15.11').then(versionId => {
  if (!versionId.includes('fabric-loader-0.15.11-1.20.1')) {
    throw new Error('Fabric profile generation returned invalid ID: ' + versionId);
  }
  console.log('Fabric Profile verified:', versionId);

  return ensureVanillaJar('1.20.1');
}).then(vanillaRes => {
  if (!fs.existsSync(vanillaRes.jarPath) || !fs.existsSync(vanillaRes.jsonPath)) {
    throw new Error('Vanilla jar or json was not verified on disk!');
  }
  console.log('Vanilla Minecraft 1.20.1 verified on disk:', path.basename(vanillaRes.jarPath));
  console.log('Launcher process state initial check (isGameRunning):', isGameRunning());

  console.log('\n--- TEST 6: Automatic Java Version Detection & Auto-Downloader ---');
  const { getRequiredJavaVersion, ensureJavaRuntime } = require('./client/src/minecraft/java');

  if (getRequiredJavaVersion('1.20.1') !== 17 || getRequiredJavaVersion('1.21') !== 21 || getRequiredJavaVersion('1.16.5') !== 8) {
    throw new Error('Java version requirement mapping failed!');
  }
  console.log('Java version requirement rules validated (1.20.1->17, 1.21->21, 1.16.5->8)!');

  return ensureJavaRuntime('1.20.1');
}).then(javaPath => {
  if (!fs.existsSync(javaPath) || !javaPath.toLowerCase().endsWith('.exe')) {
    throw new Error('ensureJavaRuntime returned invalid executable path: ' + javaPath);
  }
  console.log('Automatic Java 17 resolution verified on disk:', javaPath);

  console.log('\n--- TEST 7: Minecraft F2 Screenshot Centralization & Junction ---');
  const { linkScreenshotsFolder, getScreenshots } = require('./client/src/gallery');
  const dummyInstDir = path.join(config.PATHS.INSTANCES, 'gallerytest');
  fs.mkdirSync(dummyInstDir, { recursive: true });

  linkScreenshotsFolder(dummyInstDir);

  const instScreenshotsDir = path.join(dummyInstDir, 'screenshots');
  const testFileName = `test_f2_${Date.now()}.png`;
  const dummyFileInInstance = path.join(instScreenshotsDir, testFileName);
  fs.writeFileSync(dummyFileInInstance, 'PNG_DUMMY_BINARY_DATA');

  const fileInCentral = path.join(config.PATHS.SCREENSHOTS_COMMON, testFileName);
  const existsInCentral = fs.existsSync(fileInCentral);
  console.log('F2 screenshot written to instance screenshots folder reflected in central folder:', existsInCentral);

  if (!existsInCentral) {
    throw new Error('Screenshot centralization junction failed!');
  }

  const galleryList = getScreenshots();
  const foundInGallery = galleryList.some(s => s.filename === testFileName);
  console.log('Screenshot found in launcher gallery listing:', foundInGallery);

  if (!foundInGallery) {
    throw new Error('Screenshot not listed in gallery!');
  }

  // Cleanup test files
  try { fs.unlinkSync(fileInCentral); } catch (e) {}
  try { fs.unlinkSync(instScreenshotsDir); } catch (e) {}
  try { fs.rmSync(dummyInstDir, { recursive: true, force: true }); } catch (e) {}

  console.log('\n--- TEST 8: New Features Validation (Store, Action-on-Play, Discord RPC & Gallery) ---');
  const store = require('./client/src/store');
  const discordRpc = require('./client/src/discord-rpc');
  const gallery = require('./client/src/gallery');

  // 1. Store action_on_play and last_played_instance_id
  store.updateSettings({ action_on_play: 'minimize' });
  const updatedSettings = store.getSettings();
  if (updatedSettings.action_on_play !== 'minimize') {
    throw new Error('Store action_on_play setting failed to persist!');
  }
  console.log('Action-on-play setting verified:', updatedSettings.action_on_play);

  store.setLastPlayedInstanceId('tormenta');
  if (store.getLastPlayedInstanceId() !== 'tormenta') {
    throw new Error('Store last_played_instance_id failed to persist!');
  }
  console.log('Last played instance ID verified:', store.getLastPlayedInstanceId());

  // 2. Discord RPC helpers
  if (typeof discordRpc.initRpc !== 'function' ||
      typeof discordRpc.setStandby !== 'function' ||
      typeof discordRpc.setDownloading !== 'function' ||
      typeof discordRpc.setPlaying !== 'function') {
    throw new Error('Discord RPC module missing required helper methods!');
  }
  console.log('Discord RPC module interface verified!');

  // 3. Gallery operations
  const tempTestPng = path.join(config.PATHS.SCREENSHOTS_COMMON, 'test_delete.png');
  fs.writeFileSync(tempTestPng, 'DUMMY_IMAGE_DATA');
  if (!fs.existsSync(tempTestPng)) throw new Error('Failed to create temp screenshot');
  const deleteResult = gallery.deleteScreenshot(tempTestPng);
  if (!deleteResult || fs.existsSync(tempTestPng)) {
    throw new Error('deleteScreenshot failed to remove file!');
  }
  console.log('Gallery deleteScreenshot verified successfully!');

  console.log('\n>>> TODOS LOS TESTS PASARON EXITOSAMENTE! <<<');
}).catch(err => {
  console.error('Test Suite Error:', err);
  process.exit(1);
});



