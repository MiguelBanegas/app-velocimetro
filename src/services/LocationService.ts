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

};

export const msToKmh = (ms: number) => (ms * 3.6).toFixed(1);
