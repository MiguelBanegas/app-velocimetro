import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import "../src/services/TrackingTask";
import { TRACKING_TASK } from "../src/services/TrackingTask";

export default function App() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [status, setStatus] = useState("Inactivo");
  const [intervalSec, setIntervalSec] = useState("20");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    "success" | "fail" | "error" | "pending"
  >("pending");

  useEffect(() => {
    loadData();
    // Polling para actualizar el estado de sincronización cada 5 segundos
    const syncInterval = setInterval(checkSyncStatus, 5000);
    return () => clearInterval(syncInterval);
  }, []);

  const loadData = async () => {
    const id = await AsyncStorage.getItem("device_id");
    if (id) setDeviceId(id);

    const savedInterval = await AsyncStorage.getItem("tracking_interval");
    if (savedInterval) setIntervalSec(savedInterval);

    const active = await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK);
    const shouldBeActive =
      (await AsyncStorage.getItem("tracking_active")) === "true";

    if (shouldBeActive && !active) {
      // Iniciar automáticamente si estaba habilitado
      const { status: fore } =
        await Location.requestForegroundPermissionsAsync();
      const { status: back } =
        await Location.requestBackgroundPermissionsAsync();
      if (back === "granted") {
        const intervalMs = parseInt(intervalSec) * 1000 || 20000;
        await Location.startLocationUpdatesAsync(TRACKING_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: intervalMs,
          distanceInterval: 0,
          foregroundService: {
            notificationTitle: "Orion Rastreador",
            notificationBody: `Reportando cada ${intervalSec}s (Auto-inicio)`,
            notificationColor: "#4CAF50",
          },
        });
        setIsEnabled(true);
        setStatus("Rastreando");
      }
    } else {
      setIsEnabled(active);
      setStatus(active ? "Rastreando" : "Inactivo");
    }

    await checkSyncStatus();
  };

  const checkSyncStatus = async () => {
    const lastTime = await AsyncStorage.getItem("last_sent_at");
    const lastStat = await AsyncStorage.getItem("last_sync_status");

    if (lastTime) {
      const date = new Date(parseInt(lastTime));
      setLastSync(date.toLocaleTimeString());
    }

    if (lastStat) {
      setSyncStatus(lastStat as any);
    }
  };

  const saveId = async (text: string) => {
    setDeviceId(text);
    await AsyncStorage.setItem("device_id", text);
  };

  const saveInterval = async (text: string) => {
    const val = text.replace(/[^0-9]/g, "");
    setIntervalSec(val);
    await AsyncStorage.setItem("tracking_interval", val);
  };

  const toggleSwitch = async () => {
    if (!isEnabled) {
      const { status: fore } =
        await Location.requestForegroundPermissionsAsync();
      const { status: back } =
        await Location.requestBackgroundPermissionsAsync();

      if (back !== "granted") {
        alert('Se requiere permiso de ubicación "Todo el tiempo"');
        return;
      }

      const intervalMs = parseInt(intervalSec) * 1000 || 20000;

      await Location.startLocationUpdatesAsync(TRACKING_TASK, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: intervalMs,
        distanceInterval: 0,
        foregroundService: {
          notificationTitle: "Orion Rastreador",
          notificationBody: `Reportando cada ${intervalSec}s`,
          notificationColor: "#4CAF50",
        },
      });
      setIsEnabled(true);
      setStatus("Rastreando");
      await AsyncStorage.setItem("tracking_active", "true");
    } else {
      await Location.stopLocationUpdatesAsync(TRACKING_TASK);
      setIsEnabled(false);
      setStatus("Inactivo");
      await AsyncStorage.setItem("tracking_active", "false");
    }
  };

  const getStatusColor = () => {
    if (!isEnabled) return "#666";
    if (syncStatus === "success") return "#4CAF50";
    if (syncStatus === "fail" || syncStatus === "error") return "#f44336";
    return "#FF9800";
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Orion Rastreador</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Identificación del Dispositivo:</Text>
        <TextInput
          style={styles.input}
          value={deviceId}
          onChangeText={saveId}
          placeholder="Ej: Moto-G13-Azul"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Intervalo de Envío (segundos):</Text>
        <TextInput
          style={styles.input}
          value={intervalSec}
          onChangeText={saveInterval}
          placeholder="20"
          keyboardType="numeric"
          editable={!isEnabled}
        />
        {isEnabled && (
          <Text style={styles.lockInfo}>* Detener para cambiar intervalo</Text>
        )}
      </View>

      <View style={styles.cardRow}>
        <View>
          <Text style={[styles.statusLabel, { color: getStatusColor() }]}>
            {status}
          </Text>
          {lastSync && (
            <Text style={styles.lastSync}>Último envío: {lastSync}</Text>
          )}
        </View>
        <Switch
          trackColor={{ false: "#767577", true: "#81c784" }}
          thumbColor={isEnabled ? "#4CAF50" : "#f4f3f4"}
          onValueChange={toggleSwitch}
          value={isEnabled}
        />
      </View>

      {syncStatus === "error" && isEnabled && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ Error de conexión al servidor</Text>
        </View>
      )}

      <Text style={styles.info}>
        Esta aplicación reporta su ubicación de manera independiente. Verifica
        que el permiso de ubicación esté en "Permitir siempre".
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 30,
  },
  card: {
    backgroundColor: "#fff",
    width: "100%",
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    marginBottom: 20,
  },
  cardRow: {
    backgroundColor: "#fff",
    width: "100%",
    padding: 20,
    borderRadius: 15,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "bold",
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: "bold",
  },
  lastSync: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 18,
    color: "#333",
    backgroundColor: "#fafafa",
  },
  lockInfo: {
    fontSize: 11,
    color: "#999",
    marginTop: 5,
    fontStyle: "italic",
  },
  info: {
    marginTop: 20,
    textAlign: "center",
    color: "#888",
    lineHeight: 18,
    fontSize: 13,
  },
  errorBanner: {
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 8,
    width: "100%",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ffcdd2",
  },
  errorText: {
    color: "#c62828",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "bold",
  },
});
