# Orion Rastreador Windows

Sistema de rastreo de ubicación para Windows con interfaz web.

## Características

- 🌍 Geolocalización automática por IP
- 📍 Soporte para coordenadas manuales
- 🔄 Envío periódico configurable
- 🖥️ Interfaz web moderna en `http://localhost:3456`
- ⚙️ Instalable como servicio de Windows
- 🚀 Auto-inicio con el sistema operativo
- 📊 Estadísticas en tiempo real

## Instalación

### 1. Instalar dependencias

```powershell
cd c:\Users\pc\Desktop\app-velocidad\rastreador-windows
npm install
```

### 2. Probar en modo desarrollo

```powershell
npm start
```

Luego abre tu navegador en `http://localhost:3456`

### 3. Instalar como servicio de Windows (Recomendado)

**IMPORTANTE: Ejecutar PowerShell como Administrador**

```powershell
npm run install-service
```

El servicio se instalará y arrancará automáticamente. Seguirá corriendo incluso después de cerrar la terminal o reiniciar Windows.

## Uso

1. **Accede a la interfaz web**: `http://localhost:3456`
2. **Configura el Device ID**: Nombre único para identificar tu notebook
3. **Ajusta el intervalo**: Frecuencia de envío en segundos (mínimo 10)
4. **Selecciona tipo de ubicación**:
   - **Automática (IP)**: Detecta ubicación aproximada según tu IP pública
   - **Manual**: Ingresa coordenadas fijas (útil si tu notebook no se mueve)
5. **Inicia el rastreo**: Click en "Iniciar Rastreo"

## Comandos disponibles

```powershell
# Iniciar en modo desarrollo (manual)
npm start

# Instalar como servicio de Windows
npm run install-service

# Desinstalar el servicio
npm run uninstall-service
```

## Gestión del Servicio

Una vez instalado como servicio, puedes gestionarlo desde:

1. **Servicios de Windows** (`services.msc`):
   - Busca "Orion Rastreador Windows"
   - Puedes iniciar/detener/reiniciar desde ahí

2. **Interfaz Web** (`http://localhost:3456`):
   - Control completo del rastreo
   - Configuración en tiempo real
   - Estadísticas y estado de conexión

## Ubicación por IP

El sistema usa el servicio gratuito `ipapi.co` para obtener coordenadas aproximadas basadas en tu IP pública. La precisión varía según tu proveedor de internet:

- **IP fija**: Ubicación muy precisa
- **IP dinámica**: Ubicación aproximada de tu ciudad/región

## Solución de Problemas

### El servicio no inicia

1. Verifica que ejecutaste PowerShell como Administrador
2. Revisa los logs en: `C:\Windows\System32\config\systemprofile\AppData\Local\Temp\`

### No detecta ubicación

1. Verifica tu conexión a internet
2. Prueba con "Probar Ubicación" en la interfaz web
3. Si falla, usa ubicación manual

### No puedo acceder a la interfaz web

1. Verifica que el servicio esté corriendo
2. Intenta `http://127.0.0.1:3456` en lugar de localhost
3. Revisa el firewall de Windows

## Desinstalación

```powershell
# Como Administrador
npm run uninstall-service

# Luego puedes eliminar la carpeta completa
```

## Notas de Seguridad

- El servicio corre en `localhost` únicamente
- No es accesible desde la red local por defecto
- Los datos de configuración se guardan en `config.json`

## Soporte

Para problemas o consultas, contacta al equipo de Orion.
