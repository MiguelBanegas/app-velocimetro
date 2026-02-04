import * as TaskManager from "expo-task-manager";
import {
    BACKGROUND_TRACKING_TASK,
    MAX_ALERT_REPEATS,
} from "../constants/Settings";
import { AlertState } from "../types/types";
import { AlertService } from "./AlertService";
import { DrivingStatsService } from "./DrivingStatsService";
import { msToKmh } from "./LocationService";
import { SettingsService } from "./SettingsService";
import { calculateDistanceKm } from "../utils/geo";

let lastLocation: { latitude: number; longitude: number } | null = null;

// Estado de alertas por cada nivel de velocidad
const alertStates: Map<number, AlertState> = new Map();

// Último nivel de velocidad anunciado (para evitar anuncios redundantes)
let lastAnnouncedLevel: number | null = null;

// Función auxiliar para obtener el nivel de alerta actual
const getCurrentAlertLevel = (
  speed: number,
  thresholds: number[],
): number | null => {
  const sortedThresholds = [...thresholds].sort((a, b) => b - a);
  for (const threshold of sortedThresholds) {
    if (speed > threshold) {
      return threshold;
    }
  }
  return null;
};

// Función auxiliar para inicializar estados de alerta
const initializeAlertStates = (thresholds: number[]) => {
  thresholds.forEach((threshold) => {
    if (!alertStates.has(threshold)) {
      alertStates.set(threshold, {
        level: threshold,
        repeatCount: 0,
        isActive: false,
        lastAlertTime: 0,
      });
    }
  });
};

TaskManager.defineTask(
  BACKGROUND_TRACKING_TASK,
  async ({ data, error }: any) => {
    if (error) {
      console.error("Task Error:", error);
      return;
    }

    if (data) {
      const { locations } = data;
      const location = locations[0];

      if (location && location.coords) {
        const { latitude, longitude, speed: speedMs } = location.coords;
        const speedKmh = parseFloat(msToKmh(speedMs || 0));

        // 0. Asegurar que el estado esté cargado (especialmente en procesos de fondo nuevos)
        await DrivingStatsService.loadState();

        // 1. Actualizar estadísticas de conducción
        await DrivingStatsService.updateSpeed(speedKmh);

        // 2. Guardar punto en la ruta
        await DrivingStatsService.addRoutePoint({
          latitude,
          longitude,
          speed: speedKmh,
        });

        // 3. Cálculo de Odómetros
        if (lastLocation) {
          const distanceKm = calculateDistanceKm(
            lastLocation.latitude,
            lastLocation.longitude,
            latitude,
            longitude,
          );

          if (distanceKm > 0) {
            await SettingsService.addToOdometer(1, distanceKm);
            await SettingsService.addToOdometer(2, distanceKm);
          }
        }
        lastLocation = { latitude, longitude };

        // 3. Sistema de Alertas de Velocidad Mejorado
        const settings = await SettingsService.getSettings();
        const now = Date.now();

        // Inicializar estados si es necesario
        initializeAlertStates(settings.speedThresholds);

        // Determinar el nivel de alerta actual
        const currentLevel = getCurrentAlertLevel(
          speedKmh,
          settings.speedThresholds,
        );

        // NUEVA LÓGICA: Solo anunciar si subimos a un nivel superior
        if (currentLevel !== null) {
          // Estamos en algún nivel de alerta
          if (
            lastAnnouncedLevel === null ||
            currentLevel > lastAnnouncedLevel
          ) {
            // Subimos a un nivel superior (o es el primer nivel)
            const state = alertStates.get(currentLevel)!;

            if (!state.isActive) {
              // Primera vez que entramos a este nivel
              state.isActive = true;
              state.repeatCount = 1;
              state.lastAlertTime = now;
              AlertService.speakSpeed(currentLevel);
              lastAnnouncedLevel = currentLevel;
            } else if (
              state.repeatCount < MAX_ALERT_REPEATS &&
              now - state.lastAlertTime > settings.alertInterval
            ) {
              // Repetir alerta si no hemos alcanzado el máximo
              state.repeatCount += 1;
              state.lastAlertTime = now;
              AlertService.speakSpeed(currentLevel);
            }

            // Desactivar estados de niveles inferiores
            settings.speedThresholds.forEach((threshold: number) => {
              if (threshold < currentLevel) {
                const lowerState = alertStates.get(threshold)!;
                lowerState.isActive = false;
                lowerState.repeatCount = 0;
              }
            });
          }
          // Si currentLevel <= lastAnnouncedLevel, no hacemos nada
          // (estamos bajando a un nivel intermedio, no anunciamos)
        } else {
          // Bajamos por debajo de TODOS los umbrales
          if (lastAnnouncedLevel !== null) {
            AlertService.playBeep();
            lastAnnouncedLevel = null;

            // Resetear todos los estados
            alertStates.forEach((state) => {
              state.isActive = false;
              state.repeatCount = 0;
            });
          }
        }
      }
    }
  },
);
