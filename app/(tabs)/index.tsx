import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
    settings,
  } = useSpeedTracker();

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

  useEffect(() => {
    const {
      activateKeepAwakeAsync,
      deactivateKeepAwake,
    } = require("expo-keep-awake");
    if (isTracking) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
  }, [isTracking]);

  const toggleTracking = async () => {
    if (isTracking) {
      await LocationService.stopTracking();
      DrivingStatsService.pauseSession();
    } else {
      try {
        await LocationService.startTracking();
        DrivingStatsService.startSession();
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.speedCircle, animatedCircleStyle]}>
          <ThemedText type="defaultSemiBold" style={styles.speedLabel}>
            VELOCIDAD
          </ThemedText>
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
            {isTracking ? "DETENER RASTREO" : "INICIAR RASTREO"}
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
    paddingVertical: 40,
    paddingHorizontal: 20,
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
    backgroundColor: "rgba(10, 126, 164, 0.8)", // Más opaco para contraste con blanco
  },
  speedLabel: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
  },
  speedValue: {
    fontSize: 110,
    fontWeight: "bold",
    color: "#fff", // Blanco para mejor contraste
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
    marginBottom: 30,
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
    fontSize: 12,
    color: "#444",
  },
  odoValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginVertical: 5,
  },
  resetButton: {
    backgroundColor: "#888",
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 10,
    marginTop: 5,
  },
  resetText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 30,
  },
  statBox: {
    flex: 0.48,
    backgroundColor: "#e8f4f8",
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#0a7ea4",
  },
  statLabel: {
    fontSize: 11,
    color: "#0a7ea4",
    textAlign: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0a7ea4",
    marginVertical: 5,
  },
  statUnit: {
    fontSize: 12,
    color: "#0a7ea4",
  },
  stoppedContainer: {
    width: "100%",
    marginBottom: 30,
  },
  stoppedBox: {
    backgroundColor: "#fff4e6",
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    elevation: 2,
    borderWidth: 2,
    borderColor: "#ff9800",
  },
  stoppedLabel: {
    fontSize: 11,
    color: "#ff9800",
    textAlign: "center",
    fontWeight: "bold",
  },
  stoppedValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ff9800",
    marginVertical: 5,
  },
  stoppedUnit: {
    fontSize: 12,
    color: "#ff9800",
  },
  errorText: {
    color: "red",
    marginBottom: 20,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 20,
    elevation: 3,
    width: "80%",
    alignItems: "center",
  },
  buttonStart: {
    backgroundColor: "#0a7ea4",
  },
  buttonStop: {
    backgroundColor: "#ff4444",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  infoText: {
    textAlign: "center",
    opacity: 0.7,
    marginTop: 10,
  },
});
