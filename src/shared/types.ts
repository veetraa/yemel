// Modelos compartidos: perfil, recuperación, indicadores globales y el registro genérico de carga.
import type { CombatDiscipline, CombatPlan } from '../modules/combat/types'
import type { Routine, Session } from '../modules/gym/types'

export type Unit = 'kg' | 'lb'


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
  /** Días de descanso completo (el resto de días libres son de recuperación activa) */
  restDays?: number[]
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
  sport?: string
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
  version: 1 | 2 | 3 | 4
  exportedAt: string
  settings: Settings
  profile?: Profile
  routines: Routine[]
  sessions: Session[]
  body?: BodyEntry[]
  wellness?: Wellness[]
  activities?: Activity[]
  /** Legado (v3): semana mezclada. Se convierte al importar. */
  plan?: WeekPlan
  combatPlan?: CombatPlan
  customExercises?: unknown[]
  journal?: unknown[]
  philoFavorites?: unknown
  /** Solo enlaces: los archivos de vídeo no se incluyen en la copia */
  combatVideos?: unknown[]
}
