import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/Settings";
import { postDeviceLocation } from "./ApiService";
import { SettingsService } from "./SettingsService";

const REPORT_INTERVAL_MS = 30_000;
const MIN_MOVE_DEG = 1e-5; // ~1.1m lat diff, simple filter

let inFlight = false;
let lastSentMs = 0;

export const DeviceLocationService = {
  sendIfDue: async (params: {
    latitude: number;
    longitude: number;
    recordedAt: number;
  }) => {
    try {
      if (inFlight) return;
      const lastRaw = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_LAST_SENT);
      const lastSentStorage = lastRaw ? parseInt(lastRaw, 10) : 0;
      const lastSent = Math.max(lastSentStorage, lastSentMs);
      const now = Date.now();
      if (now - lastSent < REPORT_INTERVAL_MS) return;

      const lastLatRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.DEVICE_LAST_LAT,
      );
      const lastLonRaw = await AsyncStorage.getItem(
        STORAGE_KEYS.DEVICE_LAST_LON,
      );
      const lastLat = lastLatRaw ? parseFloat(lastLatRaw) : null;
      const lastLon = lastLonRaw ? parseFloat(lastLonRaw) : null;
      if (lastLat !== null && lastLon !== null) {
        const latDiff = Math.abs(params.latitude - lastLat);
        const lonDiff = Math.abs(params.longitude - lastLon);
        if (latDiff < MIN_MOVE_DEG && lonDiff < MIN_MOVE_DEG) {
          return;
        }
      }

      inFlight = true;
      lastSentMs = now;
      await AsyncStorage.setItem(
        STORAGE_KEYS.DEVICE_LAST_SENT,
        now.toString(),
      );

      const device_id = await SettingsService.getDeviceId();
      await postDeviceLocation({
        device_id,
        lat: params.latitude,
        lon: params.longitude,
      });

      await AsyncStorage.setItem(
        STORAGE_KEYS.DEVICE_LAST_LAT,
        params.latitude.toString(),
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.DEVICE_LAST_LON,
        params.longitude.toString(),
      );
    } catch (e) {
      console.warn("DeviceLocationService.sendIfDue error:", e);
    } finally {
      inFlight = false;
    }
  },
};
