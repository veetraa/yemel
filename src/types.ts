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
  /** Duración habitual de una sesión de combate (min) */
  combatMinutes?: number
  goals: Goal[]
  // ── Configuración de atleta híbrido ──
  athleteType?: string
  primaryDiscipline?: string
  /** Sesiones de combate/contacto por semana */
  contactSessionsPerWeek?: number
  /** Días de recuperación o descanso por semana */
  recoveryDaysPerWeek?: number
  /** La preparación física va integrada en las sesiones de gimnasio */
  conditioningIntegrated?: boolean
  /** Cada cuántas semanas se sugiere una descarga (4-6) */
  deloadEveryWeeks?: number
  /** Semana de descarga en curso */
  deload?: { startedAt: number; endsAt: number }
  lastDeloadEndedAt?: number
  /** La sugerencia de descarga no se muestra hasta esta fecha */
  deloadSnoozeUntil?: number
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

export type CombatDiscipline =
  | 'Striking' | 'Boxeo' | 'Kickboxing' | 'Wrestling' | 'Brazilian Jiu-Jitsu' | 'Grappling' | 'Transiciones' | 'Defensa y escapes'
export type Intensity = 'light' | 'moderate' | 'hard'

/**
 * Historial de entrenamiento fuera del gimnasio (combate, movilidad, otros).
 * Es la única fuente de verdad: las sesiones de gimnasio viven en `Session`.
 */
export interface Activity {
  id: string
  ts: number
  sport: string
  minutes: number
  rpe: number
  /** Observaciones personales */
  note?: string
  kind?: 'combat' | 'recovery' | 'other'
  disciplines?: CombatDiscipline[]
  techniques?: string[]
  intensity?: Intensity
  sparring?: boolean
  sparringRounds?: number
  skills?: string[]
}

// ── Planificación semanal ──
export type SlotType = 'gym' | 'combat' | 'recovery' | 'rest'
export interface CombatTemplate {
  disciplines: CombatDiscipline[]
  techniques?: string[]
  minutes?: number
  sparring?: boolean
}
export interface PlanSlot {
  /** 0 = lunes … 6 = domingo */
  day: number
  type: SlotType
  label: string
  focus?: string
  /** Gimnasio: día de la rutina enlazado */
  routineDayId?: string
  intensity?: Intensity
  combat?: CombatTemplate
}
export interface WeekPlan {
  name: string
  routineId?: string
  slots: PlanSlot[]
  updatedAt: number
}

/** Contexto que consumen los servicios de análisis */
export interface EngineCtx {
  profile: Profile
  sessions: Session[]
  activities: Activity[]
  wellness: Wellness[]
  plan?: WeekPlan
  routine?: Routine
  now?: Date
}

export interface BackupFile {
  app: 'forma'
  version: 1 | 2 | 3
  exportedAt: string
  settings: Settings
  profile?: Profile
  routines: Routine[]
  sessions: Session[]
  body?: BodyEntry[]
  wellness?: Wellness[]
  activities?: Activity[]
  plan?: WeekPlan
  customExercises?: unknown[]
}
