import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/Settings";
import { postDeviceLocation } from "./ApiService";
import { SettingsService } from "./SettingsService";

const REPORT_INTERVAL_MS = 60_000; // 1 minuto para seguimiento de dispositivo
const MIN_MOVE_DEG = 1e-4; // ~11m lat diff, simple filter

let inFlight = false;
let lastSentMs = 0;
let lastLat: number | null = null;
let lastLon: number | null = null;
let isCacheLoaded = false;

/**
 * Servicio de reporte de ubicación del dispositivo (independiente del rastreo de sesión)
 */
export const DeviceLocationService = {
  /**
   * Carga inicial de valores desde storage para evitar duplicaciones
   */
  loadCache: async () => {
    if (isCacheLoaded) return;
    try {
      const [sent, lat, lon] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.DEVICE_LAST_SENT),
        AsyncStorage.getItem(STORAGE_KEYS.DEVICE_LAST_LAT),
        AsyncStorage.getItem(STORAGE_KEYS.DEVICE_LAST_LON),
      ]);
      if (sent) lastSentMs = parseInt(sent, 10);
      if (lat) lastLat = parseFloat(lat);
      if (lon) lastLon = parseFloat(lon);
      isCacheLoaded = true;
    } catch (e) {
      console.warn("Error loading DeviceLocationService cache:", e);
    }
  },

  sendIfDue: async (params: {
    latitude: number;
    longitude: number;
    recordedAt: number;
  }) => {
    try {
      if (inFlight) return;

      // Asegurar que la caché esté lista
      if (!isCacheLoaded) await DeviceLocationService.loadCache();

      const now = Date.now();
      // Si el reporte es demasiado reciente, ignorar
      if (now - lastSentMs < REPORT_INTERVAL_MS) return;

      // Filtro de movimiento (si no se ha movido significativamente, no enviar)
      if (lastLat !== null && lastLon !== null) {
        const latDiff = Math.abs(params.latitude - lastLat);
        const lonDiff = Math.abs(params.longitude - lastLon);
        if (latDiff < MIN_MOVE_DEG && lonDiff < MIN_MOVE_DEG) {
          return;
        }
      }

      inFlight = true;
      lastSentMs = now;
      lastLat = params.latitude;
      lastLon = params.longitude;

      // Guardar en storage de forma asíncrona para persistencia
      AsyncStorage.multiSet([
        [STORAGE_KEYS.DEVICE_LAST_SENT, now.toString()],
        [STORAGE_KEYS.DEVICE_LAST_LAT, params.latitude.toString()],
        [STORAGE_KEYS.DEVICE_LAST_LON, params.longitude.toString()],
      ]).catch(() => {});

      const device_id = await SettingsService.getDeviceId();
      await postDeviceLocation({
        device_id,
        lat: params.latitude,
        lon: params.longitude,
      });
    } catch (e: any) {
      const { LogService } = require("./LogService");
      LogService.log("ERROR", "DeviceLoc fail", e.message || String(e));
      console.warn("DeviceLocationService.sendIfDue error:", e);
    } finally {
      inFlight = false;
    }
  },
};
