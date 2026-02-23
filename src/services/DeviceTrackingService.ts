import * as Location from "expo-location";
import { BACKGROUND_DEVICE_TRACKING_TASK } from "../constants/Settings";

export const DeviceTrackingService = {
  requestPermissions: async () => {
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      throw new Error(
        "Se requieren permisos de ubicación en primer plano para rastreo del dispositivo.",
      );
    }

    const { status: backgroundStatus } =
      await Location.requestBackgroundPermissionsAsync();

    if (backgroundStatus !== "granted") {
      throw new Error(
        "Para rastrear el dispositivo en segundo plano, debes seleccionar 'Permitir todo el tiempo' en los ajustes de ubicación de la app.",
      );
    }

    return true;
  },

  startTracking: async () => {
    try {
      await DeviceTrackingService.requestPermissions();
    } catch (e: any) {
      throw e;
    }

    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_DEVICE_TRACKING_TASK,
    );

    const { LogService } = require("./LogService");
    LogService.setTag("LOC");

    if (isRunning) {
      LogService.log("INFO", "Localizador ya está corriendo");
      return;
    }

    LogService.log("INFO", "Iniciando Localizador Permanente");
    await Location.startLocationUpdatesAsync(BACKGROUND_DEVICE_TRACKING_TASK, {
      // Más estable en segundo plano que Balanced cuando la app no está en primer plano.
      accuracy: Location.Accuracy.High,
      timeInterval: 30_000,
      // En algunos equipos Android, distanceInterval > 0 evita callbacks estando quieto.
      // Lo dejamos en 0 para permitir heartbeat por tiempo aun sin movimiento.
      distanceInterval: 0,
      deferredUpdatesInterval: 60_000,
      deferredUpdatesDistance: 0,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      // Indispensable para que Android no mate el proceso
      foregroundService: {
        notificationTitle: "Localizador Activo",
        notificationBody: "Reportando posición en segundo plano",
        notificationColor: "#FF0000",
        killServiceOnDestroy: false,
      },
    });
  },

  stopTracking: async () => {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_DEVICE_TRACKING_TASK,
    );
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_DEVICE_TRACKING_TASK);
    }
  },

  isTracking: async () => {
    return await Location.hasStartedLocationUpdatesAsync(
      BACKGROUND_DEVICE_TRACKING_TASK,
    );
  },
};
