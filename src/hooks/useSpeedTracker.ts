import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import ApiService from "../services/ApiService";
import { DrivingStatsService } from "../services/DrivingStatsService";
import { msToKmh } from "../services/LocationService";
import { LogService } from "../services/LogService";
import { SettingsService } from "../services/SettingsService";
import { Settings } from "../types/types";

export const useSpeedTracker = () => {
  const [speed, setSpeed] = useState<number>(0);
  const [odometer1, setOdometer1] = useState<number>(0);
  const [odometer2, setOdometer2] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [drivingTime, setDrivingTime] = useState<number>(0);
  const [stoppedTime, setStoppedTime] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [userId, setUserId] = useState<number>(0);
  const [deviceId, setDeviceId] = useState<string>("");
  const [queueCount, setQueueCount] = useState<number>(0);

  const refreshOdometers = useCallback(async () => {
    const o1 = await SettingsService.getOdometer(1);
    const o2 = await SettingsService.getOdometer(2);
    setOdometer1(o1);
    setOdometer2(o2);
  }, []);

  const refreshApiInfo = useCallback(async () => {
    const uid = await SettingsService.getUserId();
    const did = await SettingsService.getDeviceId();
    const count = await ApiService.getQueueCount();
    setUserId(uid);
    setDeviceId(did);
    setQueueCount(count);
  }, []);

  const resetOdometer = async (id: 1 | 2) => {
    await SettingsService.resetOdometer(id);
    await refreshOdometers();
  };

  useEffect(() => {
    LogService.log("INFO", "useSpeedTracker sync");

    // Inicialización asíncrona segura
    (async () => {
      await DrivingStatsService.ensureInitialized();
      const stats = DrivingStatsService.getStats();
      setIsTracking(stats.isBackgroundTracking);
      await refreshApiInfo();
      // Drenar cola al iniciar la app para enviar pendientes de fondo
      ApiService.drainQueue().catch(() => {});
    })();

    // Escuchar cambios en las estadísticas
    const unsubscribe = DrivingStatsService.subscribe(() => {
      const stats = DrivingStatsService.getStats();
      setIsTracking(stats.isBackgroundTracking);
      setIsSyncing(!!(stats as any).isSyncing);
      setDrivingTime(stats.drivingTime);
      setStoppedTime(stats.stoppedTime);
    });

    return () => unsubscribe();
  }, [refreshApiInfo]);

  useEffect(() => {
    const loadSettings = async () => {
      const s = await SettingsService.getSettings();
      setSettings(s);
      await refreshOdometers();
    };

    loadSettings().catch((err) => {
      console.error("Error loading settings:", err);
    });
  }, [refreshOdometers]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    if (!isTracking) {
      setSpeed(0);
      return;
    }

    const startWatching = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permiso de ubicación denegado");
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 0,
        },
        (location) => {
          const s =
            location.coords.speed !== null
              ? parseFloat(msToKmh(location.coords.speed))
              : 0;
          setSpeed(s);

          // Actualizar estadísticas de conducción en primer plano
          DrivingStatsService.updateLocation(s, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
            altitude: location.coords.altitude,
          });
        },
      );
    };

    startWatching();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isTracking]);

  useEffect(() => {
    let interval: any = null;
    let syncTick = 0;
    let odoTick = 0;
    let apiTick = 0;

    if (isTracking) {
      interval = setInterval(() => {
        const stats = DrivingStatsService.getStats();
        setDrivingTime(stats.drivingTime);
        setStoppedTime(stats.stoppedTime);

        // Actualizar odómetros cada 5 segundos
        odoTick++;
        if (odoTick >= 5) {
          odoTick = 0;
          refreshOdometers();
        }

        // Actualizar info de API y queue cada 10 segundos
        apiTick++;
        if (apiTick >= 10) {
          apiTick = 0;
          refreshApiInfo();
        }

        // Sincronizar puntos desde disco cada 15 segundos
        syncTick++;
        if (syncTick >= 15) {
          syncTick = 0;
          DrivingStatsService.syncWithStorage();
        }
      }, 1000);
    } else {
      // Si no está trackeando, igual refrescamos info básica de vez en cuando
      refreshApiInfo();
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTracking, refreshOdometers, refreshApiInfo]);

  const resetStats = useCallback(() => {
    DrivingStatsService.resetStats();
    setDrivingTime(0);
    setStoppedTime(0);
  }, []);

  const resetDrivingTime = useCallback(() => {
    DrivingStatsService.resetDrivingTime();
    setDrivingTime(0);
  }, []);

  const resetStoppedTime = useCallback(() => {
    DrivingStatsService.resetStoppedTime();
    setStoppedTime(0);
  }, []);

  return {
    speed,
    odometer1,
    odometer2,
    errorMsg,
    isTracking,
    isSyncing,
    resetOdometer,
    refreshOdometers,
    drivingTime,
    resetStats,
    resetDrivingTime,
    resetStoppedTime,
    stoppedTime,
    settings,
    userId,
    deviceId,
    queueCount,
    refreshApiInfo,
  };
};
