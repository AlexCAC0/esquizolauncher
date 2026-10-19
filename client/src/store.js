const fs = require('fs');
const path = require('path');
const config = require('./config');

// Ensure root directory exists
if (!fs.existsSync(config.PATHS.ROOT)) {
  fs.mkdirSync(config.PATHS.ROOT, { recursive: true });
}
if (!fs.existsSync(config.PATHS.INSTANCES)) {
  fs.mkdirSync(config.PATHS.INSTANCES, { recursive: true });
}

const DEFAULT_STATE = {
  tos_accepted: false,
  current_account: null,
  accounts: [],
  instances: [],
  selected_instance_id: null,
  last_played_instance_id: null,
  settings: {
    ram_min: 2048,
    ram_max: 4096,
    java_path: '',
    action_on_play: 'keep', // 'keep' | 'minimize' | 'hide'
    api_url: config.DEFAULT_API_URL,
    discord_client_id: ''
  }
};

class Store {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(config.PATHS.DATA)) {
        const raw = fs.readFileSync(config.PATHS.DATA, 'utf-8');
        const parsed = JSON.parse(raw);
        const loadedSettings = { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) };
        // If settings was previously saved with localhost, upgrade it to config.DEFAULT_API_URL
        if (!loadedSettings.api_url || loadedSettings.api_url.includes('localhost') || loadedSettings.api_url.includes('127.0.0.1')) {
          loadedSettings.api_url = config.DEFAULT_API_URL;
        }
        return {
          ...DEFAULT_STATE,
          ...parsed,
          settings: loadedSettings
        };
      }
    } catch (err) {
      console.error('[Store] Error reading launcher data:', err);
    }
    this.saveDirect(DEFAULT_STATE);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  save() {
    this.saveDirect(this.data);
  }

  saveDirect(data) {
    try {
      const tempPath = config.PATHS.DATA + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, config.PATHS.DATA);
    } catch (err) {
      console.error('[Store] Error writing launcher data:', err);
    }
  }

  // --- TOS ---
  isTosAccepted() {
    return !!this.data.tos_accepted;
  }

  acceptTos() {
    this.data.tos_accepted = true;
    this.save();
  }

  // --- ACCOUNTS ---
  getCurrentAccount() {
    return this.data.current_account;
  }

  getAccounts() {
    return this.data.accounts || [];
  }

  setCurrentAccount(account) {
    this.data.current_account = account;
    // Also save in accounts list if not present
    const idx = this.data.accounts.findIndex(a => a.username.toLowerCase() === account.username.toLowerCase());
    if (idx >= 0) {
      this.data.accounts[idx] = { ...this.data.accounts[idx], ...account };
    } else {
      this.data.accounts.push(account);
    }
    this.save();
  }

  removeAccount(username) {
    this.data.accounts = this.data.accounts.filter(a => a.username.toLowerCase() !== username.toLowerCase());
    if (this.data.current_account && this.data.current_account.username.toLowerCase() === username.toLowerCase()) {
      this.data.current_account = this.data.accounts[0] || null;
    }
    this.save();
  }

  unlinkDiscordCurrentAccount() {
    if (this.data.current_account) {
      this.data.current_account.discord_id = null;
      this.data.current_account.discord_username = null;
      const idx = this.data.accounts.findIndex(a => a.username.toLowerCase() === this.data.current_account.username.toLowerCase());
      if (idx >= 0) {
        this.data.accounts[idx].discord_id = null;
        this.data.accounts[idx].discord_username = null;
      }
      this.save();
    }
  }

  logout() {
    this.data.current_account = null;
    this.save();
  }

  // --- INSTANCES ---
  getInstances() {
    return this.data.instances || [];
  }

  getInstance(id) {
    return (this.data.instances || []).find(i => i.id === id);
  }

  addInstance(instance) {
    const idx = this.data.instances.findIndex(i => i.id === instance.id);
    if (idx >= 0) {
      this.data.instances[idx] = { ...this.data.instances[idx], ...instance };
    } else {
      this.data.instances.push(instance);
    }
    if (!this.data.selected_instance_id) {
      this.data.selected_instance_id = instance.id;
    }
    this.save();
  }

  removeInstance(id) {
    this.data.instances = this.data.instances.filter(i => i.id !== id);
    if (this.data.selected_instance_id === id) {
      this.data.selected_instance_id = this.data.instances[0]?.id || null;
    }
    this.save();
  }

  getSelectedInstanceId() {
    return this.data.selected_instance_id;
  }

  setSelectedInstanceId(id) {
    this.data.selected_instance_id = id;
    this.save();
  }

  getLastPlayedInstanceId() {
    return this.data.last_played_instance_id;
  }

  getLastPlayedInstance() {
    if (!this.data.last_played_instance_id) return null;
    return (this.data.instances || []).find(i => i.id === this.data.last_played_instance_id) || null;
  }

  setLastPlayedInstanceId(id) {
    this.data.last_played_instance_id = id;
    this.save();
  }

  // --- SETTINGS ---
  getSettings() {
    return this.data.settings;
  }

  updateSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
    return this.data.settings;
  }

  resetAll() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.save();
  }
}

module.exports = new Store();
