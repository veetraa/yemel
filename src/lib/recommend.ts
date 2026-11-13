import { exerciseById, matchExercise } from '../data/exercises'
import type { ExerciseLog, Session, Settings } from '../types'
import { normalize, parseRepRange } from './utils'

export interface Recommendation {
  weight: number | null
  reps?: number
  reason: string
  kind: 'progress' | 'repeat' | 'deload' | 'plan' | 'estimate' | 'none'
}

interface Target {
  exerciseId?: string
  name: string
  targetReps: string
  recommendedWeight?: number
}

const sameExercise = (l: ExerciseLog, t: Target) =>
  (!!t.exerciseId && l.exerciseId === t.exerciseId) || normalize(l.name) === normalize(t.name)

export const epley = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30))
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

export function recommendWeight(t: Target, sessions: Session[], settings: Settings): Recommendation {
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

  if (lib?.ratio && settings.bodyWeight) {
    const mult = settings.experience === 'beginner' ? 0.6 : settings.experience === 'advanced' ? 1.3 : 1
    const w = roundTo(lib.ratio * settings.bodyWeight * mult, lib.step >= 2.5 ? 2.5 : 1)
    if (w > 0) return { weight: w, kind: 'estimate', reason: `Estimación según tu peso (${settings.bodyWeight} kg) y nivel. Empieza ligero y ajusta.` }
  }
  if (lib && lib.step === 0) return { weight: 0, kind: 'none', reason: 'Ejercicio con peso corporal.' }
  return { weight: null, kind: 'none', reason: `Sin datos aún: elige un peso con el que puedas hacer las reps con 2 en reserva.${settings.bodyWeight ? '' : ' Añade tu peso corporal en Perfil para obtener estimaciones.'}` }
}
