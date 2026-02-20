const fetch = require("node-fetch");
const { publicIpv4 } = require("public-ip");
const wifi = require("node-wifi");

// Inicializar módulo WiFi
wifi.init({
  iface: null, // Usar interfaz WiFi por defecto
});

class LocationService {
  constructor() {
    this.lastLocation = null;
    this.wifiEnabled = false;
    this.initWiFi();
  }

  async initWiFi() {
    try {
      // Verificar si WiFi está disponible
      const networks = await wifi.scan();
      this.wifiEnabled = networks && networks.length > 0;
      if (this.wifiEnabled) {
        console.log(
          `✓ WiFi geolocation enabled. Detected ${networks.length} networks.`,
        );
      }
    } catch (error) {
      console.log("WiFi geolocation not available:", error.message);
      this.wifiEnabled = false;
    }
  }

  /**
   * Obtiene ubicación usando redes WiFi cercanas
   * Mucho más preciso que IP (±20-100m vs ±5-50km)
   */
  async getLocationByWiFi() {
    try {
      console.log("Scanning WiFi networks for geolocation...");

      const networks = await wifi.scan();

      if (!networks || networks.length === 0) {
        throw new Error("No WiFi networks detected");
      }

      console.log(`Found ${networks.length} WiFi networks`);

      // Preparar datos para APIs de geolocalización
      const wifiAccessPoints = networks
        .filter((net) => net.mac && net.mac !== "(not associated)")
        .slice(0, 10)
        .map((net) => ({
          macAddress: net.mac.toUpperCase().replace(/:/g, "-"),
          signalStrength: net.signal_level || -50,
          channel: net.channel || 0,
        }));

      if (wifiAccessPoints.length === 0) {
        throw new Error("No valid WiFi access points found");
      }

      console.log(
        `Using ${wifiAccessPoints.length} access points for geolocation`,
      );

      // Intentar Google primero con la nueva API key
      let location = await this.getLocationByWiFiGoogle(wifiAccessPoints);
      if (location) return location;

      // Si Google falla, intentar servicios alternativos
      location = await this.getLocationByWiFiUnwired(wifiAccessPoints);
      if (location) return location;

      location = await this.getLocationByWiFiMozilla(wifiAccessPoints);
      if (location) return location;

      throw new Error("All WiFi geolocation services failed");
    } catch (error) {
      console.error("WiFi geolocation failed:", error.message);
      return null;
    }
  }

  /**
   * Google Geolocation API - Servicio principal
   */
  async getLocationByWiFiGoogle(wifiAccessPoints) {
    try {
      console.log("Trying Google Geolocation API...");

      const response = await fetch(
        "https://www.googleapis.com/geolocation/v1/geolocate?key=AIzaSyAESNgmZ2O6nu3S0z3h8LU8oC67-nPbxhw",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            considerIp: false,
            wifiAccessPoints: wifiAccessPoints,
          }),
          timeout: 15000,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.location && data.location.lat && data.location.lng) {
        this.lastLocation = {
          lat: data.location.lat,
          lon: data.location.lng,
          source: "wifi-google",
          accuracy: data.accuracy || 100,
          networks_used: wifiAccessPoints.length,
        };

        console.log(
          `✓ Google WiFi location: ${this.lastLocation.lat.toFixed(6)}, ${this.lastLocation.lon.toFixed(6)} (±${this.lastLocation.accuracy}m)`,
        );
        return this.lastLocation;
      }

      throw new Error("No location in Google response");
    } catch (error) {
      console.error("Google WiFi geolocation failed:", error.message);
      return null;
    }
  }

  /**
   * Unwired Labs LocationAPI - Servicio alternativo
   */
  async getLocationByWiFiUnwired(wifiAccessPoints) {
    try {
      console.log("Trying Unwired Labs LocationAPI...");

      const unwiredAPs = wifiAccessPoints.map((ap) => ({
        bssid: ap.macAddress.replace(/-/g, ":").toLowerCase(),
        signal: ap.signalStrength,
      }));

      const response = await fetch(
        "https://us1.unwiredlabs.com/v2/process.php",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: "pk.d0c5f8e5c0b6e4f8a9c7d3e2f1a4b5c6",
            wifi: unwiredAPs,
          }),
          timeout: 15000,
        },
      );

      if (!response.ok) {
        throw new Error(`Unwired API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "ok" && data.lat && data.lon) {
        this.lastLocation = {
          lat: data.lat,
          lon: data.lon,
          source: "wifi-unwired",
          accuracy: data.accuracy || 100,
          networks_used: unwiredAPs.length,
        };

        console.log(
          `✓ Unwired WiFi location: ${this.lastLocation.lat.toFixed(6)}, ${this.lastLocation.lon.toFixed(6)} (±${this.lastLocation.accuracy}m)`,
        );
        return this.lastLocation;
      }

      throw new Error("No location in Unwired response");
    } catch (error) {
      console.error("Unwired WiFi geolocation failed:", error.message);
      return null;
    }
  }

  /**
   * Mozilla Location Service - Servicio alternativo
   */
  async getLocationByWiFiMozilla(wifiAccessPoints) {
    try {
      console.log("Trying Mozilla Location Service...");

      const mozillaAPs = wifiAccessPoints.map((ap) => ({
        macAddress: ap.macAddress.replace(/-/g, ":").toLowerCase(),
        signalStrength: ap.signalStrength,
      }));

      const response = await fetch(
        "https://location.services.mozilla.com/v1/geolocate?key=test",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wifiAccessPoints: mozillaAPs,
          }),
          timeout: 15000,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mozilla API returned ${response.status}`);
      }

      const data = await response.json();

      if (data.location && data.location.lat && data.location.lng) {
        this.lastLocation = {
          lat: data.location.lat,
          lon: data.location.lng,
          source: "wifi-mozilla",
          accuracy: data.accuracy || 100,
          networks_used: mozillaAPs.length,
        };

        console.log(
          `✓ Mozilla WiFi location: ${this.lastLocation.lat.toFixed(6)}, ${this.lastLocation.lon.toFixed(6)} (±${this.lastLocation.accuracy}m)`,
        );
        return this.lastLocation;
      }

      throw new Error("No location in Mozilla response");
    } catch (error) {
      console.error("Mozilla WiFi geolocation failed:", error.message);
      return null;
    }
  }

  /**
   * Obtiene la ubicación usando la IP pública del dispositivo
   */
  async getLocationByIP() {
    try {
      const ip = await publicIpv4();
      console.log(`Detected public IP: ${ip}`);

      const response = await fetch(`https://ipapi.co/${ip}/json/`, {
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`IP geolocation service returned ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`API error: ${data.reason || "Unknown"}`);
      }

      if (data.latitude && data.longitude) {
        this.lastLocation = {
          lat: data.latitude,
          lon: data.longitude,
          source: "ip",
          ip: ip,
          city: data.city || "Unknown",
          region: data.region || "Unknown",
          country: data.country_name || "Unknown",
          accuracy: 5000,
        };
        console.log(
          `IP location: ${this.lastLocation.city}, ${this.lastLocation.country} (low accuracy)`,
        );
        return this.lastLocation;
      }

      throw new Error("No location data in response");
    } catch (error) {
      console.error("Error getting location by IP:", error.message);
      return await this.getLocationByIPFallback();
    }
  }

  /**
   * Servicio alternativo de geolocalización por IP
   */
  async getLocationByIPFallback() {
    try {
      console.log("Trying fallback IP geolocation service...");
      const response = await fetch("http://ip-api.com/json/", {
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error("Fallback service failed");
      }

      const data = await response.json();

      if (data.status === "success" && data.lat && data.lon) {
        this.lastLocation = {
          lat: data.lat,
          lon: data.lon,
          source: "ip",
          ip: data.query,
          city: data.city || "Unknown",
          region: data.regionName || "Unknown",
          country: data.country || "Unknown",
          accuracy: 5000,
        };
        console.log(
          `✓ Fallback IP location: ${this.lastLocation.city}, ${this.lastLocation.country}`,
        );
        return this.lastLocation;
      }

      throw new Error("No location data in fallback response");
    } catch (error) {
      console.error("Fallback geolocation also failed:", error.message);
      return null;
    }
  }

  /**
   * Obtiene ubicación automática: Intenta WiFi primero, luego IP
   */
  async getLocationAuto() {
    // Intentar WiFi primero (más preciso)
    if (this.wifiEnabled) {
      const wifiLocation = await this.getLocationByWiFi();
      if (wifiLocation) {
        return wifiLocation;
      }
    }

    // Si WiFi falla, usar IP
    console.log("Falling back to IP geolocation...");
    return await this.getLocationByIP();
  }

  /**
   * Obtiene la ubicación manual configurada
   */
  getManualLocation(lat, lon) {
    if (lat && lon) {
      this.lastLocation = {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        source: "manual",
        accuracy: 1,
      };
      return this.lastLocation;
    }
    return null;
  }

  /**
   * Obtiene la última ubicación conocida
   */
  getLastLocation() {
    return this.lastLocation;
  }

  /**
   * Verifica si WiFi está disponible
   */
  isWiFiAvailable() {
    return this.wifiEnabled;
  }
}

module.exports = new LocationService();
