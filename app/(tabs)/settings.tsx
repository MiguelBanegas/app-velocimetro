import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { DEFAULT_SETTINGS } from "@/src/constants/Settings";
import { AlertService } from "@/src/services/AlertService";
import { SettingsService } from "@/src/services/SettingsService";
import * as DocumentPicker from "expo-document-picker";
import React, { useEffect, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
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
        if (settings.customBeepUri) {
          setCustomBeepName("Tono personalizado");
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
    });

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
            Intervalo entre Alertas (segundos)
          </ThemedText>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={alertInterval}
            onChangeText={setAlertInterval}
            placeholder="Ej. 10"
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="defaultSemiBold">
            Intervalo de Actualización GPS (segundos)
          </ThemedText>
          <ThemedText style={styles.helpText}>
            Menor intervalo = más responsivo pero mayor consumo de batería
          </ThemedText>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={updateInterval}
            onChangeText={setUpdateInterval}
            placeholder="Ej. 1"
          />
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
            O usar un archivo de audio propio:
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
                    <ThemedText>▶️ Prueba</ThemedText>
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

        <TouchableOpacity style={styles.button} onPress={saveSettings}>
          <ThemedText style={styles.buttonText}>GUARDAR</ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.note}>
          Nota: Los cambios se aplicarán a la siguiente actualización de
          velocidad.
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
    padding: 24,
    paddingTop: 60,
  },
  title: {
    marginBottom: 40,
    textAlign: "center",
  },
  section: {
    marginBottom: 30,
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
    textAlign: "center",
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
    marginTop: 10,
    fontSize: 18,
    color: "#000",
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0a7ea4",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  note: {
    marginTop: 30,
    fontSize: 12,
    opacity: 0.6,
    textAlign: "center",
  },
  helpText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 5,
  },
  beepSelector: {
    marginTop: 10,
    gap: 10,
  },
  beepOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    borderWidth: 2,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  beepOptionSelected: {
    borderColor: "#0a7ea4",
    backgroundColor: "#e6f4f8",
  },
  beepOptionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  previewButton: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 6,
  },
  previewText: {
    color: "#fff",
    fontSize: 16,
  },
  mt20: {
    marginTop: 20,
  },
  mb10: {
    marginBottom: 10,
  },
  customAudioContainer: {
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    borderStyle: "dashed",
  },
  pickerButton: {
    backgroundColor: "#888",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  pickerButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  customAudioInfo: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  audioName: {
    fontSize: 14,
    marginBottom: 10,
    color: "#444",
  },
  audioActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewButtonSmall: {
    backgroundColor: "#e6f4f8",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#0a7ea4",
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    fontSize: 18,
  },
});
