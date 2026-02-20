import AsyncStorage from "@react-native-async-storage/async-storage";

const LOGS_KEY = "@app_logs";
const MAX_LOGS = 100;

export type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
}

class LogServiceClass {
  private logs: LogEntry[] = [];
  private isLoaded = false;
  private isSaving = false;
  private tag = "";
  private loadPromise: Promise<void> | null = null;

  setTag(tag: string) {
    this.tag = tag;
  }

  private async loadLogs() {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const saved = await AsyncStorage.getItem(LOGS_KEY);
        this.logs = saved ? JSON.parse(saved) : [];
      } catch (e) {
        this.logs = [];
      } finally {
        this.isLoaded = true;
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  async log(
    level: LogLevel,
    message: string,
    context?: string,
    specificTag?: string,
  ) {
    const currentTag = specificTag || this.tag;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: currentTag ? `[${currentTag}] ${message}` : message,
      context: typeof context === "object" ? JSON.stringify(context) : context,
    };

    console.log(`[${entry.level}] ${entry.message}`, context || "");

    if (!this.isLoaded) {
      await this.loadLogs();
    }

    this.logs.unshift(entry);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    // Guardar asíncronamente
    if (!this.isSaving) {
      this.isSaving = true;
      // Pequeño retardo para agrupar múltiples logs en una sola escritura
      setTimeout(async () => {
        try {
          await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(this.logs));
        } catch {
        } finally {
          this.isSaving = false;
        }
      }, 2000);
    }
  }

  async getLogs(): Promise<LogEntry[]> {
    await this.loadLogs();
    return this.logs;
  }

  async getFormattedLogs(): Promise<string> {
    const logs = await this.getLogs();
    return logs
      .map((l) => {
        const date = new Date(l.timestamp);
        const time = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        return `[${time}] ${l.level}: ${l.message}`;
      })
      .join("\n");
  }

  async clearLogs() {
    this.logs = [];
    await AsyncStorage.removeItem(LOGS_KEY);
  }
}

export const LogService = new LogServiceClass();
