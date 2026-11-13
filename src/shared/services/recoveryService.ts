/**
 * recoveryService — estado de recuperación percibida, semana de descarga
 * (sugerida, nunca impuesta) y contenido de los días de recuperación activa.
 */
import type { EngineCtx, Profile, Wellness } from '../../types'
import { dateKey, epley, normalize } from '../lib/utils'
import { loadStatus } from './fatigueService'
import { T } from './principlesService'

const DAY = 86400000

// ───────── Recuperación percibida ─────────
export interface Readiness {
  level: 'unknown' | 'good' | 'moderate' | 'low'
  score?: number
  reasons: string[]
  entry?: Wellness
}

const r1 = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

function scoreOf(entry: Wellness): { score?: number; reasons: string[] } {
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
  if (comps.length < 2) return { reasons: [] }
  return { score: comps.reduce((a, c) => a + Math.min(1, Math.max(0, c.v)), 0) / comps.length, reasons: comps.map((c) => c.reason).filter((x): x is string => !!x) }
}

/** Usa el registro más reciente de hoy o ayer. Son sensaciones del usuario, no un diagnóstico. */
export function readiness(wellness: Wellness[], now = new Date()): Readiness {
  const keys = [dateKey(now), dateKey(new Date(now.getTime() - DAY))]
  const entry = keys.map((k) => wellness.find((w) => w.id === k)).find(Boolean)
  if (!entry) return { level: 'unknown', reasons: [] }
  const { score, reasons } = scoreOf(entry)
  if (score === undefined) return { level: 'unknown', reasons: [], entry }
  return { level: score >= 0.65 ? 'good' : score >= 0.4 ? 'moderate' : 'low', score, reasons, entry }
}

/** Media de la última semana de registros (para decidir una descarga) */
export function readinessTrend(wellness: Wellness[], now = new Date(), days = 7): { avg?: number; entries: number } {
  const since = dateKey(new Date(now.getTime() - days * DAY))
  const scores = wellness.filter((w) => w.id >= since && w.id <= dateKey(now)).map((w) => scoreOf(w).score).filter((x): x is number => x !== undefined)
  return { avg: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined, entries: scores.length }
}

// ───────── Semana de descarga ─────────
export type DeloadState = 'active' | 'suggested' | 'due-fine' | 'snoozed' | 'not-due'
export interface DeloadStatus {
  state: DeloadState
  weeksSince?: number
  every: number
  /** Motivos que justifican la descarga (vacío si solo "toca" por calendario) */
  reasons: string[]
  endsAt?: number
}

export const deloadEvery = (p: Profile) =>
  Math.min(T.DELOAD_WEEKS_MAX, Math.max(T.DELOAD_WEEKS_MIN, p.deloadEveryWeeks ?? T.DELOAD_WEEKS_DEFAULT))

export const isDeloadActive = (p: Profile, now = new Date()) => !!p.deload && now.getTime() < p.deload.endsAt

/** ¿Sin progreso reciente? Compara el mejor 1RM estimado de las últimas semanas con el anterior */
function stalled(ctx: EngineCtx, now: Date): boolean {
  const cut = now.getTime() - T.STALL_WEEKS * 7 * DAY
  const recent = ctx.sessions.filter((s) => s.endedAt >= cut)
  if (recent.length < T.STALL_MIN_SESSIONS) return false
  const best = (list: typeof ctx.sessions) => {
    const m = new Map<string, number>()
    for (const s of list) for (const e of s.exercises) for (const x of e.sets) {
      if (!x.done || x.weight <= 0) continue
      const k = e.exerciseId ?? normalize(e.name)
      m.set(k, Math.max(m.get(k) ?? 0, epley(x.weight, x.reps)))
    }
    return m
  }
  const before = best(ctx.sessions.filter((s) => s.endedAt < cut))
  const now_ = best(recent)
  let compared = 0
  for (const [k, v] of now_) {
    const b = before.get(k)
    if (b === undefined) continue
    compared++
    if (v > b * 1.005) return false
  }
  return compared > 0
}

export function deloadStatus(ctx: EngineCtx): DeloadStatus {
  const now = ctx.now ?? new Date()
  const p = ctx.profile
  const every = deloadEvery(p)
  if (isDeloadActive(p, now)) return { state: 'active', every, reasons: [], endsAt: p.deload!.endsAt }

  // Referencia: fin de la última descarga o inicio del historial
  const ends = Math.max(p.lastDeloadEndedAt ?? 0, p.deload?.endsAt ?? 0)
  const first = Math.min(...[...ctx.sessions.map((s) => s.endedAt), ...ctx.activities.map((a) => a.ts)], Infinity)
  const ref = ends || (Number.isFinite(first) ? first : undefined)
  if (!ref) return { state: 'not-due', every, reasons: [] }
  const weeksSince = Math.floor((now.getTime() - ref) / (7 * DAY))
  if (weeksSince < every) return { state: 'not-due', every, weeksSince, reasons: [] }

  const reasons: string[] = []
  const tr = readinessTrend(ctx.wellness, now)
  if (tr.avg !== undefined && tr.entries >= 3 && tr.avg < 0.5) reasons.push('Tu recuperación percibida de la última semana es baja')
  const l = loadStatus(ctx.sessions, ctx.activities, now)
  if (l.level === 'elevated' || l.level === 'high') reasons.push('Tu carga semanal está por encima de tu media reciente')
  if (stalled(ctx, now)) reasons.push(`Sin mejoras de fuerza en las últimas ${T.STALL_WEEKS} semanas`)

  if (p.deloadSnoozeUntil && now.getTime() < p.deloadSnoozeUntil) return { state: 'snoozed', every, weeksSince, reasons }
  return { state: reasons.length ? 'suggested' : 'due-fine', every, weeksSince, reasons }
}

export const startDeload = (now = new Date()): Partial<Profile> => ({
  deload: { startedAt: now.getTime(), endsAt: now.getTime() + T.DELOAD_DAYS * DAY }, deloadSnoozeUntil: undefined,
})
export const endDeload = (now = new Date()): Partial<Profile> => ({ deload: undefined, lastDeloadEndedAt: now.getTime() })
export const snoozeDeload = (now = new Date()): Partial<Profile> => ({ deloadSnoozeUntil: now.getTime() + T.DELOAD_SNOOZE_DAYS * DAY })

// ───────── Recuperación activa ─────────
export interface Drill { name: string; detail: string; seconds: number }

export const MOBILITY_ROUTINE: Drill[] = [
  { name: 'Respiración diafragmática', detail: '5 respiraciones lentas tumbado, 4 s inspirando y 6 s soltando', seconds: 90 },
  { name: 'Gato-camello', detail: '10 repeticiones suaves de columna', seconds: 60 },
  { name: 'Círculos de cadera (90/90)', detail: '8 transiciones por lado, controlado', seconds: 120 },
  { name: 'Zancada baja con rotación torácica', detail: '6 por lado, rodilla trasera apoyada', seconds: 120 },
  { name: 'Apertura de hombros en pared', detail: '45 s por lado, sin dolor', seconds: 90 },
  { name: 'Movilidad de cuello y muñecas', detail: 'Círculos lentos, 10 por sentido', seconds: 90 },
  { name: 'Estiramiento de isquios y glúteo', detail: '45 s por lado', seconds: 180 },
  { name: 'Paseo suave', detail: '10-15 min a ritmo conversacional (opcional)', seconds: 600 },
]
export const MOBILITY_MINUTES = Math.round(MOBILITY_ROUTINE.reduce((a, d) => a + d.seconds, 0) / 60)
/** Esfuerzo asignado a una sesión de movilidad (muy suave) */
export const RECOVERY_RPE = 2
