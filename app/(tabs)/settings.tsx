import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { DEFAULT_SETTINGS } from "@/src/constants/Settings";
import { AlertService } from "@/src/services/AlertService";
import { LogService } from "@/src/services/LogService";
import { SettingsService } from "@/src/services/SettingsService";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function SettingsScreen() {
  const [t1, setT1] = useState(DEFAULT_SETTINGS.speedThresholds[0].toString());
  const [t2, setT2] = useState(DEFAULT_SETTINGS.speedThresholds[1].toString());
  const [t3, setT3] = useState(DEFAULT_SETTINGS.speedThresholds[2].toString());

  const [alertInterval, setAlertInterval] = useState(
    (DEFAULT_SETTINGS.alertInterval / 1000).toString(),
  );

  const [updateInterval, setUpdateInterval] = useState(
    (DEFAULT_SETTINGS.updateInterval / 1000).toString(),
  );

  const [beepTone, setBeepTone] = useState<"beep1" | "beep2" | "beep3">(
    DEFAULT_SETTINGS.beepTone,
  );
  const [customBeepUri, setCustomBeepUri] = useState<string | undefined>(
    undefined,
  );
  const [customBeepName, setCustomBeepName] = useState<string | undefined>(
    undefined,
  );
  const [userId, setUserId] = useState<string>("0");
  const [deviceId, setDeviceId] = useState<string>("android_test");
  const [isLocatorEnabled, setIsLocatorEnabled] = useState<boolean>(true);
  const [logs, setLogs] = useState<string>("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await SettingsService.getSettings();
        if (settings.speedThresholds) {
          setT1(settings.speedThresholds[0].toString());
          setT2(settings.speedThresholds[1].toString());
          setT3(settings.speedThresholds[2].toString());
        }
        setAlertInterval((settings.alertInterval / 1000).toString());
        setUpdateInterval((settings.updateInterval / 1000).toString());
        setBeepTone(settings.beepTone);
        setCustomBeepUri(settings.customBeepUri);
        setIsLocatorEnabled(settings.isLocatorEnabled !== false); // Default true
        if (settings.customBeepUri) {
          setCustomBeepName("Tono personalizado");
        }
        try {
          const uid = await SettingsService.getUserId();
          setUserId(uid ? uid.toString() : "0");
          const did = await SettingsService.getDeviceId();
          setDeviceId(did || "android_test");
        } catch (e) {
          // ignore
        }
      } catch (err) {
        console.error("Error loading settings:", err);
      }
    };
    loadSettings().catch((e) => console.error("Error in loadSettings:", e));
  }, []);

  const saveSettings = async () => {
    const v1 = parseInt(t1);
    const v2 = parseInt(t2);
    const v3 = parseInt(t3);
    const interval = parseInt(alertInterval) * 1000;
    const gpsInterval = parseFloat(updateInterval) * 1000;

    if ([v1, v2, v3].some((v) => isNaN(v) || v <= 0)) {
      Alert.alert("Error", "Por favor ingresa límites de velocidad válidos.");
      return;
    }

    if (isNaN(interval) || interval < 1000) {
      Alert.alert(
        "Error",
        "El intervalo de alerta debe ser al menos de 1 segundo.",
      );
      return;
    }

    if (isNaN(gpsInterval) || gpsInterval < 500) {
      Alert.alert(
        "Error",
        "El intervalo de actualización GPS debe ser al menos de 0.5 segundos.",
      );
      return;
    }

    const success = await SettingsService.saveSettings({
      speedThresholds: [v1, v2, v3],
      alertInterval: interval,
      updateInterval: gpsInterval,
      beepTone: beepTone,
      customBeepUri: customBeepUri,
      unit: "km/h",
      isLocatorEnabled: isLocatorEnabled,
    });

    // save user/device
    try {
      const parsed = parseInt(userId, 10);
      await SettingsService.setUserId(isNaN(parsed) ? 0 : parsed);
      await SettingsService.setDeviceId(deviceId || "android_test");
    } catch (e) {
      console.warn("Error saving user/device ids", e);
    }

    if (success) {
      Alert.alert(
        "Éxito",
        "Configuración guardada correctamente. Reinicia el rastreo para aplicar cambios.",
      );
    } else {
      Alert.alert("Error", "No se pudo guardar la configuración.");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCustomBeepUri(result.assets[0].uri);
        setCustomBeepName(result.assets[0].name);
      }
    } catch (err) {
      console.error("Error picking document: ", err);
    }
  };

  const clearCustomBeep = () => {
    setCustomBeepUri(undefined);
    setCustomBeepName(undefined);
  };

  const copyLogs = async () => {
    try {
      const formattedLogs = await LogService.getFormattedLogs();
      await Clipboard.setStringAsync(formattedLogs);
      Alert.alert("Copiado", "Los logs han sido copiados al portapapeles.");
    } catch (e) {
      Alert.alert("Error", "No se pudieron copiar los logs.");
    }
  };

  const clearLogs = async () => {
    await LogService.clearLogs();
    setLogs("");
    Alert.alert("Limpio", "Historial de logs borrado.");
  };

  const refreshLogs = async () => {
    const formattedLogs = await LogService.getFormattedLogs();
    setLogs(formattedLogs.slice(0, 2000));
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="title" style={styles.title}>
          Configuración
        </ThemedText>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">
            Límites de Velocidad (km/h)
          </ThemedText>
          <View style={styles.thresholdsRow}>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Bajo</ThemedText>
              <TextInput
                style={styles.smallInput}
                keyboardType="numeric"
                value={t1}
                onChangeText={setT1}
                placeholder="60"
              />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Medio</ThemedText>
              <TextInput
                style={styles.smallInput}
                keyboardType="numeric"
                value={t2}
                onChangeText={setT2}
                placeholder="80"
              />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Alto</ThemedText>
              <TextInput
                style={styles.smallInput}
                keyboardType="numeric"
                value={t3}
                onChangeText={setT3}
                placeholder="100"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">
            Intervalos de GPS y Alertas
          </ThemedText>
          <ThemedText style={styles.helpText}>
            Frecuencia de las alertas y actualización de posición
          </ThemedText>
          <View style={styles.thresholdsRow}>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Alertas (seg)</ThemedText>
              <TextInput
                style={styles.smallInput}
                keyboardType="numeric"
                value={alertInterval}
                onChangeText={setAlertInterval}
                placeholder="10"
              />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>GPS (seg)</ThemedText>
              <TextInput
                style={styles.smallInput}
                keyboardType="numeric"
                value={updateInterval}
                onChangeText={setUpdateInterval}
                placeholder="1"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">Identificación (Local)</ThemedText>
          <ThemedText style={styles.helpText}>
            Identificadores para el historial de rutas local
          </ThemedText>
          <ThemedText style={[styles.inputLabel, { marginTop: 10 }]}>
            User ID
          </ThemedText>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={userId}
            onChangeText={setUserId}
            placeholder="Ej. 2"
          />

          <ThemedText style={[styles.inputLabel, { marginTop: 10 }]}>
            Device ID
          </ThemedText>
          <TextInput
            style={styles.input}
            value={deviceId}
            onChangeText={setDeviceId}
            placeholder="android_test"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">
                Localizador Permanente
              </ThemedText>
              <ThemedText style={styles.helpText}>
                Enviar ubicación cada 1 minuto aunque no haya un recorrido
                activo.
              </ThemedText>
            </View>
            <Switch
              value={isLocatorEnabled}
              onValueChange={setIsLocatorEnabled}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={isLocatorEnabled ? "#0a7ea4" : "#f4f3f4"}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">Tono de Alerta</ThemedText>
          <View style={styles.beepSelector}>
            {(["beep1", "beep2", "beep3"] as const).map((tone) => (
              <TouchableOpacity
                key={tone}
                style={[
                  styles.beepOption,
                  beepTone === tone &&
                    !customBeepUri &&
                    styles.beepOptionSelected,
                ]}
                onPress={() => {
                  setBeepTone(tone);
                  setCustomBeepUri(undefined);
                  setCustomBeepName(undefined);
                }}
              >
                <ThemedText style={styles.beepOptionText}>
                  {tone === "beep1"
                    ? "🔔 Tono 1 (Agudo)"
                    : tone === "beep2"
                      ? "🔊 Tono 2 (Doble)"
                      : "📢 Tono 3 (Grave)"}
                </ThemedText>
                <TouchableOpacity
                  style={styles.previewButton}
                  onPress={() => AlertService.playBeep()}
                >
                  <ThemedText style={styles.previewText}>▶️</ThemedText>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>

          <ThemedText type="defaultSemiBold" style={[styles.mt20, styles.mb10]}>
            Archivo de audio personalizado:
          </ThemedText>
          <View style={styles.customAudioContainer}>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={pickDocument}
            >
              <ThemedText style={styles.pickerButtonText}>
                {customBeepName ? "Cambiar Audio" : "Seleccionar Audio"}
              </ThemedText>
            </TouchableOpacity>
            {customBeepUri && (
              <View style={styles.customAudioInfo}>
                <ThemedText style={styles.audioName} numberOfLines={1}>
                  🎵 {customBeepName || "Archivo seleccionado"}
                </ThemedText>
                <View style={styles.audioActions}>
                  <TouchableOpacity
                    style={styles.previewButtonSmall}
                    onPress={() => AlertService.playBeep()}
                  >
                    <ThemedText style={styles.previewTextSmall}>
                      ▶️ Prueba
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={clearCustomBeep}
                  >
                    <ThemedText style={styles.clearButtonText}>🗑️</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">Diagnóstico y Logs</ThemedText>
          <ThemedText style={styles.helpText}>
            Útil para depurar errores de rastreo
          </ThemedText>
          <View style={styles.logsActions}>
            <TouchableOpacity style={styles.logButton} onPress={refreshLogs}>
              <ThemedText style={styles.logButtonText}>
                Ver Recientes
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.logButton} onPress={copyLogs}>
              <ThemedText style={styles.logButtonText}>Copiar Todo</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logButton, { backgroundColor: "#888" }]}
              onPress={clearLogs}
            >
              <ThemedText style={styles.logButtonText}>Limpiar</ThemedText>
            </TouchableOpacity>
          </View>
          {logs ? (
            <View style={styles.logsView}>
              <ThemedText style={styles.logsContent}>{logs}</ThemedText>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.button} onPress={saveSettings}>
          <ThemedText style={styles.buttonText}>
            GUARDAR CONFIGURACIÓN
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    marginBottom: 40,
    textAlign: "center",
  },
  section: {
    marginBottom: 30,
    backgroundColor: "rgba(0,0,0,0.03)",
    padding: 15,
    borderRadius: 12,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  thresholdsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  inputContainer: {
    flex: 0.3,
  },
  inputLabel: {
    fontSize: 12,
    marginBottom: 5,
    opacity: 0.7,
  },
  smallInput: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 16,
    color: "#000",
    backgroundColor: "#fff",
    textAlign: "center",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginTop: 5,
    fontSize: 16,
    color: "#000",
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0a7ea4",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  helpText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  beepSelector: {
    marginTop: 10,
    gap: 8,
  },
  beepOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  beepOptionSelected: {
    borderColor: "#0a7ea4",
    backgroundColor: "#e6f4f8",
  },
  beepOptionText: {
    fontSize: 14,
  },
  previewButton: {
    backgroundColor: "#0a7ea4",
    padding: 8,
    borderRadius: 6,
  },
  previewText: {
    color: "#fff",
    fontSize: 14,
  },
  mt20: {
    marginTop: 20,
  },
  mb10: {
    marginBottom: 10,
  },
  customAudioContainer: {
    marginTop: 5,
  },
  pickerButton: {
    backgroundColor: "#666",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  pickerButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  customAudioInfo: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  audioName: {
    fontSize: 13,
    marginBottom: 8,
    color: "#333",
  },
  audioActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewButtonSmall: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  previewTextSmall: {
    color: "#fff",
    fontSize: 12,
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    fontSize: 16,
  },
  logsActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  logButton: {
    flex: 1,
    backgroundColor: "#444",
    padding: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  logButtonText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  logsView: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    maxHeight: 200,
  },
  logsContent: {
    color: "#0f0",
    fontFamily: "monospace",
    fontSize: 10,
  },
});
