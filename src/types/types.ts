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
  altitude?: number | null; // Nueva propiedad opcional para la altitud
}

export interface Settings {
  speedThresholds: [number, number, number];
  alertInterval: number;
  unit: string;
  beepTone: "beep1" | "beep2" | "beep3";
  customBeepUri?: string; // URI del archivo de audio personalizado
  updateInterval: number; // Intervalo de actualización GPS en ms
  isLocatorEnabled: boolean; // Indica si el rastreo permanente del dispositivo está activo
}

export interface DrivingStats {
  startTime: number | null;
  maxSpeed: number; // Nueva propiedad para velocidad máxima
  drivingTime: number; // en segundos
  stoppedTime: number; // tiempo detenido en segundos (velocidad < 10 km/h)
  routePoints: RoutePoint[]; // Historial de coordenadas
  isBackgroundTracking: boolean;
  isSyncing?: boolean; // indica si se está enviando/esperando respuesta al servidor
}

export interface HistoryItem {
  id: string;
  startTime: number;
  endTime: number;
  drivingTime: number;
  stoppedTime: number;
  distance: number;
  maxSpeed: number;
  avgSpeed: number;
  routePoints: RoutePoint[];
  remoteTrackId?: number; // ID del track remoto si fue creado
}
