import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE, calcAge, currentWeight, goalProgress, migrateLegacy, ageOf } from '../src/services/profileService'
import { suggestWeekdays, scheduleNotes, buildDefaultPlan } from '../src/services/planningService'
import { prescribe } from '../src/services/progressionService'
import { fitToTime } from '../src/services/workoutService'
import { loadStatus } from '../src/services/fatigueService'
import { planAdjustment } from '../src/services/progressionService'
import { readiness } from '../src/services/recoveryService'
import { recommendWeight } from '../src/services/progressionService'
import type { Activity, BodyEntry, Goal, Profile, Session, Wellness } from '../src/types'

const DAY = 86400000
const now = new Date('2026-11-13T12:00:00')
const profile: Profile = { ...DEFAULT_PROFILE }

const sess = (daysAgo: number, minutes = 60, rpe?: number): Session => ({
  id: String(daysAgo) + minutes, routineName: 'r', dayName: 'd', exercises: [], rpe,
  startedAt: now.getTime() - daysAgo * DAY - minutes * 60000, endedAt: now.getTime() - daysAgo * DAY,
})

describe('perfil', () => {
  it('precarga 23 años, 171 cm, 60 kg y no inventa nada más', () => {
    expect(DEFAULT_PROFILE).toMatchObject({ ageManual: 23, heightCm: 171, weightKg: 60, athleteType: 'Balanced Hybrid Athlete', primaryDiscipline: 'MMA', weeklyGoal: 3, contactSessionsPerWeek: 2, recoveryDaysPerWeek: 2 })
    expect(DEFAULT_PROFILE.birthDate).toBeUndefined()
    expect(DEFAULT_PROFILE.targetWeightKg).toBeUndefined()
    expect(DEFAULT_PROFILE.goals).toEqual([])
    expect(ageOf(DEFAULT_PROFILE, now)).toBe(23)
  })
  it('calcula la edad desde la fecha de nacimiento', () => {
    expect(calcAge('2003-11-13', now)).toBe(23)
    expect(calcAge('2003-11-14', now)).toBe(22)
    expect(calcAge('basura', now)).toBeUndefined()
    expect(ageOf({ ...profile, birthDate: '2000-01-01' }, now)).toBe(26)
  })
  it('el peso actual sale de la última medición', () => {
    const body: BodyEntry[] = [{ id: 'a', ts: 1, weight: 61 }, { id: 'b', ts: 5, weight: 62.5 }, { id: 'c', ts: 9, waist: 80 }]
    expect(currentWeight(profile, body)).toBe(62.5)
    expect(currentWeight(profile, [])).toBe(60)
  })
  it('migra ajustes antiguos', () => {
    expect(migrateLegacy({ name: 'Yemel', bodyWeight: 64, weeklyGoal: 3, experience: 'advanced' })).toMatchObject({ name: 'Yemel', weightKg: 64, weeklyGoal: 3, experience: 'advanced' })
    expect(migrateLegacy(undefined).weightKg).toBe(60)
  })
  it('progreso de objetivos', () => {
    const g: Goal = { id: 'g', kind: 'weight', title: 'Subir a 65', metric: 'weight', unit: 'kg', start: 60, target: 65, createdAt: 0 }
    const body: BodyEntry[] = [{ id: 'a', ts: 1, weight: 62.5 }]
    expect(goalProgress(g, { profile, body, sessions: [] })).toMatchObject({ current: 62.5, pct: 0.5, done: false })
    const cut: Goal = { ...g, start: 85, target: 80, metric: 'waist' }
    expect(goalProgress(cut, { profile, body: [{ id: 'w', ts: 1, waist: 82 }], sessions: [] }).pct).toBeCloseTo(0.6)
    expect(goalProgress(cut, { profile, body: [], sessions: [] })).toEqual({ pct: 0, done: false })
    expect(goalProgress({ ...g, metric: 'manual', current: 70 }, { profile, body: [], sessions: [] }).done).toBe(true)
  })
  it('reparte días evitando Jiu-Jitsu', () => {
    const p = { ...profile, availableDays: [0, 1, 2, 3, 4] }
    expect(suggestWeekdays(3, p, [1, 3])).toEqual([0, 2, 4])
    expect(suggestWeekdays(4, p, [1, 3]).length).toBe(4)
  })
})

describe('entrenador', () => {
  const w = (o: Partial<Wellness>): Wellness => ({ id: '2026-11-13', ...o })
  it('sin registros no hay nivel ni ajustes', () => {
    expect(readiness([], now).level).toBe('unknown')
    expect(planAdjustment({ profile, sessions: [], activities: [], wellness: [], now }).active).toBe(false)
    expect(readiness([w({ energy: 1 })], now).level).toBe('unknown') // un solo dato no basta
  })
  it('clasifica la recuperación', () => {
    expect(readiness([w({ sleepHours: 8, energy: 5, fatigue: 1 })], now).level).toBe('good')
    const low = readiness([w({ sleepHours: 4.5, energy: 1, fatigue: 5, soreness: 4 })], now)
    expect(low.level).toBe('low')
    expect(low.reasons.join(' ')).toMatch(/Dormiste 4,5 h/)
  })
  it('usa el registro de ayer pero no el de hace tres días', () => {
    expect(readiness([{ id: '2026-11-12', sleepHours: 8, energy: 5 }], now).level).toBe('good')
    expect(readiness([{ id: '2026-11-10', sleepHours: 8, energy: 5 }], now).level).toBe('unknown')
  })
  it('recuperación baja reduce series y carga', () => {
    const adj = planAdjustment({ profile, sessions: [], activities: [], wellness: [w({ sleepHours: 4, energy: 1, fatigue: 5 })], now })
    expect(adj).toMatchObject({ active: true, setDelta: -1, weightFactor: 0.92 })
    expect(prescribe({ sets: 4, reps: '8', muscle: 'Pecho' }, adj).sets).toBe(3)
    expect(prescribe({ sets: 2, reps: '8', muscle: 'Pecho' }, adj).sets).toBe(2)
    expect(prescribe({ sets: 3, reps: '8', muscle: 'Pecho' }, adj).sets).toBe(2)
  })
  it('dolor en un músculo solo afecta a ese grupo', () => {
    const adj = planAdjustment({ profile, sessions: [], activities: [], wellness: [w({ sleepHours: 8, energy: 4, soreness: 4, soreAreas: ['Cuádriceps'] })], now })
    expect(prescribe({ sets: 4, reps: '8', muscle: 'Cuádriceps' }, adj).sets).toBe(3)
    expect(prescribe({ sets: 4, reps: '8', muscle: 'Pecho' }, adj).sets).toBe(4)
  })
  it('carga: ratio agudo/crónico incluye Jiu-Jitsu', () => {
    const base = [sess(3), sess(5), sess(10), sess(12), sess(17), sess(19), sess(24), sess(26)] // 2 sesiones/semana
    expect(loadStatus(base, [], now).level).toBe('ok')
    const bjj: Activity[] = [1, 2, 3, 4, 5].map((d) => ({ id: String(d), ts: now.getTime() - d * DAY, sport: 'Jiu-Jitsu', minutes: 90, rpe: 8 }))
    const st = loadStatus(base, bjj, now)
    expect(st.level).toBe('high')
    expect(planAdjustment({ profile, sessions: base, activities: bjj, wellness: [], now })).toMatchObject({ active: true, setDelta: -1 })
    expect(loadStatus([sess(1)], [], now).level).toBe('unknown') // sin historial no se opina
  })
  it('el RPE de la sesión pesa en la carga', () => {
    const base = [sess(10, 60, 9), sess(12, 60, 9), sess(17, 60, 9), sess(19, 60, 9), sess(24, 60, 9), sess(26, 60, 9)]
    expect(loadStatus([...base, sess(1, 60, 9), sess(3, 60, 9)], [], now).level).toBe('ok')
  })
  it('recortar a tiempo disponible', () => {
    const day = { id: 'd', name: 'D', weekdays: [], exercises: Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: 'E' + i, muscle: 'Pecho', sets: 4, reps: '8', rest: 120 })) }
    const r = fitToTime(day, 45)
    expect(r.removedSets + r.removedExercises).toBeGreaterThan(0)
    expect(r.day.exercises.every((e) => e.sets >= 2)).toBe(true)
    expect(day.exercises.every((e) => e.sets === 4)).toBe(true) // no muta el original
  })
  it('avisa de choques con Jiu-Jitsu y disponibilidad', () => {
    const p = { ...profile, availableDays: [0, 1, 2] }
    const plan = buildDefaultPlan() // combate: martes y viernes
    const notes = scheduleNotes(p, [{ id: 'a', name: 'Pierna', weekdays: [1], exercises: [] }, { id: 'b', name: 'Torso', weekdays: [5], exercises: [] }], plan)
    expect(notes.join('|')).toMatch(/Pierna.*martes.*combate/)
    expect(notes.join('|')).toMatch(/Torso.*sábado.*fuera/)
  })
  it('no sube de peso si la recuperación lo desaconseja', () => {
    const s: Session = { id: 'x', routineName: 'r', dayName: 'd', startedAt: 1, endedAt: 2, exercises: [{ id: 'e', exerciseId: 'press-banca', name: 'Press banca', muscle: 'Pecho', targetReps: '8-10', rest: 90, sets: [10, 10, 10].map((reps) => ({ weight: 60, reps, done: true })) }] }
    const t = { name: 'Press banca', exerciseId: 'press-banca', targetReps: '8-10' }
    expect(recommendWeight(t, [s], {}).weight).toBe(62.5)
    expect(recommendWeight(t, [s], { holdProgress: true })).toMatchObject({ weight: 60, kind: 'repeat' })
    expect(recommendWeight(t, [], { bodyWeight: 60 }).weight).toBe(42.5) // 0,7 × 60 = 42
    expect(recommendWeight(t, [], { bodyWeight: 70 }).weight).toBe(50)   // el peso cambia → cambia la recomendación
  })
})
