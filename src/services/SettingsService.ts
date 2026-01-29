import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../constants/Settings";
import { Settings } from "../types/types";

export const SettingsService = {
  getSettings: async (): Promise<Settings> => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (jsonValue != null) {
        const settings = JSON.parse(jsonValue);
        // Migración básica si falta speedThresholds
        if (!settings.speedThresholds && settings.speedThreshold) {
          settings.speedThresholds = [
            settings.speedThreshold,
            settings.speedThreshold + 20,
            settings.speedThreshold + 40,
          ];
          delete settings.speedThreshold;
        }
        // Asegurar que beepTone existe
        if (!settings.beepTone) {
          settings.beepTone = DEFAULT_SETTINGS.beepTone;
        }
        // Asegurar que updateInterval existe
        if (!settings.updateInterval) {
          settings.updateInterval = DEFAULT_SETTINGS.updateInterval;
        }
        return settings;
      }
      return DEFAULT_SETTINGS;
    } catch (e) {
      console.error("Error reading settings", e);
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings: async (settings: Settings) => {
    try {
      const jsonValue = JSON.stringify(settings);
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, jsonValue);
      return true;
    } catch (e) {
      console.error("Error saving settings", e);
      return false;
    }
  },

  getOdometer: async (id: 1 | 2) => {
    try {
      const key = id === 1 ? STORAGE_KEYS.ODOMETER_1 : STORAGE_KEYS.ODOMETER_2;
      const value = await AsyncStorage.getItem(key);
      return value != null ? parseFloat(value) : 0;
    } catch (e) {
      console.error(`Error reading odometer ${id}`, e);
      return 0;
    }
  },

  addToOdometer: async (id: 1 | 2, distanceKm: number) => {
    try {
      const current = await SettingsService.getOdometer(id);
      const newValue = current + distanceKm;
      const key = id === 1 ? STORAGE_KEYS.ODOMETER_1 : STORAGE_KEYS.ODOMETER_2;
      await AsyncStorage.setItem(key, newValue.toString());
      return newValue;
    } catch (e) {
      console.error(`Error adding to odometer ${id}`, e);
      return 0;
    }
  },

  resetOdometer: async (id: 1 | 2) => {
    try {
      const key = id === 1 ? STORAGE_KEYS.ODOMETER_1 : STORAGE_KEYS.ODOMETER_2;
      await AsyncStorage.setItem(key, "0");
      return 0;
    } catch (e) {
      console.error(`Error resetting odometer ${id}`, e);
      return 0;
    }
  },
};
