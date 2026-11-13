# Forma — entrenamiento personal para iPhone

PWA de fuerza e hipertrofia, **gratis, local-first, sin cuentas ni suscripciones**. React + TypeScript + Vite + Tailwind + Framer Motion + IndexedDB. Funciona sin conexión una vez instalada.

## Funciones

- **Inicio**: saludo, entrenamiento de hoy / próximo, resumen semanal (anillo de objetivo, días, tiempo, volumen), últimos entrenamientos y botón **COMENZAR ENTRENAMIENTO**.
- **Importar rutina** (Rutinas → Importar): pegar **JSON**, pegar **texto estructurado** o subir un **archivo**; validación con explicación de cómo corregir cada error, vista previa **editable** (ejercicios, series, reps, descansos, días de la semana) y guardado. Los campos desconocidos del JSON se conservan (`extra`) para no perder información. Acepta claves en español e inglés, bloques ```` ```json ````, comillas tipográficas y comas finales. Incluye el **prompt para ChatGPT** listo para copiar.
- **Biblioteca** (42 ejercicios): ficha con animación en bucle, músculo principal (resaltado), secundarios, equipamiento, técnica paso a paso y consejos. Las animaciones son figuras SVG propias (sin vídeos ni servicios externos, ~0 KB y offline).
- **Entrenar**: series con pesos/reps grandes, "anterior", pesos sugeridos, **temporizador de descanso automático** (sonido + vibración donde exista, ±15 s), pantalla siempre encendida, detección de récords y entrenamiento que sobrevive a recargas.
- **Recomendación de peso**: doble progresión (llegas al máximo del rango → sube), repetir, descarga tras dos sesiones fallidas; sin historial usa el peso de la rutina o una estimación por peso corporal y nivel.
- **Progreso**: volumen semanal, curva de 1RM estimado por ejercicio, series por músculo, récords e historial.
- **Perfil**: nombre, unidades (kg/lb), objetivo semanal, **exportar / importar copia de seguridad** (combinar o reemplazar), borrar datos.

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
npm test         # tests del importador y recomendaciones
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
