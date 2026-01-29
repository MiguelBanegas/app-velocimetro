import * as Location from "expo-location";
import { BACKGROUND_TRACKING_TASK } from "../constants/Settings";
import { SettingsService } from "./SettingsService";

export const LocationService = {
  requestPermissions: async () => {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      throw new Error(
        "Se requieren permisos de ubicación en primer plano para usar la app.",
      );
    }

    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== "granted") {
      throw new Error(
        "Para que la app funcione con la pantalla apagada, debes seleccionar 'Permitir todo el tiempo' en los ajustes de ubicación de la app.",
      );
    }

    return true;
  },

  startTracking: async () => {
    try {
      await LocationService.requestPermissions();
    } catch (e: any) {
      throw e;
    }

    // Obtener configuración para el intervalo de actualización
    const settings = await SettingsService.getSettings();

    await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: settings.updateInterval, // Usar intervalo desde configuración
      distanceInterval: 5,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "🚗 Rastreo de Velocidad Activo",
        notificationBody: "Monitoreando tu velocidad en segundo plano",
        notificationColor: "#0a7ea4",
      },
    });
  },

  stopTracking: async () => {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_TRACKING_TASK,
    );
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
    }
  },

  isTracking: async () => {
    return await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_TRACKING_TASK,
    );
  },

  // Haversine formula to calculate distance between two points in km
  calculateDistance: (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },
};

export const msToKmh = (ms: number) => (ms * 3.6).toFixed(1);
