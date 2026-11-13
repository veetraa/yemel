export type Unit = 'kg' | 'lb'

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

export interface Settings {
  unit: Unit
  sound: boolean
  vibrate: boolean
  /** Adapta cargas/series a la recuperación y la carga semanal */
  adaptToRecovery: boolean
  activeRoutineId?: string
}

export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type GoalKind = 'muscle' | 'strength' | 'endurance' | 'mobility' | 'fitness' | 'weight'
export type BodyMetric = 'weight' | 'waist' | 'chest' | 'arm' | 'thigh' | 'hip'

export interface Goal {
  id: string
  kind: GoalKind
  title: string
  /** Fuente del progreso: medida corporal, 1RM estimado de un ejercicio o valor manual */
  metric: BodyMetric | 'e1rm' | 'manual'
  exerciseId?: string
  unit: string
  start: number
  target: number
  /** Solo para metric = manual */
  current?: number
  createdAt: number
  deadline?: string
}

/** Único perfil de la aplicación (siempre local y privado) */
export interface Profile {
  name: string
  /** YYYY-MM-DD */
  birthDate?: string
  /** Edad introducida a mano; se ignora cuando hay fecha de nacimiento */
  ageManual?: number
  heightCm?: number
  weightKg?: number
  targetWeightKg?: number
  /** Foto de perfil (data URL, nunca sale del dispositivo) */
  photo?: string
  mainGoal?: string
  secondaryGoals: string[]
  experience?: Experience
  /** Meses entrenando */
  trainingMonths?: number
  sports: string[]
  weeklyGoal: number
  availableDays: number[]
  sessionMinutes?: number
  equipment: string[]
  /** Jiu-Jitsu */
  bjjDays: number[]
  bjjMinutes?: number
  goals: Goal[]
}

export interface BodyEntry {
  id: string
  ts: number
  weight?: number
  waist?: number
  chest?: number
  arm?: number
  thigh?: number
  hip?: number
  photo?: string
  note?: string
}

/** Registro voluntario de recuperación, uno por día (id = YYYY-MM-DD) */
export interface Wellness {
  id: string
  sleepHours?: number
  sleepQuality?: number
  energy?: number
  fatigue?: number
  soreness?: number
  recovery?: number
  soreAreas?: string[]
  note?: string
}

/** Actividad fuera de la app de gimnasio (Jiu-Jitsu, carrera…) */
export interface Activity {
  id: string
  ts: number
  sport: string
  minutes: number
  rpe: number
  note?: string
}

export interface BackupFile {
  app: 'forma'
  version: 1 | 2
  exportedAt: string
  settings: Settings
  profile?: Profile
  routines: Routine[]
  sessions: Session[]
  body?: BodyEntry[]
  wellness?: Wellness[]
  activities?: Activity[]
}
