import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSpeedTracker } from "@/src/hooks/useSpeedTracker";
import { DrivingStatsService } from "@/src/services/DrivingStatsService";
import { LocationService } from "@/src/services/LocationService";
import { RoutePoint } from "@/src/types/types";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useColorScheme,
} from "react-native";
import MapView, { Circle, Polyline } from "react-native-maps";

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

export default function MapScreen() {
  const { speed, drivingTime, stoppedTime, settings, isTracking } =
    useSpeedTracker();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [routePoints, setRoutePoints] = useState<RoutePoint[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(15); // Nivel de zoom del mapa (10-18)
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkOpacity, setBlinkOpacity] = useState(1);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    // Suscribirse a los cambios de las estadísticas para la polyline
    const unsubscribe = DrivingStatsService.subscribe(() => {
      const stats = DrivingStatsService.getStats();
      setRoutePoints([...stats.routePoints]);
    });

    return () => unsubscribe();
  }, []);

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

  const endTrip = () => {
    Alert.alert(
      "Finalizar Viaje",
      "¿Estás seguro de que quieres finalizar esta sesión y guardarla en el historial?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          style: "destructive",
          onPress: async () => {
            if (isTracking) {
              await LocationService.stopTracking();
            }
            await DrivingStatsService.endSession();
            setRoutePoints([]);
          },
        },
      ],
    );
  };

  const updateCamera = (lat: number, lon: number, heading?: number) => {
    if (isNavigationMode && mapRef.current) {
      mapRef.current.animateCamera({
        center: { latitude: lat, longitude: lon },
        pitch: 45,
        heading: heading || 0,
        zoom: zoomLevel,
      });
    }
  };

  const adjustZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = prev + delta;
      if (next < 10) return 10;
      if (next > 18) return 18;
      return next;
    });
    // Si está en modo navegación, actualizar la cámara inmediatamente
    if (isNavigationMode && userLocation && mapRef.current) {
      mapRef.current.animateCamera({
        zoom: zoomLevel + delta,
      });
    }
  };

  // Efecto de titilación cuando se supera la velocidad
  useEffect(() => {
    if (!settings) return;
    const [t1] = settings.speedThresholds;

    // Si supera el primer umbral y no está titilando, iniciar titilación
    if (speed > t1 && !isBlinking) {
      setIsBlinking(true);
      let count = 0;
      const maxBlinks = 10; // 5 segundos a 0.5s por blink = 10 blinks

      const blinkInterval = setInterval(() => {
        setBlinkOpacity((prev) => (prev === 1 ? 0.3 : 1));
        count++;

        if (count >= maxBlinks) {
          clearInterval(blinkInterval);
          setBlinkOpacity(1);
          setIsBlinking(false);
        }
      }, 500); // Cambiar cada 0.5 segundos

      return () => clearInterval(blinkInterval);
    }
  }, [speed, settings, isBlinking]);

  // Color de alerta según velocidad
  const getSpeedStyles = () => {
    if (!settings) return { bg: "#0a7ea4", text: "#fff" };
    const [t1, t2, t3] = settings.speedThresholds;

    let bg = "#0a7ea4"; // Azul pordefecto
    let text = "#fff";

    if (speed > t3) {
      bg = "#b71c1c"; // Rojo oscuro
    } else if (speed > t2) {
      bg = "#f44336"; // Rojo
    } else if (speed > t1) {
      bg = "#ff9800"; // Naranja
      text = "#000"; // Contraste para naranja
    }

    return { bg, text };
  };

  const speedStyles = getSpeedStyles();

  const initialRegion =
    routePoints.length > 0
      ? {
          latitude: routePoints[0].latitude,
          longitude: routePoints[0].longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : {
          latitude: -34.6037, // Buenos Aires por defecto si no hay puntos
          longitude: -58.3816,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

  return (
    <ThemedView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        userInterfaceStyle={isDark ? "dark" : "light"}
        showsUserLocation={true}
        followsUserLocation={!isNavigationMode}
        showsMyLocationButton={false}
        showsCompass={true}
        onUserLocationChange={(event) => {
          const { coordinate } = event.nativeEvent;
          if (coordinate) {
            setUserLocation(coordinate);
            // El heading (rumbo) nos permite rotar el mapa hacia la dirección de avance
            updateCamera(
              coordinate.latitude,
              coordinate.longitude,
              coordinate.heading,
            );
          }
        }}
      >
        {userLocation && (
          <Circle
            center={userLocation}
            radius={500} // Radio fijo de 500m
            fillColor={
              isDark ? "rgba(33, 150, 243, 0.1)" : "rgba(33, 150, 243, 0.15)"
            }
            strokeColor="rgba(33, 150, 243, 0.5)"
            strokeWidth={2}
          />
        )}
        {routePoints.length > 1 && (
          <Polyline
            coordinates={routePoints}
            strokeColor="#2196F3"
            strokeWidth={5}
          />
        )}
      </MapView>

      {/* Velocímetro Circular Flotante Rediseñado */}
      <View
        style={[
          styles.speedOverlay,
          {
            backgroundColor: speedStyles.bg,
            borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
            opacity: blinkOpacity,
          },
        ]}
      >
        <Text style={[styles.speedValue, { color: speedStyles.text }]}>
          {Math.floor(speed)}
        </Text>
        <Text style={[styles.speedUnit, { color: speedStyles.text }]}>
          KM/H
        </Text>
      </View>

      {/* Controles de Zoom del Mapa */}
      <View style={styles.zoomControls}>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => adjustZoom(1)}
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
        <View style={styles.radiusIndicator}>
          <Text style={styles.radiusText}>{zoomLevel.toFixed(0)}</Text>
        </View>
        <TouchableOpacity
          style={styles.zoomButton}
          onPress={() => adjustZoom(-1)}
        >
          <Text style={styles.zoomButtonText}>-</Text>
        </TouchableOpacity>
      </View>

      {/* Botones Inferiores - Modo Navegación y Finalizar */}
      <View style={styles.bottomLeftButtons}>
        <TouchableOpacity
          style={[styles.miniFab, isNavigationMode && styles.activeFab]}
          onPress={() => setIsNavigationMode(!isNavigationMode)}
        >
          <IconSymbol
            name="location.fill"
            size={20}
            color={isNavigationMode ? "#fff" : "#666"}
          />
        </TouchableOpacity>

        {(isTracking || routePoints.length > 0) && (
          <TouchableOpacity
            style={[styles.miniFab, styles.finishFab]}
            onPress={endTrip}
          >
            <Text style={{ fontSize: 20 }}>🏁</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Panel Superior de Tiempos */}
      <View style={styles.topStats}>
        <View style={styles.statPill}>
          <IconSymbol name="steeringwheel" size={14} color="#666" />
          <Text style={styles.statPillText}>{formatDuration(drivingTime)}</Text>
        </View>
        <View style={styles.statPill}>
          <IconSymbol name="pause.circle" size={14} color="#999" />
          <Text style={styles.statPillText}>{formatDuration(stoppedTime)}</Text>
        </View>
      </View>

      {/* Botón de Rastreo Flotante */}
      <TouchableOpacity
        style={[styles.fab, isTracking ? styles.fabStop : styles.fabStart]}
        onPress={toggleTracking}
      >
        <IconSymbol
          name={isTracking ? "pause.fill" : "play.fill"}
          size={30}
          color="#fff"
        />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  speedOverlay: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  speedValue: {
    fontSize: 56,
    fontWeight: "bold",
    marginBottom: -5,
  },
  speedUnit: {
    fontSize: 10,
    color: "#666",
    fontWeight: "bold",
  },
  zoomControls: {
    position: "absolute",
    bottom: 110,
    right: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 30,
    padding: 5,
    elevation: 5,
    alignItems: "center",
    gap: 5,
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  zoomButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0a7ea4",
  },
  radiusIndicator: {
    paddingVertical: 2,
  },
  radiusText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#666",
  },
  bottomLeftButtons: {
    position: "absolute",
    bottom: 30,
    left: 20,
    gap: 15,
  },
  miniFab: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  activeFab: {
    backgroundColor: "#0a7ea4",
  },
  finishFab: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#ff4444",
  },
  topStats: {
    position: "absolute",
    top: 50,
    right: 20,
    flexDirection: "column",
    gap: 8,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    elevation: 4,
  },
  statPillText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 65,
    height: 65,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  fabStart: {
    backgroundColor: "#0a7ea4",
  },
  fabStop: {
    backgroundColor: "#ff4444",
  },
});
