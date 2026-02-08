import AsyncStorage from "@react-native-async-storage/async-storage";
import { DrivingStats, HistoryItem } from "../types/types";
import { calculateDistanceKm } from "../utils/geo";
import { drainQueue, postPoints, startTrack } from "./ApiService";
import { SettingsService } from "./SettingsService";

const STATS_STORAGE_KEY = "@driving_stats";
const HISTORY_STORAGE_KEY = "@history_stats";
const MIN_MOVE_DEG = 1e-5; // ~1.1m lat diff, simple filter
const MIN_MOVE_KM = 0.01; // 10m jitter filter for distance calc

class DrivingStatsServiceClass {
  private stats: DrivingStats = {
    startTime: null,
    maxSpeed: 0,
    drivingTime: 0,
    stoppedTime: 0,
    routePoints: [],
    isBackgroundTracking: false,
  };

  private lastUpdateTime: number | null = null;
  private lastSpeed: number = 0;
  private isTracking: boolean = false;
  private accumulatedDrivingTime: number = 0; // Tiempo acumulado en segundos
  private accumulatedStoppedTime: number = 0; // Tiempo detenido acumulado en segundos
  private sessionStartTime: number | null = null; // Inicio de la sesión actual
  private lastStoppedStartTime: number | null = null; // Cuándo empezó el estado detenido actual
  private currentRemoteTrackId: number | null = null; // track_id en el servidor
  private listeners: (() => void)[] = [];
  private isSyncing: boolean = false;

  constructor() {
    this.loadState();
    // intentar drenar la cola de envíos fallidos en segundo plano
    (async () => {
      try {
        await drainQueue();
      } catch {}
    })();
  }

  private async saveState() {
    try {
      const state = {
        stats: this.stats,
        accumulatedDrivingTime: this.accumulatedDrivingTime,
        accumulatedStoppedTime: this.accumulatedStoppedTime,
        sessionStartTime: this.sessionStartTime,
        lastStoppedStartTime: this.lastStoppedStartTime,
        isTracking: this.isTracking,
        currentRemoteTrackId: this.currentRemoteTrackId,
      };
      await AsyncStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Error saving driving stats:", e);
    }
  }

  async loadState() {
    try {
      const saved = await AsyncStorage.getItem(STATS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.stats = parsed.stats;
        this.accumulatedDrivingTime = parsed.accumulatedDrivingTime || 0;
        this.accumulatedStoppedTime = parsed.accumulatedStoppedTime || 0;
        this.sessionStartTime = parsed.sessionStartTime;
        this.lastStoppedStartTime = parsed.lastStoppedStartTime;
        this.isTracking = parsed.isTracking || false;
        this.currentRemoteTrackId = parsed.currentRemoteTrackId || null;
        this.notifyListeners();
      }
    } catch (e) {
      console.error("Error loading driving stats:", e);
    }
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  private setSyncing(value: boolean) {
    this.isSyncing = value;
    // reflect in stats for subscribers
    try {
      this.stats.isSyncing = value;
    } catch {}
    this.notifyListeners();
  }

  async startSession() {
    // Si ya hay una sesión en curso, solo reanudar
    if (this.sessionStartTime !== null) {
      this.isTracking = true;
      this.stats.isBackgroundTracking = true;
      this.sessionStartTime = Date.now();
      this.notifyListeners();
      await this.saveState();
      return;
    }

    // Nueva sesión desde cero
    this.stats = {
      startTime: Date.now(),
      maxSpeed: 0,
      drivingTime: 0,
      stoppedTime: 0,
      routePoints: [],
      isBackgroundTracking: true,
    };
    this.accumulatedDrivingTime = 0;
    this.accumulatedStoppedTime = 0;
    this.sessionStartTime = Date.now();
    this.lastUpdateTime = Date.now();
    this.lastStoppedStartTime = Date.now(); // Empezamos como "detenido" hasta recibir velocidad
    this.lastSpeed = 0;
    this.isTracking = true;
    this.notifyListeners();
    await this.saveState();

    // Intentar crear track remoto al iniciar la sesión (esperar a que se cree)
    try {
      this.setSyncing(true);
      const user_id = await SettingsService.getUserId();
      const device_id = await SettingsService.getDeviceId();
      const startResp: any = await startTrack(user_id, device_id);
      const trackId =
        startResp && startResp.track_id ? startResp.track_id : null;
      if (trackId) {
        this.currentRemoteTrackId = trackId;
        await this.saveState();
      }
    } catch (e) {
      console.warn("Error starting remote track on session start:", e);
    } finally {
      this.setSyncing(false);
    }
  }

  async pauseSession() {
    if (!this.isTracking || this.sessionStartTime === null) return;

    // Acumular el tiempo de esta sesión
    const now = Date.now();
    const sessionDuration = (now - this.sessionStartTime) / 1000;
    this.accumulatedDrivingTime += sessionDuration;
    this.stats.drivingTime = Math.floor(this.accumulatedDrivingTime);

    if (this.lastStoppedStartTime !== null) {
      this.accumulatedStoppedTime += (now - this.lastStoppedStartTime) / 1000;
      this.stats.stoppedTime = Math.floor(this.accumulatedStoppedTime);
      this.lastStoppedStartTime = null;
    }

    this.isTracking = false;
    this.stats.isBackgroundTracking = false;
    this.sessionStartTime = null;
    this.notifyListeners();
    await this.saveState();
  }

  async resumeSession() {
    if (this.isTracking) return;

    this.isTracking = true;
    this.stats.isBackgroundTracking = true;
    this.sessionStartTime = Date.now();
    this.lastUpdateTime = Date.now();
    if (this.lastSpeed < 10) {
      this.lastStoppedStartTime = Date.now();
    }
    this.notifyListeners();
    await this.saveState();
  }

  async endSession() {
    // Guardar en el historial antes de limpiar
    if (this.stats.startTime !== null) {
      await this.saveSessionToHistory();
    }

    this.stats = {
      startTime: null,
      maxSpeed: 0,
      drivingTime: 0,
      stoppedTime: 0,
      routePoints: [],
      isBackgroundTracking: false,
    };
    this.lastUpdateTime = null;
    this.lastSpeed = 0;
    this.isTracking = false;
    this.accumulatedDrivingTime = 0;
    this.accumulatedStoppedTime = 0;
    this.sessionStartTime = null;
    this.lastStoppedStartTime = null;
    this.notifyListeners();
    await this.saveState();
  }

  async loadHistory(): Promise<HistoryItem[]> {
    try {
      const saved = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error loading history:", e);
      return [];
    }
  }

  private async saveSessionToHistory() {
    try {
      if (this.stats.startTime === null) return;

      const history = await this.loadHistory();
      const currentStats = this.getStats();

      // Filtrar puntos consecutivos con mismas coordenadas y normalizar (incluye speed)
      const EPS = 1e-6;
      const rawPoints = this.stats.routePoints || [];
      const filteredRaw = rawPoints.filter((p, idx, arr) => {
        if (idx === 0) return true;
        const prev = arr[idx - 1];
        return (
          Math.abs(p.latitude - prev.latitude) > EPS ||
          Math.abs(p.longitude - prev.longitude) > EPS
        );
      });

      const normalizedPoints = filteredRaw.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: typeof p.timestamp === "number" ? p.timestamp : Date.now(),
        speed: typeof p.speed === "number" ? Number(p.speed.toFixed(1)) : 0,
        altitude: typeof p.altitude === "number" ? p.altitude : null,
      })).sort((a, b) => a.timestamp - b.timestamp);

      // Calcular distancia acumulada basada en normalizedPoints
      let distance = 0;
      if (normalizedPoints.length > 1) {
        for (let i = 0; i < normalizedPoints.length - 1; i++) {
          const p1 = normalizedPoints[i];
          const p2 = normalizedPoints[i + 1];
          const segmentKm = calculateDistanceKm(
            p1.latitude,
            p1.longitude,
            p2.latitude,
            p2.longitude,
          );
          if (segmentKm >= MIN_MOVE_KM) {
            distance += segmentKm;
          }
        }
      }

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        startTime: this.stats.startTime,
        endTime: Date.now(),
        drivingTime: currentStats.drivingTime,
        stoppedTime: currentStats.stoppedTime,
        distance: parseFloat(distance.toFixed(2)),
        maxSpeed: currentStats.maxSpeed,
        routePoints: [...normalizedPoints],
      };

      history.unshift(newItem); // Agregar al inicio
      await AsyncStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(history.slice(0, 50)),
      ); // Limitar a 50 records

      // Enviar la sesión al servidor: usar track remoto si existe, si no crear, enviar puntos y finalizar
      try {
        await this.sendSessionToServer(newItem, normalizedPoints);
      } catch (e) {
        console.warn("Error enviando sesión a la API:", e);
      }
    } catch (e) {
      console.error("Error saving session to history:", e);
    }
  }

  private async sendSessionToServer(
    newItem: HistoryItem,
    normalizedPoints: any[],
  ) {
    this.setSyncing(true);
    try {
      let trackId = this.currentRemoteTrackId as number | null;

      if (!trackId) {
        const user_id = await SettingsService.getUserId();
        const device_id = await SettingsService.getDeviceId();
        const startResp: any = await startTrack(user_id, device_id);
        trackId = startResp && startResp.track_id ? startResp.track_id : null;
        if (trackId) {
          this.currentRemoteTrackId = trackId;
          await this.saveState();
        }
      }

      if (!trackId) throw new Error("No track_id available to send points");

      const points = normalizedPoints.map((p) => ({
        lat: p.latitude,
        lon: p.longitude,
        altitude: typeof p.altitude === "number" ? p.altitude : null,
        speed: typeof p.speed === "number" ? p.speed : null,
      }));

      if (points.length > 0) {
        await postPoints(trackId, points);
      }

      // Cerrar track remoto actual (aunque no haya puntos)
      try {
        await import("./ApiService").then(({ stopTrack }) =>
          stopTrack(trackId!),
        );
        this.currentRemoteTrackId = null;
        await this.saveState();
      } catch {}
    } finally {
      this.setSyncing(false);
    }
  }

  async clearHistory() {
    try {
      await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
      this.notifyListeners();
    } catch (e) {
      console.error("Error clearing history:", e);
    }
  }

  async deleteHistoryItem(id: string) {
    try {
      const history = await this.loadHistory();
      const filtered = history.filter((item) => item.id !== id);
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered));
      this.notifyListeners();
    } catch (e) {
      console.error("Error deleting history item:", e);
    }
  }

  async updateSpeed(speed: number) {
    // Si no se ha cargado el estado y estamos en fondo, forzar carga
    if (this.stats.startTime === null && !this.isTracking) {
      await this.loadState();
    }

    if (!this.isTracking || this.stats.startTime === null) return;

    const now = Date.now();

    // Calcular tiempo transcurrido desde última actualización para tiempo detenido
    if (this.lastSpeed < 10) {
      if (speed >= 10) {
        // Estaba detenido y ahora se mueve
        if (this.lastStoppedStartTime !== null) {
          this.accumulatedStoppedTime +=
            (now - this.lastStoppedStartTime) / 1000;
          this.stats.stoppedTime = Math.floor(this.accumulatedStoppedTime);
          this.lastStoppedStartTime = null;
        }
      }
    } else {
      if (speed < 10) {
        // Se movía y ahora se detiene
        this.lastStoppedStartTime = now;
      }
    }

    this.lastUpdateTime = now;
    this.lastSpeed = speed;

    // Actualizar velocidad máxima
    if (speed > this.stats.maxSpeed) {
      this.stats.maxSpeed = speed;
    }

    this.notifyListeners();
    await this.saveState();
  }

  async addRoutePoint(point: {
    latitude: number;
    longitude: number;
    speed: number;
    timestamp?: number;
    altitude?: number | null;
  }) {
    if (!this.isTracking) return;

    const last = this.stats.routePoints[this.stats.routePoints.length - 1];
    if (last) {
      const latDiff = Math.abs(point.latitude - last.latitude);
      const lonDiff = Math.abs(point.longitude - last.longitude);
      if (latDiff < MIN_MOVE_DEG && lonDiff < MIN_MOVE_DEG) {
        return;
      }
    }

    this.stats.routePoints.push({
      ...point,
      timestamp:
        typeof point.timestamp === "number" ? point.timestamp : Date.now(),
      altitude: typeof point.altitude === "number" ? point.altitude : null,
    });
    this.notifyListeners();
    await this.saveState();
  }

  getStats(): DrivingStats {
    const now = Date.now();
    if (this.isTracking && this.sessionStartTime !== null) {
      // Calcular tiempo actual de la sesión en curso
      const currentSessionTime = (now - this.sessionStartTime) / 1000;
      this.stats.drivingTime = Math.floor(
        this.accumulatedDrivingTime + currentSessionTime,
      );

      // Calcular tiempo actual detenido si corresponde
      if (this.lastStoppedStartTime !== null) {
        const currentStoppedTime = (now - this.lastStoppedStartTime) / 1000;
        this.stats.stoppedTime = Math.floor(
          this.accumulatedStoppedTime + currentStoppedTime,
        );
      } else {
        this.stats.stoppedTime = Math.floor(this.accumulatedStoppedTime);
      }
    } else {
      // Si está pausado, usar el tiempo acumulado
      this.stats.drivingTime = Math.floor(this.accumulatedDrivingTime);
      this.stats.stoppedTime = Math.floor(this.accumulatedStoppedTime);
    }
    return { ...this.stats };
  }

  async resetStats() {
    await this.endSession();
  }

  async resetDrivingTime() {
    this.accumulatedDrivingTime = 0;
    this.stats.drivingTime = 0;
    if (this.isTracking) {
      this.sessionStartTime = Date.now();
    }
    this.notifyListeners();
    await this.saveState();
  }

  async resetStoppedTime() {
    this.accumulatedStoppedTime = 0;
    this.stats.stoppedTime = 0;
    if (this.isTracking && this.lastSpeed < 10) {
      this.lastStoppedStartTime = Date.now();
    }
    this.notifyListeners();
    await this.saveState();
  }
}

export const DrivingStatsService = new DrivingStatsServiceClass();
