import AsyncStorage from "@react-native-async-storage/async-storage";
import { DrivingStats, HistoryItem } from "../types/types";
import { calculateDistanceKm } from "../utils/geo";
import { postPoints, startTrack, stopTrack } from "./ApiService";
import { LogService } from "./LogService";
import { SettingsService } from "./SettingsService";

const STATS_STORAGE_KEY = "@driving_stats";
const HISTORY_STORAGE_KEY = "@history_stats";
const MIN_MOVE_DEG = 1e-5; // ~1.1m lat diff, simple filter
const MAX_ROUTE_POINTS = 10000; // Aumentado para recorridos largos (> 5 horas a 2s/punto)

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
  private accumulatedDrivingTime: number = 0;
  private accumulatedStoppedTime: number = 0;
  private sessionStartTime: number | null = null;
  private lastStoppedStartTime: number | null = null;
  private currentRemoteTrackId: number | null = null;
  private listeners: (() => void)[] = [];
  private isSyncing: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private lastSaveTime: number = 0;
  private isBackgroundProcess: boolean = false;

  constructor() {
    this.initializationPromise = this.loadState();
  }

  public setAsBackgroundProcess() {
    this.isBackgroundProcess = true;
  }

  public async ensureInitialized() {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  private async saveState(force = false) {
    try {
      const now = Date.now();
      if (!force && now - this.lastSaveTime < 5000) {
        return;
      }
      this.lastSaveTime = now;

      if (this.stats.routePoints.length > MAX_ROUTE_POINTS) {
        this.stats.routePoints =
          this.stats.routePoints.slice(-MAX_ROUTE_POINTS);
      }

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
      LogService.log("ERROR", "SaveState fail", (e as Error).message);
    }
  }

  async loadState() {
    try {
      const saved = await AsyncStorage.getItem(STATS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.stats = parsed.stats || this.stats;

        if (
          this.stats.routePoints &&
          this.stats.routePoints.length > MAX_ROUTE_POINTS
        ) {
          this.stats.routePoints =
            this.stats.routePoints.slice(-MAX_ROUTE_POINTS);
        }

        this.accumulatedDrivingTime = parsed.accumulatedDrivingTime || 0;
        this.accumulatedStoppedTime = parsed.accumulatedStoppedTime || 0;
        this.sessionStartTime = parsed.sessionStartTime;
        this.lastStoppedStartTime = parsed.lastStoppedStartTime;
        this.isTracking = parsed.isTracking || false;
        this.currentRemoteTrackId = parsed.currentRemoteTrackId || null;
        this.notifyListeners();
      }
    } catch (e) {
      LogService.log("ERROR", "LoadState fail", (e as Error).message);
    }
  }

  async syncWithStorage() {
    await this.loadState();
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

  async startSession() {
    await this.ensureInitialized();

    if (this.sessionStartTime !== null) {
      this.isTracking = true;
      this.stats.isBackgroundTracking = true;
      // Recuperar los puntos y tiempos del disco
      await this.loadState();
      this.notifyListeners();
      await this.saveState(true);
      return;
    }

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
    this.lastStoppedStartTime = Date.now();
    this.lastSpeed = 0;
    this.isTracking = true;

    await this.saveState(true);
    LogService.log("INFO", "Sesión iniciada manualmente");
    this.notifyListeners();

    // Iniciar el track en la API
    try {
      const userId = await SettingsService.getUserId();
      const deviceId = await SettingsService.getDeviceId();
      const res = await startTrack(userId.toString(), deviceId);
      if (res && res.track_id) {
        this.currentRemoteTrackId = res.track_id;
        LogService.log(
          "INFO",
          "ID de track remoto establecido",
          `id:${res.track_id}`,
        );
        await this.saveState(true);
      }
    } catch (e: any) {
      LogService.log("ERROR", "Error al iniciar track remoto", e.message);
    }
  }

  async pauseSession() {
    if (!this.isTracking || this.sessionStartTime === null) return;
    const now = Date.now();
    this.accumulatedDrivingTime += (now - this.sessionStartTime) / 1000;
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
    await this.saveState(true);
  }

  async resumeSession() {
    if (this.isTracking) return;
    this.isTracking = true;
    this.stats.isBackgroundTracking = true;
    this.sessionStartTime = Date.now();
    this.lastUpdateTime = Date.now();
    if (this.lastSpeed < 10) this.lastStoppedStartTime = Date.now();
    this.notifyListeners();
    await this.saveState(true);
  }

  async stopSession() {
    // Alias for endSession or similar to maintain compatibility
    await this.endSession();
  }

  async endSession(saveToHistory = true) {
    await this.ensureInitialized();
    // Sincronizar con lo último que guardó el proceso de fondo
    await this.loadState();

    if (
      saveToHistory &&
      this.stats.startTime !== null &&
      this.stats.routePoints.length > 0
    ) {
      await this.saveSessionToHistory();
    } else if (saveToHistory) {
      LogService.log(
        "WARN",
        "Omitiendo guardado de sesión sin puntos o sin hora de inicio",
      );
    }
    if (this.currentRemoteTrackId !== null) {
      try {
        await stopTrack(this.currentRemoteTrackId);
      } catch (e: any) {
        LogService.log("ERROR", "Error al detener track remoto", e.message);
      }
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
    this.currentRemoteTrackId = null; // Limpiar ID del track
    this.notifyListeners();
    await this.saveState(true);
  }

  async loadHistory(): Promise<HistoryItem[]> {
    try {
      const saved = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  async saveSessionToHistory() {
    try {
      if (
        this.stats.startTime === null ||
        !this.stats.routePoints ||
        this.stats.routePoints.length === 0
      ) {
        LogService.log("WARN", "Intento de guardar sesión vacía omitido");
        return;
      }
      const history = await this.loadHistory();
      const EPS = 1e-6;
      const rawPoints = this.stats.routePoints || [];
      const normalizedPoints = rawPoints
        .filter((p, idx, arr) => {
          if (idx === 0) return true;
          const prev = arr[idx - 1];
          return (
            Math.abs(p.latitude - prev.latitude) > EPS ||
            Math.abs(p.longitude - prev.longitude) > EPS
          );
        })
        .map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: typeof p.timestamp === "number" ? p.timestamp : Date.now(),
          speed: typeof p.speed === "number" ? Number(p.speed.toFixed(1)) : 0,
          altitude: typeof p.altitude === "number" ? p.altitude : null,
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      let distance = 0;
      if (normalizedPoints.length > 1) {
        for (let i = 0; i < normalizedPoints.length - 1; i++) {
          distance += calculateDistanceKm(
            normalizedPoints[i].latitude,
            normalizedPoints[i].longitude,
            normalizedPoints[i + 1].latitude,
            normalizedPoints[i + 1].longitude,
          );
        }
      }

      const newItem: HistoryItem = {
        id: Date.now().toString(),
        startTime: this.stats.startTime,
        endTime: Date.now(),
        distance: distance,
        drivingTime: this.stats.drivingTime,
        stoppedTime: this.stats.stoppedTime,
        maxSpeed: this.stats.maxSpeed,
        avgSpeed:
          distance > 0 && this.stats.drivingTime > 0
            ? distance / (this.stats.drivingTime / 3600)
            : 0,
        routePoints: normalizedPoints,
      };

      const newHistory = [newItem, ...history].slice(0, 50);
      await AsyncStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(newHistory),
      );
    } catch (e) {
      LogService.log("ERROR", "History save fail", (e as Error).message);
    }
  }

  async updateLocation(
    speed: number,
    point: {
      latitude: number;
      longitude: number;
      timestamp?: number;
      altitude?: number | null;
    },
  ) {
    await this.ensureInitialized();
    if (!this.isTracking) return;

    const now = Date.now();
    if (this.lastUpdateTime !== null) {
      const delta = (now - this.lastUpdateTime) / 1000;

      // Protección: Si el delta es > 30s (app suspendida), no sumamos el tiempo ciego
      // solo sumamos si el reporte es continuo
      const validDelta = delta > 0 && delta < 30 ? delta : 0;

      if (speed >= 10) {
        this.accumulatedDrivingTime += validDelta;
        this.stats.drivingTime = Math.floor(this.accumulatedDrivingTime);
        this.lastStoppedStartTime = null;
      } else {
        if (this.lastStoppedStartTime === null) {
          this.lastStoppedStartTime = now;
        } else {
          this.accumulatedStoppedTime =
            (this.accumulatedStoppedTime || 0) + validDelta; // Usamos delta para ser consistentes
          this.stats.stoppedTime = Math.floor(this.accumulatedStoppedTime);
        }
      }
    }
    this.lastUpdateTime = now;
    this.lastSpeed = speed;

    if (speed > this.stats.maxSpeed) {
      this.stats.maxSpeed = speed;
    }

    const lastPoint = this.stats.routePoints[this.stats.routePoints.length - 1];
    if (
      !lastPoint ||
      Math.abs(point.latitude - lastPoint.latitude) > MIN_MOVE_DEG ||
      Math.abs(point.longitude - lastPoint.longitude) > MIN_MOVE_DEG
    ) {
      this.stats.routePoints.push({
        ...point,
        speed,
        timestamp: point.timestamp || now,
      });

      if (this.stats.routePoints.length > MAX_ROUTE_POINTS) {
        this.stats.routePoints =
          this.stats.routePoints.slice(-MAX_ROUTE_POINTS);
      }

      // Enviar punto a la API si hay un track activo
      if (this.currentRemoteTrackId !== null) {
        postPoints(this.currentRemoteTrackId, [
          {
            lat: point.latitude,
            lon: point.longitude,
            speed: Number(speed.toFixed(1)),
            altitude: point.altitude ? Number(point.altitude.toFixed(1)) : null,
          },
        ]).catch((e) => {
          // Error ya logueado en ApiService
        });
      } else {
        // Loguear solo de vez en cuando para no saturar si no hay track
        if (Math.random() > 0.95) {
          LogService.log(
            "DEBUG",
            "Punto registrado localmente (sin track remoto)",
          );
        }
      }
    }

    this.notifyListeners();
    await this.saveState();
  }

  getStats() {
    return {
      ...this.stats,
      isSyncing: this.isSyncing,
    };
  }

  async clearHistory() {
    await AsyncStorage.removeItem(HISTORY_STORAGE_KEY);
    this.notifyListeners();
  }

  async deleteHistoryItem(id: string) {
    const history = await this.loadHistory();
    const newHistory = history.filter((item) => item.id !== id);
    await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    this.notifyListeners();
  }

  async resetStats() {
    this.stats.maxSpeed = 0;
    this.accumulatedDrivingTime = 0;
    this.accumulatedStoppedTime = 0;
    this.stats.drivingTime = 0;
    this.stats.stoppedTime = 0;
    await this.saveState(true);
    this.notifyListeners();
  }

  async resetDrivingTime() {
    this.accumulatedDrivingTime = 0;
    this.stats.drivingTime = 0;
    await this.saveState(true);
    this.notifyListeners();
  }

  async resetStoppedTime() {
    this.accumulatedStoppedTime = 0;
    this.stats.stoppedTime = 0;
    await this.saveState(true);
    this.notifyListeners();
  }
}

export const DrivingStatsService = new DrivingStatsServiceClass();
