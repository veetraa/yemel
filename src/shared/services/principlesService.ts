/**
 * philosophyService — la "filosofía" del entrenador híbrido.
 * Es la ÚNICA fuente de umbrales y principios: el resto de servicios importan
 * de aquí en vez de repetir números, y la interfaz explica cada decisión con ellos.
 */

export const T = {
  /** RPE a partir del cual una sesión cuenta como dura */
  HARD_RPE: 7,
  /** RPE de gimnasio a partir del cual el día cuenta como duro */
  HARD_GYM_RPE: 8,
  /** Esfuerzo asumido cuando no se registra (se indica siempre en la interfaz) */
  DEFAULT_GYM_RPE: 6,
  DEFAULT_COMBAT_RPE: 5,
  /** Ventana en horas en la que una sesión dura de combate condiciona las piernas */
  RECENT_HARD_HOURS: 36,
  /** Ratio carga 7 días / media 3 semanas previas */
  ACWR_ELEVATED: 1.3,
  ACWR_HIGH: 1.5,
  ACWR_LOW: 0.6,
  /** Máximo de series efectivas por grupo muscular y semana antes de recortar accesorios */
  WEEKLY_SET_CAP: 16,
  MAX_CONSECUTIVE_TRAINING_DAYS: 3,
  MIN_RECOVERY_DAYS: 2,
  MIN_FULL_REST_DAYS: 1,
  LOW_READINESS_LOAD: 0.92,
  HIGH_LOAD_LOAD: 0.95,
  MODERATE_LOAD: 0.95,
  COMBAT_PROXIMITY_LOAD: 0.95,
  DELOAD_WEEKS_DEFAULT: 5,
  DELOAD_WEEKS_MIN: 4,
  DELOAD_WEEKS_MAX: 6,
  DELOAD_SET_SCALE: 0.6,
  DELOAD_LOAD: 0.9,
  DELOAD_DAYS: 7,
  DELOAD_SNOOZE_DAYS: 7,
  /** Semanas sin récords con sesiones suficientes para considerar estancamiento */
  STALL_WEEKS: 3,
  STALL_MIN_SESSIONS: 6,
  BEGINNER_REPS_SHIFT: 2,
  BEGINNER_SET_SCALE: 0.85,
} as const

export const LOWER_BODY = ['Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos'] as const
export const isLowerBody = (muscle: string) => (LOWER_BODY as readonly string[]).includes(muscle)

export interface Principle { id: string; title: string; text: string }

export const PRINCIPLES: Principle[] = [
  { id: 'recovery-governs', title: 'La recuperación gobierna la carga', text: 'Si duermes poco, estás fatigado o la carga de los últimos 7 días se dispara, se recortan series y peso antes de pedirte más.' },
  { id: 'combat-first', title: 'El combate manda sobre las piernas', text: 'Las piernas cansadas empeoran el sparring y aumentan el riesgo. Antes o justo después de combate exigente, el tren inferior baja de volumen y no sube de peso.' },
  { id: 'one-system', title: 'Un solo sistema, no disciplinas aisladas', text: 'Gimnasio, combate y movilidad suman a la misma carga interna (duración × RPE). Nada se evalúa por separado.' },
  { id: 'earn-progress', title: 'El peso sube cuando se gana', text: 'Solo se propone más peso si completaste el rango en todas las series y tu recuperación y carga lo permiten.' },
  { id: 'minimum-effective', title: 'Volumen mínimo efectivo', text: 'Más series no es mejor: si un músculo ya acumula mucho volumen semanal, se omiten series accesorias.' },
  { id: 'no-hard-streaks', title: 'No todos los días son duros', text: 'Dos días duros seguidos se evitan, y tres días de entrenamiento seguidos no se permiten. Hay siempre recuperación activa y descanso completo.' },
  { id: 'deload-offered', title: 'La descarga se ofrece, no se impone', text: 'Cada 4-6 semanas (configurable) se sugiere una semana ligera solo si tu recuperación, carga o estancamiento lo justifican. Tú decides.' },
  { id: 'not-always-hard', title: 'No todo el combate es intenso', text: 'Una sesión técnica no es un sparring. Registra intensidad y RPE reales y el motor los usa tal cual.' },
  { id: 'you-decide', title: 'El entrenador propone, tú decides', text: 'No es un diagnóstico médico. Todo ajuste es visible y se puede desactivar o editar.' },
]

export type ReasonCode =
  | 'DELOAD' | 'LOW_READINESS' | 'HIGH_LOAD' | 'ELEVATED_LOAD' | 'SORENESS' | 'COMBAT_TOMORROW'
  | 'COMBAT_RECENT' | 'VOLUME_CAP' | 'HARD_STREAK' | 'BEGINNER'

/** Principio que justifica cada tipo de decisión */
export const RATIONALE: Record<ReasonCode, string> = {
  DELOAD: 'deload-offered',
  LOW_READINESS: 'recovery-governs',
  HIGH_LOAD: 'recovery-governs',
  ELEVATED_LOAD: 'recovery-governs',
  SORENESS: 'recovery-governs',
  COMBAT_TOMORROW: 'combat-first',
  COMBAT_RECENT: 'combat-first',
  VOLUME_CAP: 'minimum-effective',
  HARD_STREAK: 'no-hard-streaks',
  BEGINNER: 'earn-progress',
}

export const principleFor = (code: ReasonCode): Principle => PRINCIPLES.find((p) => p.id === RATIONALE[code])!
