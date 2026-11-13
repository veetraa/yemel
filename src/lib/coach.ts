import type { Activity, Profile, RoutineDay, Session, Wellness } from '../types'
import { dateKey } from './profile'
import { estimateMinutes } from './plan'
import { sessionDuration } from './stats'
import { WEEKDAYS, weekdayIndex } from './utils'

const DAY = 86400000
/** Esfuerzo asumido para sesiones de gimnasio sin RPE indicado */
export const DEFAULT_RPE = 6

export interface Ctx {
  profile: Profile
  sessions: Session[]
  activities: Activity[]
  wellness: Wellness[]
  now?: Date
}

// ───────── Recuperación ─────────
export interface Readiness {
  level: 'unknown' | 'good' | 'moderate' | 'low'
  score?: number
  reasons: string[]
  entry?: Wellness
}

const r1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

/** Usa el registro más reciente de hoy o ayer. Son sensaciones del usuario, no un diagnóstico. */
export function readiness(wellness: Wellness[], now = new Date()): Readiness {
  const keys = [dateKey(now), dateKey(new Date(now.getTime() - DAY))]
  const entry = keys.map((k) => wellness.find((w) => w.id === k)).find(Boolean)
  if (!entry) return { level: 'unknown', reasons: [] }
  const comps: { v: number; reason?: string }[] = []
  const add = (v: number | undefined, f: (v: number) => number, bad?: (v: number) => string | undefined) => {
    if (typeof v === 'number') comps.push({ v: f(v), reason: bad?.(v) })
  }
  add(entry.sleepHours, (h) => (h - 5) / 3, (h) => (h < 6.5 ? `Dormiste ${r1(h)} h` : undefined))
  add(entry.sleepQuality, (q) => (q - 1) / 4, (q) => (q <= 2 ? `Descanso de baja calidad (${q}/5)` : undefined))
  add(entry.energy, (e) => (e - 1) / 4, (e) => (e <= 2 ? `Energía baja (${e}/5)` : undefined))
  add(entry.fatigue, (f) => 1 - (f - 1) / 4, (f) => (f >= 4 ? `Fatiga muscular alta (${f}/5)` : undefined))
  add(entry.soreness, (s) => 1 - (s - 1) / 4, (s) => (s >= 4 ? `Dolor muscular alto (${s}/5)` : undefined))
  add(entry.recovery, (r) => (r - 1) / 4, (r) => (r <= 2 ? `Recuperación percibida baja (${r}/5)` : undefined))
  if (comps.length < 2) return { level: 'unknown', reasons: [], entry }
  const score = comps.reduce((a, c) => a + Math.min(1, Math.max(0, c.v)), 0) / comps.length
  const level = score >= 0.65 ? 'good' : score >= 0.4 ? 'moderate' : 'low'
  return { level, score, reasons: comps.map((c) => c.reason).filter((x): x is string => !!x), entry }
}

// ───────── Carga semanal ─────────
export const sessionLoad = (s: Session) => (sessionDuration(s) / 60000) * (s.rpe ?? DEFAULT_RPE)
export const activityLoad = (a: Activity) => a.minutes * a.rpe

export function loadBetween(sessions: Session[], activities: Activity[], from: number, to: number) {
  const gym = sessions.filter((s) => s.endedAt >= from && s.endedAt < to).reduce((a, s) => a + sessionLoad(s), 0)
  const other = activities.filter((x) => x.ts >= from && x.ts < to).reduce((a, x) => a + activityLoad(x), 0)
  return { gym, other, total: gym + other }
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

/** Últimos 7 días frente a la media de las 3 semanas anteriores (necesita historial previo) */
export function loadStatus(sessions: Session[], activities: Activity[], now = new Date()): LoadStatus {
  const t = now.getTime()
  const acute = loadBetween(sessions, activities, t - 7 * DAY, t + 1).total
  const prev = [1, 2, 3].map((i) => loadBetween(sessions, activities, t - (i + 1) * 7 * DAY, t - i * 7 * DAY).total)
  const active = prev.filter((x) => x > 0).length
  const chronic = prev.reduce((a, b) => a + b, 0) / 3
  if (active < 2 || chronic <= 0) return { level: 'unknown', acute, chronic }
  const ratio = acute / chronic
  const level = ratio > 1.5 ? 'high' : ratio > 1.3 ? 'elevated' : ratio < 0.6 ? 'low' : 'ok'
  return { level, ratio, acute, chronic }
}

// ───────── Ajuste de entrenamiento ─────────
export interface Adjustment {
  active: boolean
  weightFactor: number
  setDelta: number
  muscleSetDelta: Record<string, number>
  notes: string[]
}

export function planAdjustment(ctx: Ctx): Adjustment {
  const now = ctx.now ?? new Date()
  const r = readiness(ctx.wellness, now)
  const l = loadStatus(ctx.sessions, ctx.activities, now)
  let weightFactor = 1
  let setDelta = 0
  const notes: string[] = []
  const muscleSetDelta: Record<string, number> = {}

  if (r.level === 'low') {
    weightFactor = 0.92; setDelta = -1
    notes.push(`Recuperación baja${r.reasons.length ? ` (${r.reasons.slice(0, 2).join(', ').toLowerCase()})` : ''}: −1 serie por ejercicio y ≈−8 % de carga.`)
  } else if (l.level === 'high') {
    weightFactor = 0.95; setDelta = -1
    notes.push(`Carga de los últimos 7 días muy superior a tu media (×${r1(l.ratio ?? 0)}): −1 serie y ≈−5 % de carga.`)
  } else if (r.level === 'moderate' && l.level === 'elevated') {
    weightFactor = 0.95
    notes.push('Recuperación media con carga semanal elevada: ≈−5 % de carga.')
  }
  const sore = r.entry && (r.entry.soreness ?? 0) >= 3 ? r.entry.soreAreas ?? [] : []
  for (const m of sore) muscleSetDelta[m] = -1
  if (sore.length) notes.push(`Dolor muscular en ${sore.join(', ')}: −1 serie en esos grupos.`)

  const t = now.getTime()
  const hard = ctx.activities.find((a) => a.rpe >= 7 && t - a.ts <= 36 * 3600000 && a.ts <= t)
  if (hard) notes.push(`${hard.sport} intenso reciente (RPE ${hard.rpe}): tenlo en cuenta al elegir cargas.`)

  const active = weightFactor < 1 || setDelta < 0 || Object.keys(muscleSetDelta).length > 0
  return { active, weightFactor, setDelta, muscleSetDelta, notes }
}

export function adjustedSets(sets: number, muscle: string, adj: Adjustment): number {
  if (!adj.active || sets <= 2) return sets
  return Math.max(2, sets + adj.setDelta + (adj.muscleSetDelta[muscle] ?? 0))
}

// ───────── Tiempo disponible ─────────
/** Recorta series (hasta 2 por ejercicio) y luego ejercicios finales hasta caber en el tiempo */
export function fitToTime(day: RoutineDay, minutes: number): { day: RoutineDay; removedSets: number; removedExercises: number } {
  const d: RoutineDay = { ...day, exercises: day.exercises.map((e) => ({ ...e })) }
  let removedSets = 0
  let removedExercises = 0
  let guard = 200
  while (estimateMinutes(d) > minutes && guard-- > 0) {
    const cand = [...d.exercises].reverse().find((e) => e.sets > 2)
    if (cand) { cand.sets--; removedSets++; continue }
    if (d.exercises.length > 1) { d.exercises.pop(); removedExercises++; continue }
    break
  }
  return { day: d, removedSets, removedExercises }
}

// ───────── Consejos ─────────
export function scheduleNotes(profile: Profile, days: RoutineDay[]): string[] {
  const out: string[] = []
  const scheduled = days.filter((d) => d.weekdays.length)
  for (const d of scheduled) {
    const clash = d.weekdays.filter((w) => profile.bjjDays.includes(w))
    if (clash.length) out.push(`«${d.name}» cae en ${clash.map((w) => WEEKDAYS[w].toLowerCase()).join(' y ')}, día de Jiu-Jitsu.`)
    const off = profile.availableDays.length ? d.weekdays.filter((w) => !profile.availableDays.includes(w)) : []
    if (off.length) out.push(`«${d.name}» cae en ${off.map((w) => WEEKDAYS[w].toLowerCase()).join(' y ')}, fuera de tus días disponibles.`)
  }
  if (profile.availableDays.length && profile.weeklyGoal > profile.availableDays.length)
    out.push(`Tu objetivo semanal (${profile.weeklyGoal}) supera tus días disponibles (${profile.availableDays.length}).`)
  return out
}
