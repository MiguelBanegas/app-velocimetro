export interface AlertState {
  level: number;
  repeatCount: number;
  isActive: boolean;
  lastAlertTime: number;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number;
}

export interface Settings {
  speedThresholds: [number, number, number];
  alertInterval: number;
  unit: string;
  beepTone: "beep1" | "beep2" | "beep3";
  customBeepUri?: string; // URI del archivo de audio personalizado
  updateInterval: number; // Intervalo de actualización GPS en ms
}

export interface DrivingStats {
  startTime: number | null;
  maxSpeed: number; // Nueva propiedad para velocidad máxima
  drivingTime: number; // en segundos
  stoppedTime: number; // tiempo detenido en segundos (velocidad < 10 km/h)
  routePoints: RoutePoint[]; // Historial de coordenadas
  isBackgroundTracking: boolean;
}

export interface HistoryItem {
  id: string;
  startTime: number;
  endTime: number;
  drivingTime: number;
  stoppedTime: number;
  distance: number;
  maxSpeed: number;
  routePoints: RoutePoint[];
}
