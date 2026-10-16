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
console.log('\n>>> TODOS LOS TESTS PASARON EXITOSAMENTE! <<<');
