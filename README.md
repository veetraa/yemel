# Forma — entrenador híbrido personal para iPhone

PWA de fuerza e hipertrofia, **gratis, local-first, sin cuentas ni suscripciones**. React + TypeScript + Vite + Tailwind + Framer Motion + IndexedDB. Funciona sin conexión una vez instalada.

## Navegación: seis apartados independientes

`Inicio · Gym · Combat · Filosofía · Progreso · Perfil` (barra inferior con iconos minimalistas, etiquetas cortas y safe areas de iPhone). Cada apartado tiene su propia pantalla, rutas y subnavegación.

| Apartado | Contenido (y solo ese) |
|---|---|
| **Gym** | Hoy (entrenar con series, pesos recomendados y temporizador de descanso) · Rutinas (con importación de ChatGPT) · Biblioteca de ejercicios animados · Cargas (historial de lo levantado) |
| **Combat** | Resumen (próxima sesión, mi semana de combate, importar) · **MMA · BJJ · Boxeo · Kickboxing · Wrestling**, cada una con su propia biblioteca técnica (con animaciones de ejecución en solitario), entrenos, vídeos propios (archivos privados en el iPhone o enlaces), historial y consejos |
| **Filosofía** | Estoicismo y desarrollo mental: frase del día, frases (por tema), filósofos, reflexiones guiadas, pilares (disciplina, autocontrol, resiliencia), diario personal y favoritos |
| **Progreso** | General (historial de todo, con filtros) · Gym · Combat (por disciplina) · Cuerpo (evolución física) |
| **Inicio** | Resumen de las áreas sin mezclar funciones (cada tarjeta lleva a su sección) + indicadores globales de recuperación |
| **Perfil** | Expediente del atleta y ajustes; semana y recuperación global; importación híbrida; copias de seguridad |

Gym no contiene técnicas de combate, Combat no contiene rutinas de musculación y Filosofía es una experiencia aparte. **Se comparten únicamente** los datos generales del perfil y los indicadores globales de recuperación y carga.

## Funciones

- **Inicio**: saludo, entrenamiento de hoy / próximo, resumen semanal (anillo de objetivo, días, tiempo, volumen), últimos entrenamientos y botón **COMENZAR ENTRENAMIENTO**.
- **Importar rutina** (Rutinas → Importar): pegar **JSON**, pegar **texto estructurado** o subir un **archivo**; validación con explicación de cómo corregir cada error, vista previa **editable** (ejercicios, series, reps, descansos, días de la semana) y guardado. Los campos desconocidos del JSON se conservan (`extra`) para no perder información. Acepta claves en español e inglés, bloques ```` ```json ````, comillas tipográficas y comas finales. Incluye el **prompt para ChatGPT** listo para copiar.
- **Biblioteca** (47 ejercicios + los tuyos): ficha con animación en bucle, músculo principal (resaltado), secundarios, equipamiento, técnica paso a paso y consejos. Las animaciones son figuras SVG propias (sin vídeos ni servicios externos, ~0 KB y offline).
- **Entrenar**: series con pesos/reps grandes, "anterior", pesos sugeridos, **temporizador de descanso automático** (sonido + vibración donde exista, ±15 s), pantalla siempre encendida, detección de récords y entrenamiento que sobrevive a recargas.
- **Recomendación de peso**: doble progresión (llegas al máximo del rango → sube), repetir, descarga tras dos sesiones fallidas; sin historial usa el peso de la rutina o una estimación por peso corporal y nivel.
- **Progreso**: volumen semanal, curva de 1RM estimado por ejercicio, series por músculo, récords e historial.
- **Expediente (perfil único y privado)**, sin cuentas ni funciones sociales, todo en IndexedDB:
  - *Datos personales*: nombre, fecha de nacimiento (edad calculada), altura, peso actual/objetivo y foto opcional. Precargados y editables: 23 años, 171 cm, 60 kg (nada más se inventa).
  - *Perfil deportivo*: tipo de atleta, disciplina principal, sesiones de gimnasio/combate/recuperación, objetivos, nivel, deportes, días disponibles, duración de sesión y equipamiento.
  - *Objetivos físicos* (músculo, fuerza, resistencia, movilidad, condición, peso) con progreso real calculado desde el historial corporal y los 1RM estimados.
  - *Historial corporal*: peso, cintura, pecho, brazos, piernas, cadera y fotos opcionales, con gráficos. Solo se guarda lo que introduces.
  - *Recuperación y fatiga* (voluntaria): sueño, calidad, energía, fatiga, dolor (con zonas) y recuperación percibida. Son sensaciones, no diagnósticos.
  - *Entrenador*: muestra qué datos usa y qué ajustes aplica.
  - *Privacidad*: copia de seguridad exportable/importable (v2, incluye perfil) y borrado total.
- **Entrenador conectado al perfil**:
  - Cargas iniciales según tu peso **actual** y nivel (si cambia el peso, cambian las sugerencias).
  - Con recuperación baja o carga semanal muy alta: −1 serie y ≈−5/−8 % de carga; con dolor en un músculo: −1 serie en ese grupo; y no sube de peso aunque hayas completado el rango.
  - Carga semanal = minutos × RPE de gimnasio **y** combate/otras actividades (ratio de los últimos 7 días frente a tu media de 3 semanas; no opina sin historial).
  - Avisa si un día de rutina cae en día de combate o fuera de tus días disponibles, asigna días según tu perfil al importar y acorta sesiones que superan tu tiempo disponible.
  - Cada ajuste se muestra y se puede desactivar (Entrenador → «Adaptar a mi recuperación», o por sesión al empezar).
- **Ajustes**: unidades (kg/lb), sonido y vibración del temporizador.

## Atleta híbrido (configuración del propietario)

Perfil único precargado: **Balanced Hybrid Athlete**, disciplina principal **MMA**, gimnasio 3×/semana, combate 2×/semana, 2 días de recuperación, preparación física integrada en el gimnasio.

| Día | Plan |
|---|---|
| Lunes | GYM A — tren superior, fuerza e hipertrofia |
| Martes | MMA — técnica, striking, grappling y desplazamientos (ligero) |
| Miércoles | Recuperación — movilidad y descanso activo |
| Jueves | GYM B — tren inferior, fuerza y potencia |
| Viernes | MMA — situaciones específicas y sparring según nivel (moderado) |
| Sábado | GYM C — full body, estabilidad y agarre |
| Domingo | Descanso completo |

- **Semana editable por sección** (días de gym en Gym → Rutinas, sesiones en Combat → Resumen, descansos en Perfil → Semana y recuperación): los cambios que rompan las reglas de recuperación (mín. 2 días de recuperación/descanso y 1 de descanso completo, máx. 3 días de entrenamiento seguidos) **no se aplican** y se explica por qué. Avisa de piernas antes/después de combate intenso, días duros seguidos y días fuera de tu disponibilidad.
- **Combate**: Striking, Boxeo, Kickboxing, Wrestling, Brazilian Jiu-Jitsu, Grappling, Transiciones y Defensa/escapes. Se registran técnica, duración, intensidad, RPE, sparring (y rondas), habilidades y observaciones. **No se asume intensidad**: hay que indicar intensidad o RPE, y el sparring realizado es una opción explícita.
- **Recuperación activa**: sesión guiada de movilidad (RPE 2) que cuenta como carga baja.
- **Motor de carga y recuperación** (carga interna = duración × RPE de gimnasio, combate y movilidad en un único total): recorta series y carga con recuperación baja o carga semanal muy alta, modera el tren inferior antes y después de combate exigente, omite accesorios cuando un músculo ya acumula mucho volumen semanal, bloquea subidas de peso injustificadas y detecta días duros seguidos.
- **Semana de descarga** configurable (cada 4-6 semanas): se **sugiere** solo si la recuperación, la carga o el estancamiento lo justifican; nunca se impone y se puede posponer o iniciar a voluntad.

## Importación desde ChatGPT (independiente por sección)

- **Gym → Rutinas → Importar:** solo rutinas de musculación y ejercicios de fuerza personalizados.
- **Combat → Resumen → Importar:** solo sesiones/planificación de combate.
- **Perfil → Importar planificación híbrida:** un único JSON con rutina, semana, combate y atleta; cada parte se entrega a su módulo.

Cada importador ignora (con aviso) lo que pertenece a otra sección. Antes de guardar, la app comprueba conflictos de horarios, volumen y recuperación; si la semana propuesta rompe las reglas, ofrece importar el resto sin la semana. Los ejercicios personalizados aparecen en la biblioteca con animación.

## Arquitectura

```
src/
  modules/
    gym/         types · data (ejercicios, animaciones) · services (workout, progression, gymImport) · components · screens · routes
    combat/      types · data (biblioteca por disciplina, animaciones) · services (combat, combatLibrary, combatImport) · store (vídeos) · components · screens · routes
    philosophy/  types · data (frases, filósofos, reflexiones, pilares) · services (philosophy) · store (diario, favoritos) · screens · routes
    progress/ home/ profile/   pantallas de resumen (orquestan, no poseen datos)
  shared/        perfil, recuperación, carga global, planificación, motor de ajuste, UI y utilidades comunes
```

- **Cada sección es dueña de sus modelos, servicios, rutas y componentes.** Un test automático (`tests/architecture.test.ts`) impide que Gym, Combat y Filosofía se importen entre sí y limita a cuatro archivos documentados lo que `shared` puede tomar de ellas.
- **Servicios compartidos** (`shared/services`): `profileService`, `recoveryService` (recuperación percibida, semana de descarga), `fatigueService` (carga interna = duración × RPE de todas las disciplinas), `planningService` (semana derivada y reglas de recuperación), `adjustmentService` (motor global que combina recuperación, carga y proximidad de combate), `principlesService` (única fuente de umbrales) e `hybridImportService`.
- **Sin duplicar datos:** la semana **no se guarda**, se deriva de tres fuentes independientes: los días de cada rutina de Gym, las sesiones de Combat y los días de descanso del perfil. Cada sección edita solo lo suyo y todo cambio se valida contra las reglas globales de recuperación.
- **Datos propios:** gimnasio en `sessions`, combate/recuperación en `activities`, diario y favoritos en sus propios almacenes de IndexedDB. Los módulos con datos propios se enganchan a la copia de seguridad mediante un registro, sin que el store raíz conozca su modelo.

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

`rest` en segundos · `weekdays` opcional (0 = lunes … 6 = domingo, o nombres). El texto libre también vale: `Press banca 4x6-8 descanso 150s peso 60kg`. Para semanas híbridas añade `week`, `mma`, `customExercises` y `athlete` (la app incluye el prompt y un ejemplo completo).

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
