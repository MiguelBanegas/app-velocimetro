const fetch = require("node-fetch");
const config = require("./config");
const locationService = require("./location");

class Tracker {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.lastSyncStatus = "pending";
    this.lastSyncTime = null;
    this.stats = {
      totalSent: 0,
      totalErrors: 0,
      lastError: null,
    };
  }

  async sendLocation(lat, lon) {
    const device_id = config.get("device_id");
    const api_url = config.get("api_url");

    try {
      const response = await fetch(api_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id,
          lat,
          lon,
        }),
        timeout: 10000,
      });

      if (response.ok) {
        this.lastSyncStatus = "success";
        this.lastSyncTime = new Date();
        this.stats.totalSent++;
        console.log(`[${new Date().toISOString()}] Location sent successfully`);
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.lastSyncStatus = "error";
      this.stats.totalErrors++;
      this.stats.lastError = error.message;
      console.error(
        `[${new Date().toISOString()}] Error sending location:`,
        error.message,
      );
      return false;
    }
  }

  async tick() {
    console.log(`[${new Date().toISOString()}] Tracker tick...`);

    let location = null;

    // Obtener ubicación según configuración
    if (config.get("use_ip_location")) {
      location = await locationService.getLocationAuto();
    } else {
      const lat = config.get("manual_lat");
      const lon = config.get("manual_lon");
      location = locationService.getManualLocation(lat, lon);
    }

    if (location) {
      await this.sendLocation(location.lat, location.lon);
    } else {
      console.error("No location available");
      this.lastSyncStatus = "error";
      this.stats.lastError = "No location available";
    }
  }

  start() {
    if (this.isRunning) {
      console.log("Tracker already running");
      return;
    }

    const intervalSeconds = config.get("interval_seconds") || 60;
    console.log(`Starting tracker with interval: ${intervalSeconds}s`);

    // Primer envío inmediato
    this.tick();

    // Configurar intervalo
    this.intervalId = setInterval(() => {
      this.tick();
    }, intervalSeconds * 1000);

    this.isRunning = true;
    config.set("enabled", true);
  }

  stop() {
    if (!this.isRunning) {
      console.log("Tracker not running");
      return;
    }

    console.log("Stopping tracker");
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    config.set("enabled", false);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncStatus: this.lastSyncStatus,
      lastSyncTime: this.lastSyncTime,
      stats: this.stats,
      config: config.getAll(),
      lastLocation: locationService.getLastLocation(),
    };
  }
}

module.exports = new Tracker();
