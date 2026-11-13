import type { Routine, RoutineDay, Session, Settings } from '../types'
import { WEEKDAYS, startOfDay, weekdayIndex } from './utils'

export const estimateMinutes = (d: RoutineDay) =>
  Math.round(d.exercises.reduce((a, e) => a + e.sets * (40 + e.rest), 0) / 60)

export function activeRoutine(routines: Routine[], settings: Settings): Routine | undefined {
  return routines.find((r) => r.id === settings.activeRoutineId) ?? routines[0]
}

export interface Plan {
  routine?: Routine
  today?: RoutineDay
  todayDone: boolean
  /** true si no hay días asignados y se sugiere por rotación */
  rotation: boolean
  next?: { day: RoutineDay; label: string }
}

export function getPlan(routine: Routine | undefined, sessions: Session[], now = new Date()): Plan {
  if (!routine || !routine.days.length) return { routine, todayDone: false, rotation: false }
  const t0 = startOfDay(now.getTime())
  const doneToday = (d: RoutineDay) => sessions.some((s) => s.routineId === routine.id && s.dayName === d.name && s.endedAt >= t0)
  const scheduled = routine.days.some((d) => d.weekdays.length)
  const wd = weekdayIndex(now)

  if (scheduled) {
    const today = routine.days.find((d) => d.weekdays.includes(wd))
    let next: Plan['next']
    for (let off = today && !doneToday(today) ? 1 : 0; off <= 7 && !next; off++) {
      if (off === 0) continue
      const idx = (wd + off) % 7
      const day = routine.days.find((d) => d.weekdays.includes(idx))
      if (day && !(off === 7 && day === today)) next = { day, label: off === 1 ? 'Mañana' : WEEKDAYS[idx] }
    }
    return { routine, today, todayDone: today ? doneToday(today) : false, rotation: false, next }
  }

  const last = sessions.find((s) => s.routineId === routine.id)
  const lastIdx = last ? routine.days.findIndex((d) => d.name === last.dayName) : -1
  const idx = (lastIdx + 1) % routine.days.length
  const today = routine.days[idx]
  const next = routine.days.length > 1 ? { day: routine.days[(idx + 1) % routine.days.length], label: 'Después' } : undefined
  return { routine, today, todayDone: false, rotation: true, next }
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}
