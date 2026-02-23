const fs = require("fs");
const path = require("path");

const CONFIG_FILE = path.join(__dirname, "..", "config.json");

// Configuración por defecto
const DEFAULT_CONFIG = {
  device_id: "Notebook-Windows",
  interval_seconds: 600,
  api_url: "https://api.appvelocidad.mabcontrol.ar/devices/locations",
  enabled: false,
  use_ip_location: true, // Usar geolocalización por IP
  manual_lat: null,
  manual_lon: null,
};

class Config {
  constructor() {
    this.config = this.load();
  }

  load() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, "utf8");
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error("Error loading config:", error);
    }
    return { ...DEFAULT_CONFIG };
  }

  save() {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error("Error saving config:", error);
      return false;
    }
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    this.config[key] = value;
    return this.save();
  }

  getAll() {
    return { ...this.config };
  }

  update(updates) {
    this.config = { ...this.config, ...updates };
    return this.save();
  }
}

module.exports = new Config();
