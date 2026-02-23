import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/Settings";
import { LogService } from "./LogService";

const BASE_URL = "https://api.appvelocidad.mabcontrol.ar";
const FETCH_TIMEOUT_MS = 10000; // 10 segundos de timeout

type QueueEntry = {
  action: "startTrack" | "postPoints" | "stopTrack" | "deviceLocation";
  params: any;
};

/**
 * Función auxiliar para realizar fetch con timeout
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function health() {
  const resp = await fetchWithTimeout(`${BASE_URL}/health`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return resp.json();
}

/**
 * Realiza una llamada a la API con reintentos pero SIN encolar en caso de fallo.
 * Útil para drainQueue.
 */
async function _callWithRetry(
  fn: () => Promise<any>,
  attempts = 3,
  delayMs = 500,
) {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

async function startTrack(
  user_id: string,
  device_id: string,
  skipEnqueue = false,
) {
  LogService.log("INFO", "Iniciando startTrack", `user:${user_id}`);
  const makeCall = async () => {
    const resp = await fetchWithTimeout(`${BASE_URL}/tracks/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, device_id }),
    });
    if (!resp.ok) throw new Error(`startTrack failed: ${resp.status}`);
    return resp.json(); // expects { track_id: number }
  };

  try {
    const res = await _callWithRetry(makeCall);
    LogService.log("INFO", "startTrack exitoso", `track_id:${res.track_id}`);
    return res;
  } catch (e: any) {
    LogService.log("ERROR", "Falló startTrack", e.message);
    if (!skipEnqueue) {
      await enqueueFailed({
        action: "startTrack",
        params: { user_id, device_id },
      });
    }
    throw e;
  }
}

async function postPoints(
  track_id: number,
  points: {
    lat: number;
    lon: number;
    altitude?: number | null;
    speed?: number | null;
  }[],
  skipEnqueue = false,
) {
  const EPS = 1e-6;
  const filteredPoints = points.filter((p, idx, arr) => {
    if (idx === 0) return true;
    const prev = arr[idx - 1];
    return Math.abs(p.lat - prev.lat) > EPS || Math.abs(p.lon - prev.lon) > EPS;
  });

  if (!filteredPoints || filteredPoints.length === 0) {
    return { inserted: 0 };
  }

  const makeCall = async () => {
    const resp = await fetchWithTimeout(`${BASE_URL}/tracks/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_id, points: filteredPoints }),
    });
    if (!resp.ok) throw new Error(`postPoints failed: ${resp.status}`);
    return resp.json();
  };

  try {
    const res = await _callWithRetry(makeCall);
    LogService.log(
      "DEBUG",
      "Puntos enviados OK",
      `track:${track_id}, pts:${filteredPoints.length}`,
    );
    return res;
  } catch (e: any) {
    LogService.log(
      "ERROR",
      "Falló postPoints",
      `${e.message} (track:${track_id})`,
    );
    if (!skipEnqueue) {
      await enqueueFailed({
        action: "postPoints",
        params: { track_id, points },
      });
    }
    throw e;
  }
}

async function stopTrack(track_id: number, skipEnqueue = false) {
  const makeCall = async () => {
    const resp = await fetchWithTimeout(`${BASE_URL}/tracks/${track_id}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) throw new Error(`stopTrack failed: ${resp.status}`);
    return resp.json();
  };

  try {
    return await _callWithRetry(makeCall);
  } catch (e) {
    if (!skipEnqueue) {
      await enqueueFailed({ action: "stopTrack", params: { track_id } });
    }
    throw e;
  }
}

async function postDeviceLocation(
  params: {
    device_id: string;
    lat: number;
    lon: number;
  },
  skipEnqueue = false,
) {
  const makeCall = async () => {
    const resp = await fetchWithTimeout(`${BASE_URL}/devices/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!resp.ok) throw new Error(`postDeviceLocation failed: ${resp.status}`);
    return resp.json();
  };

  try {
    const res = await _callWithRetry(makeCall);
    LogService.log("DEBUG", "Dispositivo reportado OK");
    return res;
  } catch (e: any) {
    if (!skipEnqueue) {
      await enqueueFailed({ action: "deviceLocation", params });
    }
    throw e;
  }
}

async function enqueueFailed(entry: QueueEntry) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.FAILED_SENDS);
    if (raw && raw.length > 5_000_000) {
      // > 5MB de cola es peligroso
      console.warn("Queue too large, clearing to avoid crash");
      await AsyncStorage.removeItem(STORAGE_KEYS.FAILED_SENDS);
      return;
    }
    let arr: QueueEntry[] = raw ? JSON.parse(raw) : [];

    // Evitar que la cola crezca infinitamente si hay un error persistente grave
    if (arr.length > 500) {
      arr = arr.slice(-500); // Mantener solo los últimos 500 fallos
    }

    arr.push(entry);
    await AsyncStorage.setItem(STORAGE_KEYS.FAILED_SENDS, JSON.stringify(arr));
  } catch (e) {
    console.warn("ApiService.enqueueFailed error:", e);
  }
}

let isDraining = false;

async function drainQueue() {
  if (isDraining) return;
  isDraining = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.FAILED_SENDS);
    if (!raw) return;

    let arr: QueueEntry[] = JSON.parse(raw);
    const droppedPostPoints = arr.filter((entry) => entry.action === "postPoints").length;
    if (droppedPostPoints > 0) {
      arr = arr.filter((entry) => entry.action !== "postPoints");
      LogService.log(
        "INFO",
        "Cola: descartando puntos en vivo",
        `${droppedPostPoints} items postPoints removidos`,
      );
    }
    if (arr.length === 0) return;

    LogService.log(
      "INFO",
      "Drenando cola de pendientes",
      `${arr.length} pendientes`,
    );

    // Procesar máximo 20 items por vez para no bloquear la tarea de fondo demasiado tiempo
    const BATCH_SIZE = 20;
    const toProcess = arr.slice(0, BATCH_SIZE);
    const remainingInQueue = arr.slice(BATCH_SIZE);

    const stillFailed: QueueEntry[] = [];

    for (const entry of toProcess) {
      try {
        if (entry.action === "startTrack") {
          await startTrack(entry.params.user_id, entry.params.device_id, true);
        } else if (entry.action === "postPoints") {
          await postPoints(entry.params.track_id, entry.params.points, true);
        } else if (entry.action === "stopTrack") {
          await stopTrack(entry.params.track_id, true);
        } else if (entry.action === "deviceLocation") {
          await postDeviceLocation(entry.params, true);
        }
        // Pausa breve entre envíos
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        stillFailed.push(entry);
      }
    }

    // Actualizar la cola: lo que no procesamos + lo que falló de nuevo
    const finalQueue = [...stillFailed, ...remainingInQueue].slice(-500);

    if (finalQueue.length > 0) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.FAILED_SENDS,
        JSON.stringify(finalQueue),
      );
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.FAILED_SENDS);
    }

    if (stillFailed.length === 0 && toProcess.length > 0) {
      LogService.log(
        "INFO",
        "Cola: Lote procesado con éxito",
        `${toProcess.length} items enviados`,
      );
    } else if (stillFailed.length > 0) {
      LogService.log(
        "WARN",
        "Cola: Lote parcial",
        `${toProcess.length - stillFailed.length} OK, ${stillFailed.length} fallaron`,
      );
    }
  } catch (e) {
    console.warn("ApiService.drainQueue error:", e);
  } finally {
    isDraining = false;
  }
}

async function getQueueCount(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.FAILED_SENDS);
    if (!raw) return 0;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

async function uploadFullTrack(historyItem: any) {
  const device_id = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  const user_id = await AsyncStorage.getItem(STORAGE_KEYS.USER_ID);

  LogService.log("INFO", "Subiendo recorrido completo", `id:${historyItem.id}`);

  const makeCall = async () => {
    const resp = await fetchWithTimeout(`${BASE_URL}/tracks/full`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        device_id,
        track: historyItem,
      }),
    });
    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "Sin detalle");
      throw new Error(
        `Servidor respondió ${resp.status}: ${errorText.slice(0, 50)}`,
      );
    }
    return resp.json();
  };

  try {
    const res = await _callWithRetry(makeCall);
    LogService.log("INFO", "Recorrido subido exitosamente");
    return res;
  } catch (e: any) {
    LogService.log("ERROR", "Falló subida de recorrido", e.message);
    throw e;
  }
}

export default {
  health,
  startTrack,
  postPoints,
  stopTrack,
  postDeviceLocation,
  drainQueue,
  getQueueCount,
  uploadFullTrack,
};

export {
    drainQueue,
    health,
    postDeviceLocation,
    postPoints,
    startTrack,
    stopTrack,
    uploadFullTrack
};

