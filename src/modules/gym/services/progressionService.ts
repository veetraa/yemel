import { exerciseById, matchExercise } from '../data/exercises'
import { epley, normalize, parseRepRange } from '../../../shared/lib/utils'

import type { EngineCtx, Experience, ExerciseLog, Routine, RoutineExercise, Session } from '../../../types'
import { setsByMuscleWindow } from '../../../shared/services/fatigueService'
import { T, isLowerBody } from '../../../shared/services/principlesService'
import type { Adjustment } from '../../../shared/services/adjustmentService'

export interface Recommendation {
  weight: number | null
  reps?: number
  reason: string
  kind: 'progress' | 'repeat' | 'deload' | 'plan' | 'estimate' | 'none'
}

/** Datos del perfil que influyen en la recomendación */
export interface UserCtx {
  bodyWeight?: number
  experience?: Experience
  /** Recuperación baja o carga alta: no subir de peso aunque se haya completado el rango */
  holdProgress?: boolean
}

interface Target {
  exerciseId?: string
  name: string
  targetReps: string
  recommendedWeight?: number
}

const sameExercise = (l: ExerciseLog, t: Target) =>
  (!!t.exerciseId && l.exerciseId === t.exerciseId) || normalize(l.name) === normalize(t.name)

export { epley }
export const roundTo = (v: number, step: number) => (step > 0 ? Math.round(v / step) * step : v)

/** Últimas apariciones del ejercicio (más reciente primero) con al menos una serie hecha */
export function history(sessions: Session[], t: Target, limit = 3): { session: Session; log: ExerciseLog }[] {
  const out: { session: Session; log: ExerciseLog }[] = []
  for (const s of [...sessions].sort((a, b) => b.endedAt - a.endedAt)) {
    const log = s.exercises.find((l) => sameExercise(l, t) && l.sets.some((x) => x.done && x.reps > 0))
    if (log) out.push({ session: s, log })
    if (out.length >= limit) break
  }
  return out
}

export function recommendWeight(t: Target, sessions: Session[], user: UserCtx): Recommendation {
  const lib = exerciseById(t.exerciseId) ?? matchExercise(t.name)
  const step = lib?.step ?? 2.5
  const range = parseRepRange(t.targetReps)
  const hist = history(sessions, t)

  if (hist.length) {
    const evalLog = (log: ExerciseLog) => {
      const done = log.sets.filter((s) => s.done && s.reps > 0)
      const top = Math.max(...done.map((s) => s.weight))
      const atTop = done.filter((s) => s.weight === top)
      return { top, atTop, done }
    }
    const last = evalLog(hist[0].log)
    if (last.top === 0 && lib && step === 0) {
      const best = Math.max(...last.done.map((s) => s.reps))
      return { weight: 0, reps: best + 1, kind: 'progress', reason: `Peso corporal: intenta ${best + 1} reps en tu mejor serie.` }
    }
    if (range) {
      const allTop = last.atTop.every((s) => s.reps >= range.max)
      if (allTop && last.atTop.length >= Math.min(last.done.length, 2)) {
        if (user.holdProgress) return { weight: last.top, reps: range.max, kind: 'repeat', reason: `Habrías subido de peso, pero tu recuperación o carga reciente aconsejan mantener ${last.top} kg hoy.` }
        const next = roundTo(last.top + step, 0.5)
        return { weight: next, reps: range.min, kind: 'progress', reason: `Llegaste a ${range.max} reps con ${last.top} kg: sube a ${next} kg.` }
      }
      const below = last.atTop.filter((s) => s.reps < range.min).length
      if (below >= 2 && hist.length >= 2) {
        const prev = evalLog(hist[1].log)
        const prevBelow = prev.atTop.filter((s) => s.reps < range.min).length >= 2
        if (prevBelow && prev.top >= last.top) {
          const d = roundTo(last.top * 0.9, 0.5)
          return { weight: d, reps: range.max, kind: 'deload', reason: `Dos sesiones sin alcanzar ${range.min} reps: baja a ${d} kg y reconstruye.` }
        }
      }
      const minReps = Math.min(...last.atTop.map((s) => s.reps))
      return { weight: last.top, reps: Math.min(range.max, minReps + 1), kind: 'repeat', reason: `Repite ${last.top} kg e intenta ${Math.min(range.max, minReps + 1)}+ reps por serie.` }
    }
    return { weight: last.top, kind: 'repeat', reason: `Última vez: ${last.top} kg.` }
  }

  if (t.recommendedWeight !== undefined && t.recommendedWeight > 0)
    return { weight: t.recommendedWeight, kind: 'plan', reason: 'Peso sugerido por tu rutina. Ajústalo según cómo vaya la primera serie.' }

  if (lib?.ratio && user.bodyWeight) {
    const mult = user.experience === 'beginner' ? 0.6 : user.experience === 'advanced' ? 1.3 : 1
    const w = roundTo(lib.ratio * user.bodyWeight * mult, lib.step >= 2.5 ? 2.5 : 1)
    if (w > 0) return { weight: w, kind: 'estimate', reason: `Estimación según tu peso actual (${user.bodyWeight} kg)${user.experience ? ' y tu nivel' : ''}. Empieza ligero y ajusta.` }
  }
  if (lib && lib.step === 0) return { weight: 0, kind: 'none', reason: 'Ejercicio con peso corporal.' }
  return { weight: null, kind: 'none', reason: `Sin datos aún: elige un peso con el que puedas hacer las reps con 2 en reserva.${user.bodyWeight ? '' : ' Añade tu peso corporal en Perfil para obtener estimaciones.'}` }
}

// ═════════════ Motor de ajuste del entrenamiento ═════════════

// ───────── Prescripción por ejercicio ─────────
export interface Prescription { sets: number; reps: string; weightFactor: number; hold: boolean }

const shiftReps = (reps: string, by: number) => {
  const m = reps.match(/^\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*$/)
  if (!m) return reps
  const a = parseInt(m[1], 10) + by
  return m[2] ? `${a}-${parseInt(m[2], 10) + by}` : String(a)
}

/** Series, repeticiones y carga finales a partir del plan, el nivel y el ajuste del día */
export function prescribe(e: Pick<RoutineExercise, 'sets' | 'reps' | 'muscle'>, adj: Adjustment | undefined, level?: Experience): Prescription {
  let sets = e.sets
  let reps = e.reps
  // Nivel: los principiantes trabajan con repeticiones algo más altas y menos series
  if (level === 'beginner') {
    if (sets >= 3) sets = Math.max(2, Math.round(sets * T.BEGINNER_SET_SCALE))
    reps = shiftReps(reps, T.BEGINNER_REPS_SHIFT)
  }
  if (!adj?.active) return { sets, reps, weightFactor: 1, hold: false }
  const lower = isLowerBody(e.muscle)
  if (adj.deload) return { sets: Math.max(1, Math.round(sets * T.DELOAD_SET_SCALE)), reps, weightFactor: adj.weightFactor, hold: true }
  if (sets > 2) {
    const delta = adj.setDelta + (lower ? adj.lowerSetDelta : 0) + (adj.muscleSetDelta[e.muscle] ?? 0)
    sets = Math.max(2, sets + delta)
  }
  return { sets, reps, weightFactor: adj.weightFactor * (lower ? adj.lowerWeightFactor : 1), hold: adj.holdAll || (lower && adj.holdLower) }
}

/** Series que sobran respecto al tope semanal por músculo (para omitir accesorios) */
export function volumeTrim(muscle: string, plannedToday: number, ctx: EngineCtx): number {
  const done = setsByMuscleWindow(ctx.sessions, 7, ctx.now)[muscle] ?? 0
  const over = done + plannedToday - T.WEEKLY_SET_CAP
  return over > 0 ? Math.min(over, Math.max(0, plannedToday - 2)) : 0
}

export type { Routine }
