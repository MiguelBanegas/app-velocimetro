import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useEffect } from "react";
import "../src/services/BackgroundTasks";
import { LogService } from "../src/services/LogService";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    LogService.setTag("UI");
    LogService.log("INFO", "App BOOT", "v1.0.0");

    // Auto-iniciar Localizador si está habilitado
    const initLocator = async () => {
      try {
        const { SettingsService } = require("../src/services/SettingsService");
        const {
          DeviceTrackingService,
        } = require("../src/services/DeviceTrackingService");
        const settings = await SettingsService.getSettings();
        if (settings.isLocatorEnabled) {
          await DeviceTrackingService.startTracking();
        }
      } catch (e) {
        console.error("Error auto-starting locator:", e);
      }
    };
    initLocator();
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
