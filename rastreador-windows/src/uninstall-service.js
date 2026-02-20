const Service = require("node-windows").Service;
const path = require("path");

// Crear objeto de servicio (debe coincidir con el de instalación)
const svc = new Service({
  name: "Orion Rastreador Windows",
  script: path.join(__dirname, "service.js"),
});

// Escuchar el evento de desinstalación
svc.on("uninstall", function () {
  console.log("✓ Servicio desinstalado correctamente");
  console.log("El servicio ha sido eliminado del sistema.");
});

svc.on("error", function (err) {
  console.error("✗ Error:", err);
});

console.log("Desinstalando servicio de Windows...");
console.log("");

svc.uninstall();
