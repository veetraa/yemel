// Modelos de datos del módulo GYM (musculación). No dependen de Combat ni de Filosofía.
export interface RoutineExercise {
  id: string
  /** Enlace a la biblioteca (si se reconoce el ejercicio) */
  exerciseId?: string
  name: string
  muscle: string
  sets: number
  /** Texto libre: "8-10", "12", "AMRAP", "30s" */
  reps: string
  /** Descanso en segundos */
  rest: number
  recommendedWeight?: number
  notes?: string
  /** Campos desconocidos del JSON original, preservados para no perder información */
  extra?: Record<string, unknown>
}

export interface RoutineDay {
  id: string
  name: string
  /** 0 = lunes … 6 = domingo */
  weekdays: number[]
  notes?: string
  exercises: RoutineExercise[]
  extra?: Record<string, unknown>
}

export interface Routine {
  id: string
  name: string
  goal?: string
  description?: string
  days: RoutineDay[]
  createdAt: number
  updatedAt: number
  extra?: Record<string, unknown>
}

export interface SetLog {
  weight: number
  reps: number
  done: boolean
}

export interface ExerciseLog {
  id: string
  exerciseId?: string
  name: string
  muscle: string
  targetReps: string
  rest: number
  notes?: string
  /** Peso sugerido por la rutina (kg), usado si no hay historial */
  plannedWeight?: number
  sets: SetLog[]
}

export interface Session {
  id: string
  routineId?: string
  routineName: string
  dayName: string
  startedAt: number
  endedAt: number
  exercises: ExerciseLog[]
  /** Esfuerzo percibido 1-10 (opcional) */
  rpe?: number
}

export interface ActiveWorkout {
  id: string
  routineId?: string
  routineName: string
  dayName: string
  startedAt: number
  exercises: ExerciseLog[]
  index: number
  /** Ajustes aplicados por el entrenador al iniciar */
  adjustNotes?: string[]
  /** Marca de tiempo (ms) en que termina el descanso en curso */
  restEnd?: number
  restTotal?: number
}
