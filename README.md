# Forma — entrenamiento personal para iPhone

PWA de fuerza e hipertrofia, **gratis, local-first, sin cuentas ni suscripciones**. React + TypeScript + Vite + Tailwind + Framer Motion + IndexedDB. Funciona sin conexión una vez instalada.

## Funciones

- **Inicio**: saludo, entrenamiento de hoy / próximo, resumen semanal (anillo de objetivo, días, tiempo, volumen), últimos entrenamientos y botón **COMENZAR ENTRENAMIENTO**.
- **Importar rutina** (Rutinas → Importar): pegar **JSON**, pegar **texto estructurado** o subir un **archivo**; validación con explicación de cómo corregir cada error, vista previa **editable** (ejercicios, series, reps, descansos, días de la semana) y guardado. Los campos desconocidos del JSON se conservan (`extra`) para no perder información. Acepta claves en español e inglés, bloques ```` ```json ````, comillas tipográficas y comas finales. Incluye el **prompt para ChatGPT** listo para copiar.
- **Biblioteca** (42 ejercicios): ficha con animación en bucle, músculo principal (resaltado), secundarios, equipamiento, técnica paso a paso y consejos. Las animaciones son figuras SVG propias (sin vídeos ni servicios externos, ~0 KB y offline).
- **Entrenar**: series con pesos/reps grandes, "anterior", pesos sugeridos, **temporizador de descanso automático** (sonido + vibración donde exista, ±15 s), pantalla siempre encendida, detección de récords y entrenamiento que sobrevive a recargas.
- **Recomendación de peso**: doble progresión (llegas al máximo del rango → sube), repetir, descarga tras dos sesiones fallidas; sin historial usa el peso de la rutina o una estimación por peso corporal y nivel.
- **Progreso**: volumen semanal, curva de 1RM estimado por ejercicio, series por músculo, récords e historial.
- **Expediente (perfil único y privado)**, sin cuentas ni funciones sociales, todo en IndexedDB:
  - *Datos personales*: nombre, fecha de nacimiento (edad calculada), altura, peso actual/objetivo y foto opcional. Precargados y editables: 23 años, 171 cm, 60 kg (nada más se inventa).
  - *Perfil deportivo*: objetivo principal y secundarios, nivel, tiempo entrenando, deportes, frecuencia, días disponibles, duración de sesión y equipamiento, con bloque específico de **Jiu-Jitsu** (días de clase, duración, registro de sesiones).
  - *Objetivos físicos* (músculo, fuerza, resistencia, movilidad, condición, peso) con progreso real calculado desde el historial corporal y los 1RM estimados.
  - *Historial corporal*: peso, cintura, pecho, brazos, piernas, cadera y fotos opcionales, con gráficos. Solo se guarda lo que introduces.
  - *Recuperación y fatiga* (voluntaria): sueño, calidad, energía, fatiga, dolor (con zonas) y recuperación percibida. Son sensaciones, no diagnósticos.
  - *Entrenador*: muestra qué datos usa y qué ajustes aplica.
  - *Privacidad*: copia de seguridad exportable/importable (v2, incluye perfil) y borrado total.
- **Entrenador conectado al perfil**:
  - Cargas iniciales según tu peso **actual** y nivel (si cambia el peso, cambian las sugerencias).
  - Con recuperación baja o carga semanal muy alta: −1 serie y ≈−5/−8 % de carga; con dolor en un músculo: −1 serie en ese grupo; y no sube de peso aunque hayas completado el rango.
  - Carga semanal = minutos × RPE de gimnasio **y** Jiu-Jitsu/otras actividades (ratio de los últimos 7 días frente a tu media de 3 semanas; no opina sin historial).
  - Avisa si un día de rutina cae en clase de Jiu-Jitsu o fuera de tus días disponibles, asigna días según tu perfil al importar y acorta sesiones que superan tu tiempo disponible.
  - Cada ajuste se muestra y se puede desactivar (Entrenador → «Adaptar a mi recuperación», o por sesión al empezar).
- **Ajustes**: unidades (kg/lb), sonido y vibración del temporizador.

## Formato JSON para ChatGPT

```json
{
  "name": "Rutina de hipertrofia",
  "goal": "Muscle gain",
  "days": [
    {
      "name": "Día 1 - Tren superior",
      "weekdays": ["Lunes"],
      "exercises": [
        { "name": "Press banca", "muscle": "Pecho", "sets": 4, "reps": "8-10", "rest": 120,
          "recommendedWeight": 40, "notes": "Mantener control en la fase excéntrica" }
      ]
    }
  ]
}
```

`rest` en segundos · `weekdays` opcional (0 = lunes … 6 = domingo, o nombres). El texto libre también vale: `Press banca 4x6-8 descanso 150s peso 60kg`.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm test         # tests del importador, recomendaciones, perfil y entrenador
npm run build    # build de producción en dist/ (con service worker)
npm run preview
```

## Instalar en el iPhone

Una PWA necesita servirse por **HTTPS**. Opciones gratuitas: GitHub Pages (el workflow `.github/workflows/pages.yml` ya lo despliega al hacer push a `main`; activa *Settings → Pages → Source: GitHub Actions*), Netlify o Cloudflare Pages (publicando `dist/`).

Después, en **Safari**: Compartir → **Añadir a pantalla de inicio**. Se abre a pantalla completa y funciona sin conexión.

## Limitaciones conocidas (iOS)

- Los avisos del temporizador **no suenan con la app en segundo plano o la pantalla bloqueada** (Safari no permite notificaciones locales programadas sin push). Por eso la pantalla se mantiene encendida durante el entreno y el descanso se calcula por marca de tiempo: al volver a la app el tiempo es exacto.
- `navigator.vibrate` no existe en Safari/iOS; la vibración solo funciona en Android.
- Los datos viven en el dispositivo. Instalada en la pantalla de inicio, iOS no los purga; aun así, **exporta copias de seguridad** de vez en cuando.
