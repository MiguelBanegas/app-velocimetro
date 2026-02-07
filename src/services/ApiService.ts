import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/Settings";

const BASE_URL = "https://api.appvelocidad.mabcontrol.ar";

type QueueEntry = {
  action: "startTrack" | "postPoints" | "stopTrack" | "deviceLocation";
  params: any;
};

async function health() {
  const resp = await fetch(`${BASE_URL}/health`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return resp.json();
}

async function startTrack(user_id: number, device_id: string) {
  const makeCall = async () => {
    const resp = await fetch(`${BASE_URL}/tracks/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, device_id }),
    });
    if (!resp.ok) throw new Error(`startTrack failed: ${resp.status}`);
    return resp.json(); // expects { track_id: number }
  };

  try {
    return await requestWithRetry(makeCall, {
      action: "startTrack",
      params: { user_id, device_id },
    });
  } catch (e) {
    // enqueue for later
    await enqueueFailed({
      action: "startTrack",
      params: { user_id, device_id },
    });
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
) {
  // Filter out consecutive points with identical coordinates to avoid sending duplicates
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
    const resp = await fetch(`${BASE_URL}/tracks/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_id, points: filteredPoints }),
    });
    if (!resp.ok) throw new Error(`postPoints failed: ${resp.status}`);
    return resp.json(); // expects { inserted: n }
  };

  try {
    return await requestWithRetry(makeCall, {
      action: "postPoints",
      params: { track_id, points },
    });
  } catch (e) {
    await enqueueFailed({ action: "postPoints", params: { track_id, points } });
    throw e;
  }
}

async function stopTrack(track_id: number) {
  const makeCall = async () => {
    const resp = await fetch(`${BASE_URL}/tracks/${track_id}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) throw new Error(`stopTrack failed: ${resp.status}`);
    return resp.json(); // expects { status: 'stopped', track: {...} }
  };

  try {
    return await requestWithRetry(makeCall, {
      action: "stopTrack",
      params: { track_id },
    });
  } catch (e) {
    await enqueueFailed({ action: "stopTrack", params: { track_id } });
    throw e;
  }
}

async function postDeviceLocation(params: {
  device_id: string;
  lat: number;
  lon: number;
}) {
  const makeCall = async () => {
    const resp = await fetch(`${BASE_URL}/devices/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!resp.ok) throw new Error(`postDeviceLocation failed: ${resp.status}`);
    return resp.json();
  };

  try {
    return await requestWithRetry(makeCall, {
      action: "deviceLocation",
      params,
    });
  } catch (e) {
    await enqueueFailed({ action: "deviceLocation", params });
    throw e;
  }
}

async function requestWithRetry(
  fn: () => Promise<any>,
  entry: QueueEntry,
  attempts = 3,
  delayMs = 500,
) {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      // small backoff
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, i)));
    }
  }
  // After retries fail, rethrow to caller so they can enqueue
  throw lastErr;
}

async function enqueueFailed(entry: QueueEntry) {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.FAILED_SENDS);
    const arr: QueueEntry[] = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    await AsyncStorage.setItem(STORAGE_KEYS.FAILED_SENDS, JSON.stringify(arr));
  } catch (e) {
    console.warn("ApiService.enqueueFailed error:", e);
  }
}

async function drainQueue() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.FAILED_SENDS);
    const arr: QueueEntry[] = raw ? JSON.parse(raw) : [];
    if (arr.length === 0) return;
    const remaining: QueueEntry[] = [];
    for (const entry of arr) {
      try {
        if (entry.action === "startTrack") {
          await startTrack(entry.params.user_id, entry.params.device_id);
        } else if (entry.action === "postPoints") {
          await postPoints(entry.params.track_id, entry.params.points);
        } else if (entry.action === "stopTrack") {
          await stopTrack(entry.params.track_id);
        } else if (entry.action === "deviceLocation") {
          await postDeviceLocation(entry.params);
        }
      } catch {
        // keep entry for later
        remaining.push(entry);
      }
    }
    await AsyncStorage.setItem(
      STORAGE_KEYS.FAILED_SENDS,
      JSON.stringify(remaining),
    );
  } catch (e) {
    console.warn("ApiService.drainQueue error:", e);
  }
}

export default {
  health,
  startTrack,
  postPoints,
  stopTrack,
  postDeviceLocation,
  drainQueue,
};

export {
  drainQueue,
  health,
  postDeviceLocation,
  postPoints,
  startTrack,
  stopTrack,
};
