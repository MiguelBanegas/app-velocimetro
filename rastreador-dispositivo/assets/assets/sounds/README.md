# INSTRUCCIONES: Archivos de Audio Faltantes

Esta carpeta debe contener los siguientes archivos de audio en formato MP3:

1. **alert1.mp3** - Tono de alerta corto y agudo
2. **alert2.mp3** - Tono de alerta doble
3. **alert3.mp3** - Tono de alerta triple
4. **chime.mp3** - Sonido de campanilla suave
5. **ding.mp3** - Sonido de ding simple

## Dónde Obtener Tonos Gratuitos

### Opción 1: Freesound.org (Recomendado)

1. Visita: https://freesound.org/
2. Busca: "notification beep", "alert tone", "chime", "ding"
3. Filtra por: Licencia Creative Commons 0 (CC0) - Dominio Público
4. Descarga archivos cortos (1-2 segundos)
5. Renombra según la lista de arriba

### Opción 2: Zapsplat.com

1. Visita: https://www.zapsplat.com/
2. Busca en la categoría "User Interface" > "Notifications"
3. Descarga tonos gratuitos
4. Renombra según la lista de arriba

### Opción 3: Usar Tonos del Sistema Android

Si tienes acceso a un dispositivo Android con root o emulador:

1. Navega a: `/system/media/audio/notifications/`
2. Copia 5 archivos .ogg
3. Convierte a MP3 usando: https://cloudconvert.com/ogg-to-mp3
4. Renombra según la lista de arriba

### Opción 4: Generar con Audacity (Software Gratuito)

1. Descarga Audacity: https://www.audacityteam.org/
2. Genera > Tono...
3. Configura:
   - Frecuencia: 800-1200 Hz
   - Duración: 0.3-0.5 segundos
4. Exporta como MP3

## Especificaciones Técnicas

- **Formato**: MP3
- **Duración**: 0.3 - 2 segundos
- **Bitrate**: 128 kbps o superior
- **Frecuencia de muestreo**: 44100 Hz

## Instalación

Una vez descargados, coloca los archivos en esta carpeta:
`assets/sounds/`

Los archivos deben llamarse exactamente:

- alert1.mp3
- alert2.mp3
- alert3.mp3
- chime.mp3
- ding.mp3
