import { exerciseById, matchExercise } from '../data/exercises'
import type { EngineCtx, ExerciseLog, Routine, RoutineDay, Session, Settings } from '../../../types'
import { epley, normalize, startOfDay, startOfWeek, uid } from '../../../shared/lib/utils'
import { setsByMuscleWindow } from '../../../shared/services/fatigueService'
import { T } from '../../../shared/services/principlesService'
import { prescribe, recommendWeight, roundTo } from './progressionService'
import type { Adjustment } from '../../../shared/services/adjustmentService'

export const doneSets = (e: ExerciseLog) => e.sets.filter((s) => s.done && s.reps > 0)
export const sessionVolume = (s: Session) =>
  s.exercises.reduce((a, e) => a + doneSets(e).reduce((b, x) => b + x.weight * x.reps, 0), 0)
export const sessionSets = (s: Session) => s.exercises.reduce((a, e) => a + doneSets(e).length, 0)
export const sessionDuration = (s: Session) => Math.max(0, s.endedAt - s.startedAt)

export interface WeekSummary {
  start: number
  sessions: Session[]
  daysTrained: boolean[]
  totalMs: number
  volume: number
  sets: number
}

export function weekSummary(sessions: Session[], weekStart = startOfWeek()): WeekSummary {
  const end = weekStart + 7 * 86400000
  const inWeek = sessions.filter((s) => s.endedAt >= weekStart && s.endedAt < end)
  const days = Array(7).fill(false) as boolean[]
  for (const s of inWeek) days[Math.min(6, Math.floor((startOfDay(s.endedAt) - weekStart) / 86400000 + 0.01))] = true
  return {
    start: weekStart, sessions: inWeek, daysTrained: days,
    totalMs: inWeek.reduce((a, s) => a + sessionDuration(s), 0),
    volume: inWeek.reduce((a, s) => a + sessionVolume(s), 0),
    sets: inWeek.reduce((a, s) => a + sessionSets(s), 0),
  }
}

export function weeklySeries(sessions: Session[], weeks = 8) {
  const cur = startOfWeek()
  return Array.from({ length: weeks }, (_, i) => {
    const start = cur - (weeks - 1 - i) * 7 * 86400000
    const w = weekSummary(sessions, start)
    return { start, volume: w.volume, count: w.sessions.length, ms: w.totalMs }
  })
}

export interface ExercisePoint { ts: number; e1rm: number; topWeight: number; reps: number }

export function exerciseSeries(sessions: Session[], name: string, id?: string): ExercisePoint[] {
  const n = normalize(name)
  const pts: ExercisePoint[] = []
  for (const s of [...sessions].sort((a, b) => a.endedAt - b.endedAt)) {
    const log = s.exercises.find((l) => (id && l.exerciseId === id) || normalize(l.name) === n)
    if (!log) continue
    const d = doneSets(log)
    if (!d.length) continue
    let best = d[0]
    for (const x of d) if (epley(x.weight, x.reps) > epley(best.weight, best.reps)) best = x
    pts.push({ ts: s.endedAt, e1rm: epley(best.weight, best.reps), topWeight: Math.max(...d.map((x) => x.weight)), reps: best.reps })
  }
  return pts
}

export interface PR { key: string; name: string; muscle: string; weight: number; reps: number; e1rm: number; ts: number }

export function personalRecords(sessions: Session[]): PR[] {
  const map = new Map<string, PR>()
  for (const s of sessions) for (const e of s.exercises) {
    const key = e.exerciseId ?? normalize(e.name)
    for (const x of doneSets(e)) {
      if (x.weight <= 0) continue
      const e1 = epley(x.weight, x.reps)
      const cur = map.get(key)
      if (!cur || e1 > cur.e1rm) map.set(key, { key, name: e.name, muscle: e.muscle, weight: x.weight, reps: x.reps, e1rm: e1, ts: s.endedAt })
    }
  }
  return [...map.values()].sort((a, b) => b.ts - a.ts)
}

/** ¿La serie (peso×reps) supera el mejor e1RM previo de ese ejercicio? */
export function isPR(sessions: Session[], key: { id?: string; name: string }, weight: number, reps: number): boolean {
  if (weight <= 0 || reps <= 0) return false
  const prev = exerciseSeries(sessions, key.name, key.id)
  if (!prev.length) return false
  return epley(weight, reps) > Math.max(...prev.map((p) => p.e1rm)) + 0.01
}

export function setsByMuscle(sessions: Session[], days = 30): { muscle: string; sets: number }[] {
  const since = Date.now() - days * 86400000
  const m = new Map<string, number>()
  for (const s of sessions) if (s.endedAt >= since) for (const e of s.exercises) m.set(e.muscle, (m.get(e.muscle) ?? 0) + doneSets(e).length)
  return [...m.entries()].map(([muscle, sets]) => ({ muscle, sets })).filter((x) => x.sets > 0).sort((a, b) => b.sets - a.sets)
}

export function streakWeeks(sessions: Session[], goal: number): number {
  let n = 0
  let start = startOfWeek()
  const cur = weekSummary(sessions, start)
  if (cur.sessions.length < goal) start -= 7 * 86400000
  while (weekSummary(sessions, start).sessions.length >= Math.max(1, goal)) {
    n++
    start -= 7 * 86400000
    if (n > 520) break
  }
  return n
}

// ═════════════ Construcción de entrenamientos ═════════════

export const estimateMinutes = (d: RoutineDay) =>
  Math.round(d.exercises.reduce((a, e) => a + e.sets * (40 + e.rest), 0) / 60)

export const activeRoutine = (routines: Routine[], settings: Settings): Routine | undefined =>
  routines.find((r) => r.id === settings.activeRoutineId) ?? routines[0]

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

export interface BuiltWorkout { logs: ExerciseLog[]; notes: string[] }

/**
 * Convierte un día de rutina en el entrenamiento de hoy: aplica nivel, ajuste por
 * recuperación/combate/descarga, tope de volumen semanal y pesos recomendados.
 */
export function buildWorkout(day: RoutineDay | undefined, ctx: EngineCtx, adj?: Adjustment): BuiltWorkout {
  if (!day) return { logs: [], notes: [] }
  const notes: string[] = []
  const level = ctx.profile.experience
  const bodyWeight = ctx.profile.weightKg
  const rx = day.exercises.map((e) => ({ e, p: prescribe(e, adj, level) }))

  // Tope de volumen semanal por músculo: se omiten series de los últimos ejercicios (accesorios)
  if (!adj?.deload) {
    const done = setsByMuscleWindow(ctx.sessions, 7, ctx.now)
    const today: Record<string, number> = {}
    for (const { e, p } of rx) today[e.muscle] = (today[e.muscle] ?? 0) + p.sets
    for (const m of Object.keys(today)) {
      let over = (done[m] ?? 0) + today[m] - T.WEEKLY_SET_CAP
      if (over <= 0 || m === 'General') continue
      let cut = 0
      for (const x of [...rx].reverse()) {
        if (x.e.muscle !== m || over <= 0) continue
        const take = Math.min(over, Math.max(0, x.p.sets - 2))
        x.p.sets -= take; over -= take; cut += take
      }
      if (cut) notes.push(`${m}: ya acumulas mucho volumen esta semana, se omiten ${cut} series accesorias.`)
    }
  }
  if (level === 'beginner') notes.push('Nivel principiante: algo menos de series y repeticiones algo más altas.')

  const logs = rx.map(({ e, p }) => {
    const lib = exerciseById(e.exerciseId) ?? matchExercise(e.name)
    const rec = recommendWeight({ exerciseId: e.exerciseId ?? lib?.id, name: e.name, targetReps: p.reps, recommendedWeight: e.recommendedWeight }, ctx.sessions, { bodyWeight, experience: level, holdProgress: p.hold })
    const range = parseRange(p.reps)
    const reps = rec.reps ?? range ?? 0
    let weight = rec.weight ?? 0
    if (weight > 0 && p.weightFactor < 1 && rec.kind !== 'deload') weight = roundTo(weight * p.weightFactor, 0.5)
    return {
      id: uid(), exerciseId: e.exerciseId ?? lib?.id, name: e.name, muscle: e.muscle, targetReps: p.reps, rest: e.rest, notes: e.notes,
      plannedWeight: e.recommendedWeight, sets: Array.from({ length: p.sets }, () => ({ weight, reps, done: false })),
    } satisfies ExerciseLog
  })
  return { logs, notes }
}

function parseRange(reps: string): number | undefined {
  const m = reps.match(/^\s*(\d+)/)
  return m ? parseInt(m[1], 10) : undefined
}

// ═════════════ Rutina híbrida del propietario ═════════════

const X = (name: string, exerciseId: string | undefined, muscle: string, sets: number, reps: string, rest: number, notes?: string) =>
  ({ id: uid(), name, exerciseId, muscle, sets, reps, rest, notes })

/** Programación inicial editable: GYM A / B / C */
export function defaultHybridRoutine(): Routine {
  const now = Date.now()
  return {
    id: 'hybrid-default', name: 'Hybrid Athlete', goal: 'Balanced Hybrid Athlete', createdAt: now, updatedAt: now,
    description: 'Fuerza e hipertrofia al servicio del combate. Configuración inicial editable: el motor adapta series, repeticiones y cargas a tu nivel y recuperación.',
    days: [
      { id: 'hybrid-a', name: 'GYM A — Tren superior', weekdays: [0], notes: 'Tren superior, fuerza e hipertrofia', exercises: [
        X('Press banca', 'press-banca', 'Pecho', 3, '6-8', 150),
        X('Dominadas', 'dominadas', 'Espalda', 3, '6-10', 120, 'O jalón al pecho si aún no completas las repeticiones'),
        X('Remo con barra', 'remo-barra', 'Espalda', 3, '8-10', 120),
        X('Press inclinado con mancuernas', 'press-inclinado-mancuernas', 'Pecho', 2, '8-12', 90),
        X('Elevaciones laterales', 'elevaciones-laterales', 'Hombros', 2, '12-15', 60),
        X('Curl con mancuernas', 'curl-mancuernas', 'Bíceps', 2, '10-12', 60),
        X('Extensión de tríceps en polea', 'extension-triceps-polea', 'Tríceps', 2, '10-12', 60),
      ] },
      { id: 'hybrid-b', name: 'GYM B — Tren inferior', weekdays: [3], notes: 'Tren inferior, fuerza y desarrollo de potencia', exercises: [
        X('Sentadilla con barra', 'sentadilla', 'Cuádriceps', 3, '5-8', 180),
        X('Peso muerto rumano', 'peso-muerto-rumano', 'Isquiotibiales', 3, '8', 150),
        X('Zancadas', 'zancadas', 'Cuádriceps', 2, '8', 90, 'Por pierna'),
        X('Curl femoral tumbado', 'curl-femoral', 'Isquiotibiales', 2, '12', 75),
        X('Elevación de gemelos de pie', 'gemelos-pie', 'Gemelos', 2, '15', 60),
        X('Elevación de piernas colgado', 'elevacion-piernas', 'Core', 3, '10-12', 60, 'Core: sustituible por plancha o rueda'),
      ] },
      { id: 'hybrid-c', name: 'GYM C — Full body', weekdays: [5], notes: 'Full Body, fuerza complementaria, estabilidad y agarre', exercises: [
        X('Press inclinado con mancuernas', 'press-inclinado-mancuernas', 'Pecho', 3, '8', 120),
        X('Remo con apoyo', 'remo-apoyado', 'Espalda', 3, '10', 90),
        X('Step-ups', 'step-ups', 'Cuádriceps', 2, '8', 90, 'Por pierna'),
        X('Press landmine', 'press-landmine', 'Hombros', 2, '10', 90),
        X('Farmer walks', 'farmer-walk', 'Antebrazos', 3, '30-40 m', 90, '3 recorridos, agarre firme'),
        X('Pallof press', 'pallof-press', 'Core', 2, '12', 60, 'Por lado'),
      ] },
    ],
  }
}


// ═════════════ Historial de cargas ═════════════

export interface LoadSummary {
  key: string
  name: string
  exerciseId?: string
  muscle: string
  lastTs: number
  last: { weight: number; reps: number }
  best: { weight: number; reps: number; e1rm: number }
  count: number
}

export const loadKey = (e: { exerciseId?: string; name: string }) => e.exerciseId ?? normalize(e.name)

/** Resumen por ejercicio de lo levantado (último y mejor), ordenado por recencia */
export function loadSummaries(sessions: Session[]): LoadSummary[] {
  const map = new Map<string, LoadSummary>()
  for (const s of [...sessions].sort((a, b) => a.endedAt - b.endedAt)) {
    for (const e of s.exercises) {
      const sets = doneSets(e)
      if (!sets.length) continue
      const top = sets.reduce((a, b) => (b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a))
      const best = sets.reduce((a, b) => (epley(b.weight, b.reps) > epley(a.weight, a.reps) ? b : a))
      const key = loadKey(e)
      const cur = map.get(key)
      const bestE = epley(best.weight, best.reps)
      map.set(key, {
        key, name: e.name, exerciseId: e.exerciseId, muscle: e.muscle, lastTs: s.endedAt, last: { weight: top.weight, reps: top.reps }, count: (cur?.count ?? 0) + 1,
        best: cur && cur.best.e1rm >= bestE ? cur.best : { weight: best.weight, reps: best.reps, e1rm: bestE },
      })
    }
  }
  return [...map.values()].sort((a, b) => b.lastTs - a.lastTs)
}

export interface LoadEntry { ts: number; sessionId: string; dayName: string; sets: { weight: number; reps: number }[]; e1rm: number }

/** Todas las sesiones en las que aparece un ejercicio (más reciente primero) */
export function exerciseHistoryLog(sessions: Session[], key: string): LoadEntry[] {
  const out: LoadEntry[] = []
  for (const s of sessions) {
    const log = s.exercises.find((e) => loadKey(e) === key)
    if (!log) continue
    const sets = doneSets(log)
    if (!sets.length) continue
    out.push({ ts: s.endedAt, sessionId: s.id, dayName: s.dayName, sets: sets.map((x) => ({ weight: x.weight, reps: x.reps })), e1rm: Math.max(...sets.map((x) => epley(x.weight, x.reps))) })
  }
  return out.sort((a, b) => b.ts - a.ts)
}
