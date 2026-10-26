const path = require('path');
const os = require('os');

const APPDATA = process.env.APPDATA || (
  process.platform === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support')
    : path.join(os.homedir(), '.local', 'share')
);

const LAUNCHER_DIR = path.join(APPDATA, '.esquizolauncher');

module.exports = {
  STUDIO_NAME: 'EsquizoStudios',
  APP_TITLE: 'EsquizoLauncher',
  VERSION: '1.0.2',
  COPYRIGHT: 'Copyright (C) 2026 EsquizoStudios. Todos los derechos reservados. Software Privado y Propietario.',
  
  // Default Backend API endpoint (points to private Esquizo server)
  DEFAULT_API_URL: 'http://koalahosting.asuscomm.com:3001',

  // Discord Rich Presence Application Client ID (from https://discord.com/developers/applications)
  DEFAULT_DISCORD_CLIENT_ID: '1560860753907421194',

  // Local storage directories
  PATHS: {
    ROOT: LAUNCHER_DIR,
    INSTANCES: path.join(LAUNCHER_DIR, 'instances'),
    ASSETS: path.join(LAUNCHER_DIR, 'assets'),
    LIBRARIES: path.join(LAUNCHER_DIR, 'libraries'),
    VERSIONS: path.join(LAUNCHER_DIR, 'versions'),
    RUNTIMES: path.join(LAUNCHER_DIR, 'runtimes'),
    SCREENSHOTS_COMMON: path.join(LAUNCHER_DIR, 'screenshots'),
    DATA: path.join(LAUNCHER_DIR, 'launcher-data.json')
  }
};
