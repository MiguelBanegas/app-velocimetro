const { startServer } = require("./web-server");
const tracker = require("./tracker");
const config = require("./config");

async function main() {
  console.log("=".repeat(50));
  console.log("Orion Rastreador Windows - Iniciando...");
  console.log("=".repeat(50));

  try {
    // Iniciar servidor web
    await startServer();
    console.log("✓ Servidor web iniciado en http://localhost:3456");

    // Si estaba habilitado, iniciar tracker automáticamente
    if (config.get("enabled")) {
      console.log("✓ Auto-iniciando rastreador (estaba habilitado)");
      tracker.start();
    } else {
      console.log("○ Rastreador detenido. Usa la interfaz web para iniciarlo.");
    }

    console.log("=".repeat(50));
    console.log(
      "Sistema listo. Accede a http://localhost:3456 para configurar.",
    );
    console.log("=".repeat(50));
  } catch (error) {
    console.error("Error fatal al iniciar:", error);
    process.exit(1);
  }
}

// Manejo de señales para cierre limpio
process.on("SIGINT", () => {
  console.log("\nDeteniendo servicio...");
  tracker.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nDeteniendo servicio...");
  tracker.stop();
  process.exit(0);
});

main();
