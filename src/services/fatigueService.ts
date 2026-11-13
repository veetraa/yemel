/**
 * fatigueService — carga interna de TODAS las disciplinas.
 * Carga = duración (min) × RPE. El gimnasio, el combate y la movilidad suman al mismo total.
 */
import type { Activity, ExerciseLog, Session } from '../types'
import { dateKey, startOfDay, weekdayIndex } from '../lib/utils'
import { isCombat, isDemanding } from './combatService'
import { T } from './philosophyService'

const DAY = 86400000

export const sessionMinutes = (s: Session) => Math.max(0, s.endedAt - s.startedAt) / 60000
/** Si la sesión de gimnasio no tiene RPE se asume un valor por defecto (la UI lo indica) */
export const sessionLoad = (s: Session) => sessionMinutes(s) * (s.rpe ?? T.DEFAULT_GYM_RPE)
export const activityLoad = (a: Activity) => a.minutes * a.rpe

export interface LoadBreakdown { gym: number; combat: number; other: number; total: number }

export function loadBetween(sessions: Session[], activities: Activity[], from: number, to: number): LoadBreakdown {
  const gym = sessions.filter((s) => s.endedAt >= from && s.endedAt < to).reduce((a, s) => a + sessionLoad(s), 0)
  const inRange = activities.filter((x) => x.ts >= from && x.ts < to)
  const combat = inRange.filter(isCombat).reduce((a, x) => a + activityLoad(x), 0)
  const other = inRange.filter((x) => !isCombat(x)).reduce((a, x) => a + activityLoad(x), 0)
  return { gym, combat, other, total: gym + combat + other }
}

export function weeklyLoads(sessions: Session[], activities: Activity[], weeks = 6, now = new Date()) {
  const d = new Date(now); d.setHours(0, 0, 0, 0)
  const cur = d.getTime() - weekdayIndex(d) * DAY
  return Array.from({ length: weeks }, (_, i) => {
    const start = cur - (weeks - 1 - i) * 7 * DAY
    return { start, ...loadBetween(sessions, activities, start, start + 7 * DAY) }
  })
}

export interface LoadStatus {
  level: 'unknown' | 'low' | 'ok' | 'elevated' | 'high'
  ratio?: number
  acute: number
  chronic: number
}

/** Últimos 7 días frente a la media de las 3 semanas anteriores (sin historial previo no opina) */
export function loadStatus(sessions: Session[], activities: Activity[], now = new Date()): LoadStatus {
  const t = now.getTime()
  const acute = loadBetween(sessions, activities, t - 7 * DAY, t + 1).total
  const prev = [1, 2, 3].map((i) => loadBetween(sessions, activities, t - (i + 1) * 7 * DAY, t - i * 7 * DAY).total)
  const active = prev.filter((x) => x > 0).length
  const chronic = prev.reduce((a, b) => a + b, 0) / 3
  if (active < 2 || chronic <= 0) return { level: 'unknown', acute, chronic }
  const ratio = acute / chronic
  const level = ratio > T.ACWR_HIGH ? 'high' : ratio > T.ACWR_ELEVATED ? 'elevated' : ratio < T.ACWR_LOW ? 'low' : 'ok'
  return { level, ratio, acute, chronic }
}

// ───────── Días duros ─────────
export const isHardGym = (s: Session) => (s.rpe ?? 0) >= T.HARD_GYM_RPE
export const isHardActivity = (a: Activity) => (a.kind === 'recovery' ? false : isDemanding(a))

/** Claves de fecha (YYYY-MM-DD) con al menos una sesión dura */
export function hardDayKeys(sessions: Session[], activities: Activity[]): Set<string> {
  const keys = new Set<string>()
  for (const s of sessions) if (isHardGym(s)) keys.add(dateKey(new Date(s.endedAt)))
  for (const a of activities) if (isHardActivity(a)) keys.add(dateKey(new Date(a.ts)))
  return keys
}

/** Días duros consecutivos que terminan ayer (o hoy si ya hubo una sesión dura) */
export function consecutiveHardDays(sessions: Session[], activities: Activity[], now = new Date()): number {
  const hard = hardDayKeys(sessions, activities)
  let n = 0
  let d = hard.has(dateKey(now)) ? startOfDay(now.getTime()) : startOfDay(now.getTime()) - DAY
  while (hard.has(dateKey(new Date(d)))) { n++; d -= DAY }
  return n
}

/** Última sesión de combate exigente dentro de la ventana (para moderar piernas) */
export function recentDemandingCombat(activities: Activity[], now = new Date(), hours = T.RECENT_HARD_HOURS): Activity | undefined {
  const t = now.getTime()
  return activities.find((a) => isCombat(a) && isDemanding(a) && a.ts <= t && t - a.ts <= hours * 3600000)
}

// ───────── Volumen ─────────
const doneSets = (e: ExerciseLog) => e.sets.filter((s) => s.done && s.reps > 0).length

/** Series completadas por grupo muscular en los últimos N días */
export function setsByMuscleWindow(sessions: Session[], days = 7, now = new Date()): Record<string, number> {
  const since = now.getTime() - days * DAY
  const out: Record<string, number> = {}
  for (const s of sessions) if (s.endedAt >= since) for (const e of s.exercises) out[e.muscle] = (out[e.muscle] ?? 0) + doneSets(e)
  return out
}
