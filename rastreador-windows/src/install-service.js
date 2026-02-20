const Service = require("node-windows").Service;
const path = require("path");

// Crear objeto de servicio
const svc = new Service({
  name: "Orion Rastreador Windows",
  description: "Servicio de rastreo de ubicación para Windows - Orion",
  script: path.join(__dirname, "service.js"),
  nodeOptions: ["--harmony", "--max_old_space_size=4096"],
  env: [
    {
      name: "NODE_ENV",
      value: "production",
    },
  ],
});

// Escuchar el evento de instalación
svc.on("install", function () {
  console.log("✓ Servicio instalado correctamente");
  console.log("✓ Iniciando servicio...");
  svc.start();
});

svc.on("start", function () {
  console.log("✓ Servicio iniciado");
  console.log("");
  console.log("El servicio está corriendo en segundo plano.");
  console.log("Accede a http://localhost:3456 para configurarlo.");
  console.log("");
  console.log("Para desinstalarlo, ejecuta: npm run uninstall-service");
});

svc.on("alreadyinstalled", function () {
  console.log("⚠ El servicio ya está instalado");
  console.log(
    "Para reinstalar, primero desinstala con: npm run uninstall-service",
  );
});

svc.on("error", function (err) {
  console.error("✗ Error:", err);
});

console.log("Instalando servicio de Windows...");
console.log("Esto puede tardar unos segundos...");
console.log("");

svc.install();
