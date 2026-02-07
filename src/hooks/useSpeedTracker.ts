import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { DrivingStatsService } from "../services/DrivingStatsService";
import { msToKmh } from "../services/LocationService";
import { SettingsService } from "../services/SettingsService";
import { DeviceLocationService } from "../services/DeviceLocationService";
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

  const refreshOdometers = useCallback(async () => {
    const o1 = await SettingsService.getOdometer(1);
    const o2 = await SettingsService.getOdometer(2);
    setOdometer1(o1);
    setOdometer2(o2);
  }, []);

  const resetOdometer = async (id: 1 | 2) => {
    await SettingsService.resetOdometer(id);
    await refreshOdometers();
  };

  useEffect(() => {
    // Sincronizar estado inicial
    setIsTracking(DrivingStatsService.getStats().isBackgroundTracking);

    // Escuchar cambios en las estadísticas (incluyendo isBackgroundTracking)
    const unsubscribe = DrivingStatsService.subscribe(() => {
      const stats = DrivingStatsService.getStats();
      setIsTracking(stats.isBackgroundTracking);
      setIsSyncing(!!(stats as any).isSyncing);
      setDrivingTime(stats.drivingTime);
      setStoppedTime(stats.stoppedTime);
    });

    return () => unsubscribe();
  }, []);

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
          distanceInterval: 5,
        },
        (location) => {
          const s =
            location.coords.speed !== null
              ? parseFloat(msToKmh(location.coords.speed))
              : 0;
          setSpeed(s);

          // Actualizar estadísticas de conducción también en primer plano
          DrivingStatsService.updateSpeed(s);
          DrivingStatsService.addRoutePoint({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            speed: s,
          });

          // Refrescar odómetros y estadísticas periódicamente
          refreshOdometers();
        },
      );
    };

    startWatching();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isTracking, refreshOdometers]);

  // Efecto para actualizar el cronómetro cada segundo si el rastreo está activo
  useEffect(() => {
    let interval: any = null;

    if (isTracking) {
      interval = setInterval(() => {
        const stats = DrivingStatsService.getStats();
        setDrivingTime(stats.drivingTime);
        setStoppedTime(stats.stoppedTime);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTracking]);

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
  };
};
