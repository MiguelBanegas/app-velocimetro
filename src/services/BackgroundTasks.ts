import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import {
    BACKGROUND_DEVICE_TRACKING_TASK,
    BACKGROUND_TRACKING_TASK,
    MAX_ALERT_REPEATS,
    STORAGE_KEYS,
} from "../constants/Settings";
import { AlertState, Settings } from "../types/types";
import { calculateDistanceKm } from "../utils/geo";
import { AlertService } from "./AlertService";
import ApiService from "./ApiService";
import { DrivingStatsService } from "./DrivingStatsService";
import { msToKmh } from "./LocationService";
import { LogService } from "./LogService";
import { SettingsService } from "./SettingsService";

let lastLocation: { latitude: number; longitude: number } | null = null;
let lastHeartbeatTimeBG = 0;
let lastHeartbeatTimeLOC = 0;
let cachedSettings: Settings | null = null;
let lastSettingsLoadTime = 0;
let pendingOdometer1 = 0;
let pendingOdometer2 = 0;
let lastOdometerSaveTime = 0;
let lastKnownLat = 0;
let lastKnownLon = 0;
let lastMovementTimestamp = Date.now();
let isTaskRunningBG = false;
let isTaskRunningLOC = false;
let lastDeviceReportTime = 0; // Local lock for both tasks

const DEVICE_MOVE_THRESHOLD_KM = 0.02; // 20m
const DEVICE_MOVING_REPORT_MS = 60_000; // 1 min
const DEVICE_STATIONARY_REPORT_MS = 600_000; // 10 min

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

// --- TAREA 1: RASTREO DE RECORRIDO Y ALERTAS ---
TaskManager.defineTask(
  BACKGROUND_TRACKING_TASK,
  async ({ data, error }: any) => {
    LogService.setTag("BG");
    DrivingStatsService.setAsBackgroundProcess();
    await DrivingStatsService.syncWithStorage();

    if (error) {
      LogService.log("ERROR", "BT Error", error.message || String(error));
      return;
    }

    if (data) {
      try {
        const { locations } = data;
        const location = locations[locations.length - 1];

        if (location && location.coords) {
          const { latitude, longitude, speed: speedMs } = location.coords;
          const speedKmh = parseFloat(msToKmh(speedMs || 0));
          const now = Date.now();

          // Log de diagnóstico para cada punto
          if (Math.random() > 0.9) {
            LogService.log(
              "DEBUG",
              "Punto recibido",
              `${speedKmh.toFixed(1)} km/h`,
              "BG",
            );
          }

          // Heartbeat cada 30 min para el Tracker (BG) para no saturar
          if (now - lastHeartbeatTimeBG > 1_800_000) {
            lastHeartbeatTimeBG = now;
            LogService.log(
              "INFO",
              "Heartbeat Activo",
              `${speedKmh.toFixed(1)} km/h`,
              "BG",
            );
          }

          await DrivingStatsService.updateLocation(speedKmh, {
            latitude,
            longitude,
            timestamp: location.timestamp,
            altitude: location.coords.altitude,
          });

          const settings =
            !cachedSettings || now - lastSettingsLoadTime > 45_000
              ? await SettingsService.getSettings()
              : cachedSettings;

          if (!cachedSettings) {
            cachedSettings = settings;
            lastSettingsLoadTime = now;
          }

          if (settings.isLocatorEnabled) {
            // LOCK LOCAL: Evitar que ráfagas de eventos del OS disparen ráfagas de reportes
            if (now - lastDeviceReportTime >= 55_000) {
              lastDeviceReportTime = now; // Bloqueo inmediato

              const lastSentAtStr = await AsyncStorage.getItem(
                STORAGE_KEYS.DEVICE_LAST_SENT,
              );
              const lastSentAt = lastSentAtStr ? parseInt(lastSentAtStr) : 0;
              const elapsedSinceLastSent = now - lastSentAt;

              const [lastSentLatStr, lastSentLonStr] = await Promise.all([
                AsyncStorage.getItem(STORAGE_KEYS.DEVICE_LAST_LAT),
                AsyncStorage.getItem(STORAGE_KEYS.DEVICE_LAST_LON),
              ]);

              const lastSentLat = lastSentLatStr
                ? parseFloat(lastSentLatStr)
                : 0;
              const lastSentLon = lastSentLonStr
                ? parseFloat(lastSentLonStr)
                : 0;

              const distFromLastReport = calculateDistanceKm(
                lastSentLat,
                lastSentLon,
                latitude,
                longitude,
              );

              const shouldReportStationary =
                elapsedSinceLastSent >= DEVICE_STATIONARY_REPORT_MS;
              const shouldReportMovement =
                distFromLastReport >= DEVICE_MOVE_THRESHOLD_KM &&
                elapsedSinceLastSent >= DEVICE_MOVING_REPORT_MS;

              if (shouldReportStationary || shouldReportMovement) {
                const deviceId = await AsyncStorage.getItem(
                  STORAGE_KEYS.DEVICE_ID,
                );
                LogService.log(
                  "INFO",
                  shouldReportStationary
                    ? "Reporte forzado"
                    : `Reportando ${(distFromLastReport * 1000).toFixed(0)}m`,
                  undefined,
                  "BG-LOC",
                );

                await ApiService.postDeviceLocation({
                  device_id: deviceId || "unknown",
                  lat: latitude,
                  lon: longitude,
                });

                await AsyncStorage.multiSet([
                  [STORAGE_KEYS.DEVICE_LAST_SENT, now.toString()],
                  [STORAGE_KEYS.DEVICE_LAST_LAT, latitude.toString()],
                  [STORAGE_KEYS.DEVICE_LAST_LON, longitude.toString()],
                ]);
              }
            }
          }

          if (lastLocation) {
            const distanceKm = calculateDistanceKm(
              lastLocation.latitude,
              lastLocation.longitude,
              latitude,
              longitude,
            );
            if (distanceKm > 0.001) {
              pendingOdometer1 += distanceKm;
              pendingOdometer2 += distanceKm;
              if (
                now - lastOdometerSaveTime > 30_000 ||
                pendingOdometer1 > 0.5
              ) {
                await SettingsService.addToOdometer(1, pendingOdometer1);
                await SettingsService.addToOdometer(2, pendingOdometer2);
                pendingOdometer1 = 0;
                pendingOdometer2 = 0;
                lastOdometerSaveTime = now;
              }
            }
          }
          lastLocation = { latitude, longitude };

          initializeAlertStates(settings.speedThresholds);
          const currentLevel = getCurrentAlertLevel(
            speedKmh,
            settings.speedThresholds,
          );
          const HYSTERESIS = 2;
          const state =
            currentLevel !== null ? alertStates.get(currentLevel) : null;

          if (currentLevel !== null && state) {
            if (
              lastAnnouncedLevel === null ||
              currentLevel > lastAnnouncedLevel
            ) {
              state.isActive = true;
              state.repeatCount = 1;
              state.lastAlertTime = now;
              // 1 BEEP al superar límite, sin anuncios de voz
              await AlertService.playBeep(1);
              lastAnnouncedLevel = currentLevel;
              settings.speedThresholds.forEach((t) => {
                if (t < currentLevel) {
                  const s = alertStates.get(t);
                  if (s) {
                    s.isActive = false;
                    s.repeatCount = 0;
                  }
                }
              });
            } else if (speedKmh < lastAnnouncedLevel - HYSTERESIS) {
              const newLevel = getCurrentAlertLevel(
                speedKmh,
                settings.speedThresholds,
              );
              if (newLevel !== lastAnnouncedLevel) {
                // 1 BEEP al bajar del límite
                await AlertService.playBeep(1);
                lastAnnouncedLevel = newLevel;
                settings.speedThresholds.forEach((t) => {
                  if (t > (newLevel || 0)) {
                    const s = alertStates.get(t);
                    if (s) {
                      s.isActive = false;
                      s.repeatCount = 0;
                    }
                  }
                });
                if (newLevel !== null) {
                  const s = alertStates.get(newLevel);
                  if (s) {
                    s.isActive = true;
                    s.repeatCount = 1;
                    s.lastAlertTime = now;
                  }
                }
              }
            } else if (currentLevel === lastAnnouncedLevel) {
              if (
                state.repeatCount < MAX_ALERT_REPEATS &&
                now - state.lastAlertTime > settings.alertInterval
              ) {
                state.repeatCount += 1;
                state.lastAlertTime = now;
                await AlertService.playBeep(1);
              }
            }
          } else {
            if (
              lastAnnouncedLevel !== null &&
              speedKmh < settings.speedThresholds[0] - HYSTERESIS
            ) {
              AlertService.playBeep();
              lastAnnouncedLevel = null;
              alertStates.forEach((s) => {
                s.isActive = false;
                s.repeatCount = 0;
              });
            }
          }
        }
      } catch (e: any) {
        LogService.log("ERROR", "Task BG crash", e.message);
      }
    }
  },
);

// --- TAREA 2: LOCALIZADOR PERMANENTE (DEVICE TRACKING) ---
TaskManager.defineTask(
  BACKGROUND_DEVICE_TRACKING_TASK,
  async ({ data, error }: any) => {
    LogService.setTag("LOC");
    if (error) {
      LogService.log("ERROR", "Loc Task Error", error.message);
      return;
    }
    if (data) {
      try {
        const { locations } = data;
        const location = locations[locations.length - 1];
        if (location && location.coords) {
          const { latitude, longitude } = location.coords;
          const now = Date.now();

          const settings = await SettingsService.getSettings();

          if (settings.isLocatorEnabled) {
            const deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);

            // Heartbeat cada 15 min para el Localizador Permanente (LOC)
            if (now - lastHeartbeatTimeLOC > 900_000) {
              lastHeartbeatTimeLOC = now;
              LogService.log(
                "INFO",
                "Heartbeat Permanente",
                `v:${latitude.toFixed(4)},${longitude.toFixed(4)}`,
                "LOC",
              );
            }

            // Reportar como mínimo cada 10 min aunque no haya movimiento
            if (now - lastDeviceReportTime < 55_000) return;
            lastDeviceReportTime = now; // Bloqueo inmediato local

            const lastSentAtStr = await AsyncStorage.getItem(
              STORAGE_KEYS.DEVICE_LAST_SENT,
            );
            const lastSentAt = lastSentAtStr ? parseInt(lastSentAtStr) : 0;
            const elapsedSinceLastSent = now - lastSentAt;

            const [lastSentLatStr, lastSentLonStr] = await Promise.all([
              AsyncStorage.getItem(STORAGE_KEYS.DEVICE_LAST_LAT),
              AsyncStorage.getItem(STORAGE_KEYS.DEVICE_LAST_LON),
            ]);

            const lastSentLat = lastSentLatStr ? parseFloat(lastSentLatStr) : 0;
            const lastSentLon = lastSentLonStr ? parseFloat(lastSentLonStr) : 0;

            const distFromLastReport = calculateDistanceKm(
              lastSentLat,
              lastSentLon,
              latitude,
              longitude,
            );

            const shouldReportStationary =
              elapsedSinceLastSent >= DEVICE_STATIONARY_REPORT_MS;
            const shouldReportMovement =
              distFromLastReport >= DEVICE_MOVE_THRESHOLD_KM &&
              elapsedSinceLastSent >= DEVICE_MOVING_REPORT_MS;

            if (shouldReportStationary || shouldReportMovement) {
              const deviceId = await AsyncStorage.getItem(
                STORAGE_KEYS.DEVICE_ID,
              );
              LogService.log(
                "INFO",
                shouldReportStationary
                  ? "Reporte forzado por tiempo"
                  : `Reportando cambio (${(distFromLastReport * 1000).toFixed(0)}m)`,
                `${latitude.toFixed(5)},${longitude.toFixed(5)}`,
                "LOC",
              );

              await ApiService.postDeviceLocation({
                device_id: deviceId || "unknown",
                lat: latitude,
                lon: longitude,
              });

              // Guardar persistencia
              await Promise.all([
                AsyncStorage.multiSet([
                  [STORAGE_KEYS.DEVICE_LAST_SENT, now.toString()],
                  [STORAGE_KEYS.DEVICE_LAST_LAT, latitude.toString()],
                  [STORAGE_KEYS.DEVICE_LAST_LON, longitude.toString()],
                ]),
                Math.random() > 0.5
                  ? ApiService.drainQueue()
                  : Promise.resolve(),
              ]);
            }
          }
        }
      } catch (e: any) {
        LogService.setTag("LOC-BG");
        LogService.log("ERROR", "Loc Task Crash", e.message);
        console.error("Loc Task Crash:", e);
      }
    }
  },
);
