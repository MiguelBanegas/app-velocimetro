import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useKeepAwake } from "expo-keep-awake";
import React, { useEffect } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { useSpeedTracker } from "../../src/hooks/useSpeedTracker";
import { DrivingStatsService } from "../../src/services/DrivingStatsService";
import { LocationService } from "../../src/services/LocationService";
import { LogService } from "../../src/services/LogService";

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

export default function HomeScreen() {
  const {
    speed,
    odometer1,
    odometer2,
    resetOdometer,
    errorMsg,
    drivingTime,
    resetStats,
    resetDrivingTime,
    resetStoppedTime,
    stoppedTime,
    isTracking,
    isSyncing,
    settings,
    userId,
    deviceId,
    queueCount,
  } = useSpeedTracker();

  // Mantiene la pantalla encendida si isTracking es true
  useKeepAwake();

  // Valores animados para colores y pulsación
  const alertLevel = useSharedValue(0); // 0: normal, 1: bajo, 2: medio, 3: alto
  const scale = useSharedValue(1);

  useEffect(() => {
    if (!settings) return;

    const currentSpeed = Math.floor(speed);
    const [t1, t2, t3] = settings.speedThresholds;

    let newLevel = 0;
    if (currentSpeed > t3) newLevel = 3;
    else if (currentSpeed > t2) newLevel = 2;
    else if (currentSpeed > t1) newLevel = 1;

    alertLevel.value = withTiming(newLevel, { duration: 500 });

    if (newLevel === 3) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 400 }),
          withTiming(1, { duration: 400 }),
        ),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 400 });
    }
  }, [speed, settings]);

  const animatedCircleStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      alertLevel.value,
      [0, 1, 2, 3],
      [
        "rgba(10, 126, 164, 0.8)", // Azul
        "rgba(255, 152, 0, 0.85)", // Naranja
        "rgba(244, 67, 54, 0.9)", // Rojo
        "rgba(183, 28, 28, 0.95)", // Rojo Oscuro
      ],
    );

    const borderColor = interpolateColor(
      alertLevel.value,
      [0, 1, 2, 3],
      [
        "#0a7ea4", // Azul
        "#ff9800", // Naranja
        "#f44336", // Rojo
        "#b71c1c", // Rojo Oscuro
      ],
    );

    return {
      backgroundColor,
      borderColor,
      transform: [{ scale: scale.value }],
      shadowColor: borderColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: alertLevel.value > 0 ? 0.8 : 0,
      shadowRadius: alertLevel.value * 5,
      elevation: alertLevel.value * 4,
    };
  });

  const toggleTracking = async () => {
    if (isSyncing) return;

    try {
      if (isTracking) {
        LogService.log("INFO", "Click Finalizar Rastreo");
        await LocationService.stopTracking();
        await DrivingStatsService.stopSession();
      } else {
        LogService.log("INFO", "Click Iniciar Rastreo");
        await LocationService.startTracking();
        await DrivingStatsService.startSession();
      }
    } catch (e: any) {
      LogService.log("ERROR", "Fallo en toggleTracking", e.message);
      console.error("Fallo en toggleTracking:", e);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerInfo}>
          <View style={styles.idInfo}>
            <Text style={styles.idInfoText}>ID Usuario: {userId}</Text>
            <Text style={styles.idInfoText}>Dispositivo: {deviceId}</Text>
          </View>
          <View
            style={[
              styles.statusIndicator,
              queueCount > 0 ? styles.statusPending : styles.statusOk,
            ]}
          >
            <Text style={styles.statusText}>
              {queueCount > 0 ? `Pendientes: ${queueCount}` : "✓ Sincronizado"}
            </Text>
          </View>
        </View>

        <Animated.View style={[styles.speedCircle, animatedCircleStyle]}>
          <ThemedText style={styles.speedLabel}>VELOCIDAD ACTUAL</ThemedText>
          <Text style={styles.speedValue}>{Math.floor(speed)}</Text>
          <ThemedText type="defaultSemiBold" style={styles.speedUnit}>
            KM/H
          </ThemedText>
        </Animated.View>

        <View style={styles.odometersContainer}>
          <View style={styles.odometerBox}>
            <ThemedText type="defaultSemiBold" style={styles.odoLabel}>
              ODÓMETRO 1
            </ThemedText>
            <Text style={styles.odoValue}>{odometer1.toFixed(1)} km</Text>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => resetOdometer(1)}
            >
              <Text style={styles.resetText}>RESET</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.odometerBox}>
            <ThemedText type="defaultSemiBold" style={styles.odoLabel}>
              ODÓMETRO 2
            </ThemedText>
            <Text style={styles.odoValue}>{odometer2.toFixed(1)} km</Text>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => resetOdometer(2)}
            >
              <Text style={styles.resetText}>RESET</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <ThemedText type="defaultSemiBold" style={styles.statLabel}>
              TIEMPO DE CONDUCCIÓN
            </ThemedText>
            <Text style={styles.statValue}>{formatDuration(drivingTime)}</Text>
            <ThemedText type="defaultSemiBold" style={styles.statUnit}>
              HH:MM
            </ThemedText>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetDrivingTime}
            >
              <Text style={styles.resetText}>RESET</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.stoppedContainer}>
          <View style={styles.stoppedBox}>
            <ThemedText type="defaultSemiBold" style={styles.stoppedLabel}>
              ⏸️ TIEMPO DETENIDO ({"<"} 10 KM/H)
            </ThemedText>
            <Text style={styles.stoppedValue}>
              {formatDuration(stoppedTime)}
            </Text>
            <ThemedText type="defaultSemiBold" style={styles.stoppedUnit}>
              HH:MM
            </ThemedText>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={resetStoppedTime}
            >
              <Text style={styles.resetText}>RESET</Text>
            </TouchableOpacity>
          </View>
        </View>

        {errorMsg && (
          <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            isTracking ? styles.buttonStop : styles.buttonStart,
          ]}
          onPress={toggleTracking}
        >
          <Text style={styles.buttonText}>
            {isTracking ? "FINALIZAR" : "INICIAR RASTREO"}
          </Text>
        </TouchableOpacity>

        <ThemedText style={styles.infoText}>
          {isTracking
            ? "El rastreo en segundo plano está activo."
            : "Presiona Iniciar para activar alertas en segundo plano."}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingVertical: 8,
    borderRadius: 10,
  },
  idInfo: {
    flex: 0.6,
  },
  idInfoText: {
    fontSize: 10,
    color: "#666",
    fontWeight: "bold",
  },
  statusIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusOk: {
    backgroundColor: "#e8f5e9",
  },
  statusPending: {
    backgroundColor: "#fff3e0",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#333",
  },
  speedCircle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 8,
    borderColor: "#0a7ea4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    backgroundColor: "rgba(10, 126, 164, 0.8)",
  },
  speedLabel: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
  },
  speedValue: {
    fontSize: 110,
    fontWeight: "bold",
    color: "#fff",
  },
  speedUnit: {
    fontSize: 18,
    color: "#fff",
    opacity: 0.9,
  },
  odometersContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
  },
  odometerBox: {
    flex: 0.48,
    backgroundColor: "#f0f0f0",
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    elevation: 2,
  },
  odoLabel: {
    fontSize: 10,
    marginBottom: 5,
    opacity: 0.7,
  },
  odoValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginVertical: 5,
  },
  statsContainer: {
    width: "100%",
    marginBottom: 20,
  },
  statBox: {
    backgroundColor: "#f0f0f0",
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    elevation: 2,
  },
  statLabel: {
    fontSize: 10,
    marginBottom: 5,
    opacity: 0.7,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
  },
  statUnit: {
    fontSize: 12,
    opacity: 0.6,
  },
  stoppedContainer: {
    width: "100%",
    marginBottom: 25,
  },
  stoppedBox: {
    backgroundColor: "#f9f9f9",
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  stoppedLabel: {
    fontSize: 11,
    marginBottom: 5,
    color: "#666",
  },
  stoppedValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#888",
  },
  stoppedUnit: {
    fontSize: 12,
    opacity: 0.5,
  },
  resetButton: {
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: "#ccc",
    borderRadius: 5,
  },
  resetText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#555",
  },
  button: {
    width: "100%",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
    marginBottom: 15,
    elevation: 4,
  },
  buttonStart: {
    backgroundColor: "#0a7ea4",
  },
  buttonStop: {
    backgroundColor: "#b71c1c",
  },
  buttonDisabled: {
    backgroundColor: "#999",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  infoText: {
    fontSize: 12,
    opacity: 0.6,
    textAlign: "center",
    marginBottom: 40,
  },
  errorText: {
    color: "#f44336",
    marginBottom: 15,
    textAlign: "center",
    fontWeight: "bold",
  },
});
