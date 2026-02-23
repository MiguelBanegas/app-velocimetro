import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";

export const TRACKING_TASK = "ORION_SILENT_TRACKING";
const API_URL = "https://api.appvelocidad.mabcontrol.ar/devices/locations";

// Umbral de movimiento mucho más sensible (~5-10 metros)
const MOVE_THRESHOLD = 0.00005;
// Tiempo máximo sin enviar aunque esté quieto (10 minutos)
const HEARTBEAT_INTERVAL = 10 * 60 * 1000;

TaskManager.defineTask(TRACKING_TASK, async ({ data, error }: any) => {
  if (error) return;
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (location && location.coords) {
      try {
        const { latitude, longitude } = location.coords;
        const device_id = await AsyncStorage.getItem("device_id");
        if (!device_id) return;

        // 1. Obtener última posición enviada para comparar
        const lastLat = await AsyncStorage.getItem("last_lat");
        const lastLon = await AsyncStorage.getItem("last_lon");
        const lastSentAt = await AsyncStorage.getItem("last_sent_at");

        const now = Date.now();
        const lastSentTime = lastSentAt ? parseInt(lastSentAt) : 0;

        let shouldSend = false;

        if (!lastLat || !lastLon) {
          shouldSend = true;
        } else {
          const latDiff = Math.abs(latitude - parseFloat(lastLat));
          const lonDiff = Math.abs(longitude - parseFloat(lastLon));

          if (latDiff > MOVE_THRESHOLD || lonDiff > MOVE_THRESHOLD) {
            shouldSend = true;
          } else if (now - lastSentTime > HEARTBEAT_INTERVAL) {
            shouldSend = true;
          }
        }

        if (shouldSend) {
          try {
            const response = await fetch(API_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                device_id,
                lat: latitude,
                lon: longitude,
              }),
            });

            if (response.ok) {
              await AsyncStorage.setItem("last_lat", latitude.toString());
              await AsyncStorage.setItem("last_lon", longitude.toString());
              await AsyncStorage.setItem("last_sent_at", now.toString());
              await AsyncStorage.setItem("last_sync_status", "success");
            } else {
              await AsyncStorage.setItem("last_sync_status", "fail");
            }
          } catch (fetchError) {
            await AsyncStorage.setItem("last_sync_status", "error");
            throw fetchError;
          }
        }
      } catch (e) {
        console.log("Rastreador: Error en tarea de fondo", e);
      }
    }
  }
});
