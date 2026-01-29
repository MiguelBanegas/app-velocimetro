export const DEFAULT_SETTINGS = {
  speedThresholds: [60, 80, 100] as [number, number, number],
  alertInterval: 10000, // ms (10 seconds)
  unit: "km/h",
  beepTone: "beep1" as "beep1" | "beep2" | "beep3",
  updateInterval: 1000, // ms (1 second) - Intervalo de actualización GPS
};

export const MAX_ALERT_REPEATS = 2; // Número máximo de repeticiones por nivel

export const STORAGE_KEYS = {
  SETTINGS: "user_settings",
  ODOMETER_1: "odometer_1",
  ODOMETER_2: "odometer_2",
};

export const BACKGROUND_TRACKING_TASK = "BACKGROUND_SPEED_TRACKING";
