import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { SettingsService } from "./SettingsService";

let beepSound: Audio.Sound | null = null;
let lastBeepTime = 0;
const MIN_BEEP_INTERVAL = 1500; // Milisegundos mínimos entre alertas sonora para evitar acumulación

export const AlertService = {
  playPreview: async (uriOrResource: string | number) => {
    try {
      if (beepSound) {
        await beepSound.unloadAsync();
      }

      const source =
        typeof uriOrResource === "number"
          ? uriOrResource // Es un require() local
          : { uri: uriOrResource }; // Es una URI externa

      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
      });
      beepSound = sound;
    } catch (e) {
      console.error("Error playing preview:", e);
    }
  },

  speak: (message: string) => {
    Speech.stop(); // Detiene lo anterior para no acumular
    Speech.speak(message, {
      language: "es", // Español
      pitch: 1.0,
      rate: 1.0,
    });
  },

  speakSpeed: (speed: number) => {
    // Ya no se usa por petición del usuario para evitar locución de velocidad
    // Se mantiene la firma por compatibilidad pero no hace nada
  },

  playBeep: async (count: number = 1) => {
    const now = Date.now();

    // Evitar acumulación si se llama muy seguido (ej: ráfagas de GPS)
    if (now - lastBeepTime < MIN_BEEP_INTERVAL) {
      return;
    }

    lastBeepTime = now;

    // Obtener el tono seleccionado
    const settings = await SettingsService.getSettings();

    const doPlay = async () => {
      // Si hay un tono personalizado, intentar reproducirlo
      if (settings.customBeepUri) {
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: settings.customBeepUri },
            { shouldPlay: true },
          );

          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              sound.unloadAsync();
            }
          });
          return;
        } catch (error) {
          console.error("Error playing custom beep:", error);
        }
      }

      // Fallback: usar TTS con diferentes tonos según la selección
      const beepConfig: Record<
        "beep1" | "beep2" | "beep3",
        { pitch: number; rate: number; text: string }
      > = {
        beep1: { pitch: 2.0, rate: 2.0, text: "beep" },
        beep2: { pitch: 1.8, rate: 1.5, text: "beep beep" },
        beep3: { pitch: 1.5, rate: 1.2, text: "boop" },
      };

      const config = beepConfig[settings.beepTone] || beepConfig.beep1;

      // Detener cualquier discurso previo antes de emitir el beep de TTS
      Speech.stop();
      Speech.speak(config.text, {
        language: "es",
        pitch: config.pitch,
        rate: config.rate,
      });
    };

    for (let i = 0; i < count; i++) {
      await doPlay();
      if (count > 1 && i < count - 1) {
        await new Promise((r) => setTimeout(r, 400)); // Espera entre beeps
      }
    }
  },
};
