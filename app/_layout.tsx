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
import { AppState } from "react-native";
import "../src/services/BackgroundTasks";
import { DeviceTrackingService } from "../src/services/DeviceTrackingService";
import { SettingsService } from "../src/services/SettingsService";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Asegurar device_id desde el primer arranque
    SettingsService.getDeviceId().catch(() => {});
    // Iniciar rastreo de dispositivo (independiente del rastreo de sesión)
    DeviceTrackingService.startTracking().catch(() => {});

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        DeviceTrackingService.startTracking().catch(() => {});
      }
    });

    return () => sub.remove();
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
