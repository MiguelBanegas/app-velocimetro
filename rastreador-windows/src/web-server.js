const express = require("express");
const path = require("path");
const config = require("./config");
const tracker = require("./tracker");

const app = express();
const PORT = 3456;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// API: Obtener estado
app.get("/api/status", (req, res) => {
  res.json(tracker.getStatus());
});

// API: Actualizar configuración
app.post("/api/config", (req, res) => {
  try {
    const updates = req.body;

    // Validar device_id
    if (updates.device_id !== undefined && !updates.device_id.trim()) {
      return res.status(400).json({ error: "Device ID no puede estar vacío" });
    }

    // Validar intervalo
    if (updates.interval_seconds !== undefined) {
      const interval = parseInt(updates.interval_seconds);
      if (isNaN(interval) || interval < 10) {
        return res
          .status(400)
          .json({ error: "Intervalo debe ser al menos 10 segundos" });
      }
      updates.interval_seconds = interval;
    }

    // Actualizar configuración
    config.update(updates);

    // Si el tracker está corriendo, reiniciarlo con la nueva configuración
    if (tracker.isRunning && updates.interval_seconds !== undefined) {
      tracker.stop();
      tracker.start();
    }

    res.json({ success: true, config: config.getAll() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Iniciar rastreo
app.post("/api/start", (req, res) => {
  try {
    tracker.start();
    res.json({ success: true, status: tracker.getStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Detener rastreo
app.post("/api/stop", (req, res) => {
  try {
    tracker.stop();
    res.json({ success: true, status: tracker.getStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Probar ubicación
app.get("/api/test-location", async (req, res) => {
  try {
    const locationService = require("./location");
    const location = await locationService.getLocationAuto();
    res.json({
      success: true,
      location,
      wifiAvailable: locationService.isWiFiAvailable(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function startServer() {
  return new Promise((resolve, reject) => {
    const server = app
      .listen(PORT, () => {
        console.log(`Web interface running at http://localhost:${PORT}`);
        resolve(server);
      })
      .on("error", reject);
  });
}

module.exports = { app, startServer };
