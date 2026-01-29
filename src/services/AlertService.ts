import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { SettingsService } from "./SettingsService";

let beepSound: Audio.Sound | null = null;

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
    Speech.speak(message, {
      language: "es", // Español
      pitch: 1.0,
      rate: 1.0,
    });
  },

  speakSpeed: (speed: number) => {
    // Solo dice el número de velocidad
    Speech.speak(Math.round(speed).toString(), {
      language: "es",
      pitch: 1.0,
      rate: 1.0,
    });
  },

  playBeep: async () => {
    // Obtener el tono seleccionado
    const settings = await SettingsService.getSettings();

    // Si hay un tono personalizado, intentar reproducirlo
    if (settings.customBeepUri) {
      try {
        // Detener sonido anterior si existe
        if (beepSound) {
          await beepSound.unloadAsync();
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: settings.customBeepUri },
          { shouldPlay: true },
        );
        beepSound = sound;
        return;
      } catch (error) {
        console.error("Error playing custom beep:", error);
        // Si falla, caer al fallback de TTS
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

    const config = beepConfig[settings.beepTone];
    Speech.speak(config.text, {
      language: "es",
      pitch: config.pitch,
      rate: config.rate,
    });
  },
};
