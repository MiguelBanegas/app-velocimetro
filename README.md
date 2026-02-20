# 🚗 App Velocímetro - Aplicación de Rastreo de Velocidad

Aplicación móvil React Native para Android que rastrea la velocidad del usuario en tiempo real, proporciona alertas de velocidad configurables, registra estadísticas de conducción y visualiza recorridos en un mapa.

## 📱 Características

### Rastreo de Velocidad en Tiempo Real

- **Velocímetro visual** con indicador circular grande y fácil de leer
- **Alertas de velocidad** configurables con tres umbrales personalizables
- **Alertas audibles** con diferentes tonos de beep seleccionables
- **Rastreo en segundo plano** que continúa funcionando incluso con la pantalla apagada

### Estadísticas de Conducción

- **Tiempo de conducción** actualizado cada segundo
- **Tiempo detenido** (cuando la velocidad es < 10 km/h)
- **Velocidad máxima** alcanzada durante la sesión
- **Distancia recorrida** calculada automáticamente
- **Visualización de ruta** en mapa con polyline

### Mapa Interactivo

- **Zoom real del mapa** con controles +/- (niveles 10-18)
- **Modo de navegación** con seguimiento automático de la ubicación
- **Círculo de ubicación** de 500m de radio
- **Visualización de ruta** en tiempo real
- **Efecto de titilación** en el velocímetro cuando se supera la velocidad (5 segundos)

### Historial de Sesiones

- **Guardado automático** de cada sesión al finalizarla
- **Visualización de mapas** del recorrido de sesiones pasadas
- **Borrado individual** de sesiones con confirmación
- **Estadísticas completas** por sesión (fecha, duración, velocidad máxima, distancia)

### Configuración Personalizable

- **Umbrales de velocidad** (3 niveles configurables)
- **Intervalo de actualización GPS** (500ms a 5000ms)
- **Selección de tono de beep** (3 tonos predefinidos + personalizado)
- **Intervalo de alertas** configurable

## 🛠️ Tecnologías Utilizadas

- **React Native** con Expo
- **TypeScript** para type safety
- **React Native Maps** para visualización de mapas
- **Expo Location** para rastreo GPS
- **Expo Task Manager** para rastreo en segundo plano
- **AsyncStorage** para persistencia de datos
- **Expo AV** para alertas audibles

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- npm o yarn
- Expo CLI
- Android Studio (para desarrollo Android)
- Dispositivo Android o emulador

## 🚀 Instalación

1. **Clonar el repositorio**

   ```bash
   git clone https://github.com/MiguelBanegas/app-velocimetro.git
   cd app-velocimetro
   ```

2. **Instalar dependencias**

   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo**

   ```bash
   npm start
   ```

4. **Ejecutar en Android**
   ```bash
   npm run android
   ```

## 📦 Compilar APK

Para generar un APK de producción:

```bash
cd android
./gradlew assembleRelease
```

El APK se generará en: `android/app/build/outputs/apk/release/app-release.apk`

## 🎯 Uso

### Pantalla Principal (Home)

1. Presiona el botón **Play** para iniciar el rastreo
2. El velocímetro mostrará tu velocidad actual
3. Las estadísticas se actualizarán en tiempo real
4. Presiona **Pause** para detener temporalmente
5. Presiona **Finalizar** para terminar y guardar la sesión

### Pantalla de Mapa

1. Visualiza tu ubicación y ruta en tiempo real
2. Usa los botones **+/-** para acercar/alejar el mapa
3. Activa el **modo de navegación** para seguimiento automático
4. Presiona **🏁** para finalizar la sesión

### Pantalla de Historial

1. Ve todas tus sesiones guardadas
2. Presiona **Ver Mapa** para visualizar el recorrido de una sesión
3. Presiona **Borrar** para eliminar una sesión específica
4. Usa **BORRAR TODO EL HISTORIAL** para limpiar todo

### Configuración

1. Ajusta los **umbrales de velocidad** (km/h)
2. Selecciona el **tono de beep** preferido
3. Configura el **intervalo de actualización GPS**
4. Ajusta el **intervalo de alertas**

## 📂 Estructura del Proyecto

```
app-velocidad/
├── app/                      # Pantallas de la aplicación
│   ├── (tabs)/
│   │   ├── index.tsx        # Pantalla principal (Home)
│   │   ├── map.tsx          # Pantalla de mapa
│   │   ├── explore.tsx      # Pantalla de historial
│   │   └── settings.tsx     # Pantalla de configuración
├── src/
│   ├── services/            # Servicios de la aplicación
│   │   ├── LocationService.ts
│   │   ├── DrivingStatsService.ts
│   │   ├── AlertService.ts
│   │   ├── BackgroundTasks.ts
│   │   └── SettingsService.ts
│   ├── hooks/               # Custom hooks
│   │   └── useSpeedTracker.ts
│   └── types/               # Definiciones de tipos TypeScript
│       └── types.ts
├── assets/                  # Recursos (imágenes, sonidos)
│   └── sounds/             # Archivos de audio para alertas
└── components/             # Componentes reutilizables
```

## 🔧 Configuración de Permisos

La aplicación requiere los siguientes permisos en Android:

- **ACCESS_FINE_LOCATION** - Para rastreo GPS preciso
- **ACCESS_COARSE_LOCATION** - Para ubicación aproximada
- **FOREGROUND_SERVICE** - Para rastreo en segundo plano
- **ACCESS_BACKGROUND_LOCATION** - Para rastreo con pantalla apagada

Estos permisos se solicitan automáticamente al usuario al iniciar el rastreo.

## 🎨 Características de UI/UX

- **Velocímetro grande** (120x120px) con número de 56px para fácil lectura
- **Colores dinámicos** según la velocidad:
  - Azul: velocidad normal
  - Naranja: primer umbral superado
  - Rojo: segundo umbral superado
  - Rojo oscuro: tercer umbral superado
- **Efecto de titilación** de 5 segundos cuando se supera la velocidad
- **Botones bien posicionados** para fácil acceso durante la conducción
- **Confirmaciones** para acciones destructivas (borrar sesiones)

## 📝 Notas Importantes

- El rastreo GPS funciona mejor en exteriores con buena señal
- El rastreo en segundo plano consume batería
- Las estadísticas se guardan automáticamente cada segundo
- El historial se limita a 50 sesiones más recientes
- La distancia se calcula usando la fórmula de Haversine

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👤 Autor

**Miguel Banegas**

- GitHub: [@MiguelBanegas](https://github.com/MiguelBanegas)

## 🙏 Agradecimientos

- Expo team por el excelente framework
- React Native Maps por la integración de mapas
- Comunidad de React Native por el soporte

---

**Versión:** 1.0.0  
**Última actualización:** Enero 2026

## 🔗 Integración con API remota

La app puede enviar sesiones de rastreo a la API en https://api.appvelocidad.mabcontrol.ar utilizando los siguientes endpoints:

- Health: `GET /health` — devuelve `{ "ok": true }`.
- Iniciar track: `POST /tracks/start` — body: `{ "user_id": number, "device_id": string }` → respuesta `{ "track_id": number }`.
- Enviar puntos (batch): `POST /tracks/points` — body: `{ "track_id": number, "points": [{ "lat": number, "lon": number, "speed": number }] }` → respuesta `{ "inserted": number }`.
- Finalizar track: `POST /tracks/:id/stop` — ejemplo `POST /tracks/1/stop` → respuesta `{ "status": "stopped", "track": { ... } }`.

Encabezados: `Content-Type: application/json`. Actualmente la API no requiere autenticación.

Comportamiento en la app:

- Al finalizar una sesión la app realiza el flujo `startTrack` → `postPoints` → `stopTrack` automáticamente.
- Si una petición falla, se reintenta internamente hasta 3 veces con backoff. Si sigue fallando, la petición se encola en `AsyncStorage` (`STORAGE_KEYS.FAILED_SENDS`) y se reintentará más tarde con `drainQueue()`.
- `user_id` y `device_id` se pueden configurar desde la pantalla de Configuración (Settings).

Archivos relevantes:

- `src/services/ApiService.ts` — funciones `startTrack`, `postPoints`, `stopTrack`, `drainQueue`.
- `src/services/DrivingStatsService.ts` — integra el flujo de envío al finalizar sesiones y guarda `remoteTrackId` en el historial.
- `src/services/SettingsService.ts` — getters/setters para `user_id` y `device_id`.

Recomendaciones:

- Configurar `user_id` y `device_id` en la pantalla de Configuración antes de usar el envío automático.
- Considerar exponer el estado de la cola de envíos fallidos en la UI para depuración.
