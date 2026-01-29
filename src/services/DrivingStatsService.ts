import AsyncStorage from "@react-native-async-storage/async-storage";
import { DrivingStats, HistoryItem } from "../types/types";

const STATS_STORAGE_KEY = "@driving_stats";
const HISTORY_STORAGE_KEY = "@history_stats";

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
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadState();
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

      // Calcular distancia acumulada basada en routePoints
      let distance = 0;
      if (this.stats.routePoints.length > 1) {
        for (let i = 0; i < this.stats.routePoints.length - 1; i++) {
          const p1 = this.stats.routePoints[i];
          const p2 = this.stats.routePoints[i + 1];
          distance += this.calculateDistance(
            p1.latitude,
            p1.longitude,
            p2.latitude,
            p2.longitude,
          );
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
        routePoints: [...this.stats.routePoints],
      };

      history.unshift(newItem); // Agregar al inicio
      await AsyncStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(history.slice(0, 50)),
      ); // Limitar a 50 records
    } catch (e) {
      console.error("Error saving session to history:", e);
    }
  }

  // Haversine formula copied for internal use or we could move it to a util
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
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
  }) {
    if (!this.isTracking) return;

    this.stats.routePoints.push({
      ...point,
      timestamp: Date.now(),
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
