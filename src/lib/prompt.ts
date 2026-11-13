import { EXERCISES } from '../data/exercises'

export const SCHEMA_EXAMPLE = `{
  "name": "Hipertrofia 4 días",
  "goal": "Muscle gain",
  "description": "Torso/pierna, 4 días por semana",
  "days": [
    {
      "name": "Día 1 - Tren superior",
      "weekdays": ["Lunes"],
      "exercises": [
        {
          "name": "Press banca",
          "muscle": "Pecho",
          "sets": 4,
          "reps": "8-10",
          "rest": 120,
          "recommendedWeight": 40,
          "notes": "Mantener control en la fase excéntrica"
        }
      ]
    }
  ]
}`

export function chatGptPrompt(): string {
  const names = EXERCISES.map((e) => e.name).join(', ')
  return `Actúa como entrenador personal experto en fuerza e hipertrofia. Crea una rutina de entrenamiento para mí y devuélvela ÚNICAMENTE como un bloque de código JSON válido (sin texto antes ni después), con exactamente este formato:

${SCHEMA_EXAMPLE}

Reglas del formato:
- "name": nombre de la rutina. "goal": objetivo (opcional).
- "days": lista de días de entrenamiento. Cada día tiene "name" y "exercises". "weekdays" es opcional (0 = lunes … 6 = domingo, o nombres en español).
- Cada ejercicio: "name" (texto), "muscle" (Pecho, Espalda, Hombros, Bíceps, Tríceps, Cuádriceps, Isquiotibiales, Glúteos, Gemelos, Core, Trapecio, Antebrazos), "sets" (número entero), "reps" (texto, por ejemplo "8-10" o "12"), "rest" (descanso en SEGUNDOS, número), "recommendedWeight" (kg, opcional) y "notes" (opcional).
- Usa preferiblemente estos nombres de ejercicio para que la app muestre su animación: ${names}.
- JSON estricto: comillas dobles, sin comentarios y sin comas finales.

Mis datos: [edad, peso, nivel de experiencia, días por semana, material disponible, objetivo, lesiones].`
}
