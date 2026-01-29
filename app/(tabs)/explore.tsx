import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DrivingStatsService } from "@/src/services/DrivingStatsService";
import { HistoryItem } from "@/src/types/types";
import React, { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Polyline } from "react-native-maps";

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}h`;
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<HistoryItem | null>(
    null,
  );
  const [showMapModal, setShowMapModal] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    const data = await DrivingStatsService.loadHistory();
    setHistory(data);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
    // Suscribirse a cambios si es necesario, aunque el historial solo cambia al finalizar sesión
    const unsubscribe = DrivingStatsService.subscribe(() => {
      loadHistory();
    });
    return unsubscribe;
  }, []);

  const handleDeleteSession = (item: HistoryItem) => {
    Alert.alert(
      "Borrar Sesión",
      "¿Estás seguro de que quieres borrar esta sesión?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: async () => {
            await DrivingStatsService.deleteHistoryItem(item.id);
            loadHistory();
          },
        },
      ],
    );
  };

  const handleViewMap = (item: HistoryItem) => {
    setSelectedSession(item);
    setShowMapModal(true);
  };

  const renderItem = ({ item }: { item: HistoryItem }) => (
    <View style={styles.historyCard}>
      <View style={styles.cardHeader}>
        <ThemedText type="defaultSemiBold" style={styles.dateText}>
          {formatDate(item.startTime)}
        </ThemedText>
        <Text style={styles.maxSpeedText}>
          V. Máx: {Math.floor(item.maxSpeed)} km/h
        </Text>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Conducción</Text>
          <Text style={styles.statValue}>
            {formatDuration(item.drivingTime)}
          </Text>
        </View>
        <View style={styles.statSeparator} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Detenido</Text>
          <Text style={styles.statValue}>
            {formatDuration(item.stoppedTime)}
          </Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        {item.routePoints && item.routePoints.length > 0 && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleViewMap(item)}
          >
            <IconSymbol name="map" size={16} color="#0a7ea4" />
            <Text style={styles.actionButtonText}>Ver Mapa</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteSession(item)}
        >
          <IconSymbol name="trash" size={16} color="#ff4444" />
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
            Borrar
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Historial de Sesiones</ThemedText>
        <TouchableOpacity onPress={loadHistory} style={styles.refreshButton}>
          <IconSymbol name="arrow.clockwise" size={24} color="#0a7ea4" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No hay sesiones registradas aún.
              </Text>
            </View>
          ) : null
        }
      />

      {/* Modal para ver el mapa de la sesión */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText type="title">Recorrido de la Sesión</ThemedText>
            <TouchableOpacity onPress={() => setShowMapModal(false)}>
              <IconSymbol name="xmark.circle.fill" size={30} color="#666" />
            </TouchableOpacity>
          </View>

          {selectedSession && selectedSession.routePoints.length > 0 && (
            <>
              <MapView
                style={styles.modalMap}
                initialRegion={{
                  latitude: selectedSession.routePoints[0].latitude,
                  longitude: selectedSession.routePoints[0].longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
              >
                <Polyline
                  coordinates={selectedSession.routePoints}
                  strokeColor="#2196F3"
                  strokeWidth={5}
                />
              </MapView>

              <View style={styles.modalStats}>
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatLabel}>Fecha</Text>
                  <Text style={styles.modalStatValue}>
                    {formatDate(selectedSession.startTime)}
                  </Text>
                </View>
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatLabel}>Conducción</Text>
                  <Text style={styles.modalStatValue}>
                    {formatDuration(selectedSession.drivingTime)}
                  </Text>
                </View>
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatLabel}>V. Máxima</Text>
                  <Text style={styles.modalStatValue}>
                    {Math.floor(selectedSession.maxSpeed)} km/h
                  </Text>
                </View>
                <View style={styles.modalStatItem}>
                  <Text style={styles.modalStatLabel}>Distancia</Text>
                  <Text style={styles.modalStatValue}>
                    {selectedSession.distance.toFixed(2)} km
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>

      {history.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={async () => {
            Alert.alert(
              "Borrar Todo el Historial",
              "¿Estás seguro de que quieres borrar todo el historial?",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar Todo",
                  style: "destructive",
                  onPress: async () => {
                    await DrivingStatsService.clearHistory();
                    loadHistory();
                  },
                },
              ],
            );
          }}
        >
          <Text style={styles.clearButtonText}>BORRAR TODO EL HISTORIAL</Text>
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  refreshButton: {
    padding: 10,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingBottom: 5,
  },
  dateText: {
    fontSize: 14,
    color: "#666",
  },
  maxSpeedText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0a7ea4",
  },
  cardBody: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: "#999",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  statSeparator: {
    width: 1,
    height: 30,
    backgroundColor: "#eee",
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: "center",
  },
  emptyText: {
    color: "#999",
    fontSize: 16,
  },
  clearButton: {
    margin: 20,
    padding: 15,
    backgroundColor: "#ff4444",
    borderRadius: 10,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0a7ea4",
  },
  deleteButton: {
    backgroundColor: "#ffe0e0",
  },
  deleteButtonText: {
    color: "#ff4444",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalMap: {
    flex: 1,
  },
  modalStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  modalStatItem: {
    alignItems: "center",
  },
  modalStatLabel: {
    fontSize: 10,
    color: "#999",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
});
