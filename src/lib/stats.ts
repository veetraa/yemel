import type { ExerciseLog, Session } from '../types'
import { epley } from './recommend'
import { normalize, startOfDay, startOfWeek } from './utils'

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
