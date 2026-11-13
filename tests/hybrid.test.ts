import { beforeEach, describe, expect, it } from 'vitest'
import { setCustomExercises, matchExercise } from '../src/modules/gym/data/exercises'
import { DEFAULT_PROFILE, migrateProfile } from '../src/shared/services/profileService'
import { DEFAULT_REST_DAYS, assignGymDays, composeWeek, defaultCombatPlan, errorsOf, gymFocus, migrateLegacyPlan, nextCombat, nextGym, todayPlan, tryAssignGymDays, tryChangeCombat, tryChangeRestDays, validatePlan } from '../src/shared/services/planningService'
import { buildWorkout, defaultHybridRoutine } from '../src/modules/gym/services/workoutService'
import { prescribe } from '../src/modules/gym/services/progressionService'
import { planAdjustment } from '../src/shared/services/adjustmentService'
import { consecutiveHardDays, loadBetween } from '../src/shared/services/fatigueService'
import { deloadStatus, endDeload, readiness, snoozeDeload, startDeload } from '../src/shared/services/recoveryService'
import { buildCombatActivity, combatSummary } from '../src/modules/combat/services/combatService'
import { parseCombatImport } from '../src/modules/combat/services/combatImportService'
import { analyzeBundle, applyBundle, parseBundle } from '../src/shared/services/hybridImportService'
import { dateKey } from '../src/shared/lib/utils'
import type { Activity, EngineCtx, Profile, Session, Wellness } from '../src/types'

const DAY = 86400000
const routine = defaultHybridRoutine()
const combat = defaultCombatPlan()
const profile: Profile = { ...DEFAULT_PROFILE, experience: 'intermediate' }
const plan = composeWeek(routine, combat, profile)
const thursday = new Date('2026-11-12T12:00:00') // jueves: GYM B, mañana MMA con sparring
const friday = new Date('2026-11-13T12:00:00')
const saturday = new Date('2026-11-14T10:00:00')
const ctx = (over: Partial<EngineCtx> = {}): EngineCtx => ({ profile, sessions: [], activities: [], wellness: [], plan, routine, now: friday, ...over })
const act = (hoursAgo: number, now: Date, o: Partial<Activity> = {}): Activity => ({ id: `${hoursAgo}`, ts: now.getTime() - hoursAgo * 3600000, sport: 'MMA', minutes: 90, rpe: 8, kind: 'combat', ...o })
const gym = (daysAgo: number, now: Date, rpe?: number, minutes = 60): Session => ({ id: `g${daysAgo}`, routineName: 'r', dayName: 'd', exercises: [], rpe, startedAt: now.getTime() - daysAgo * DAY - minutes * 60000, endedAt: now.getTime() - daysAgo * DAY })

describe('configuración del propietario', () => {
  it('rutina GYM A/B/C con la programación indicada', () => {
    const d = (i: number) => routine.days[i].exercises.map((e) => `${e.name}|${e.sets}|${e.reps}`)
    expect(d(0)).toEqual(['Press banca|3|6-8', 'Dominadas|3|6-10', 'Remo con barra|3|8-10', 'Press inclinado con mancuernas|2|8-12', 'Elevaciones laterales|2|12-15', 'Curl con mancuernas|2|10-12', 'Extensión de tríceps en polea|2|10-12'])
    expect(d(1).slice(0, 5)).toEqual(['Sentadilla con barra|3|5-8', 'Peso muerto rumano|3|8', 'Zancadas|2|8', 'Curl femoral tumbado|2|12', 'Elevación de gemelos de pie|2|15'])
    expect(routine.days[1].exercises[5]).toMatchObject({ muscle: 'Core', sets: 3 })
    expect(d(2).map((x) => x.split('|').slice(0, 2).join('|'))).toEqual(['Press inclinado con mancuernas|3', 'Remo con apoyo|3', 'Step-ups|2', 'Press landmine|2', 'Farmer walks|3', 'Pallof press|2'])
    for (const day of routine.days) for (const e of day.exercises) expect(e.exerciseId && matchExercise(e.name)?.id).toBe(e.exerciseId)
  })
  it('la rutina de gimnasio no contiene nada de combate', () => {
    const names = routine.days.flatMap((d) => d.exercises.map((e) => e.name.toLowerCase())).join(' ')
    expect(names).not.toMatch(/jiu|boxeo|mma|kick|wrestling|sparring|sombra/)
  })
  it('semana L-D derivada de las tres fuentes y sin errores de recuperación', () => {
    expect(plan.slots.map((s) => s.type)).toEqual(['gym', 'combat', 'recovery', 'gym', 'combat', 'gym', 'rest'])
    expect(plan.slots.map((s) => s.label)).toEqual(['GYM A', 'MMA', 'RECUPERACIÓN', 'GYM B', 'MMA', 'GYM C', 'DESCANSO COMPLETO'])
    const issues = validatePlan(plan, DEFAULT_PROFILE, routine)
    expect(errorsOf(issues)).toEqual([])
    expect(issues.some((i) => i.level === 'warning')).toBe(false)
    expect(issues.find((i) => i.code === 'LEGS_BEFORE_SPARRING')?.day).toBe(3)
    expect(plan.slots.filter((s) => s.routineDayId).map((s) => s.routineDayId)).toEqual(['hybrid-a', 'hybrid-b', 'hybrid-c'])
  })
  it('foco corporal de cada día', () => {
    expect(plan.slots.filter((s) => s.type === 'gym').map((s) => gymFocus(s, routine))).toEqual(['upper', 'lower', 'full'])
  })
  it('migra un perfil anterior sin perder datos propios', () => {
    const old = { ...DEFAULT_PROFILE, athleteType: undefined, restDays: undefined, name: 'Yemel', mainGoal: 'Mi objetivo', sports: ['Gimnasio', 'Running'], bjjDays: [1], bjjMinutes: 75, weeklyGoal: 4 } as unknown as Profile
    const m = migrateProfile(old) as Profile & { bjjDays?: number[] }
    expect(m).toMatchObject({ name: 'Yemel', athleteType: 'Balanced Hybrid Athlete', primaryDiscipline: 'MMA', weeklyGoal: 3, contactSessionsPerWeek: 2, recoveryDaysPerWeek: 2, combatMinutes: 75, restDays: [6] })
    expect(m.sports).toEqual(expect.arrayContaining(['Gimnasio', 'Running', 'MMA']))
    expect(m.bjjDays).toBeUndefined()
    expect(migrateProfile(m)).toBe(m)
  })
})

describe('separación de datos: Gym, Combat y recuperación son fuentes independientes', () => {
  it('cambiar Gym no toca Combat y viceversa', () => {
    const moved = assignGymDays(routine, 'hybrid-b', [2])
    expect(moved.days.find((d) => d.id === 'hybrid-b')!.weekdays).toEqual([2])
    expect(combat.sessions.map((s) => s.day)).toEqual([1, 4]) // combate intacto
    const combat2 = { ...combat, sessions: combat.sessions.filter((s) => s.day !== 1) }
    expect(routine.days.map((d) => d.weekdays)).toEqual([[0], [3], [5]]) // gimnasio intacto
    const w = composeWeek(routine, combat2, profile)
    expect(w.slots.map((s) => s.type)).toEqual(['gym', 'recovery', 'recovery', 'gym', 'combat', 'gym', 'rest'])
  })
  it('un día de la semana admite un solo día de rutina de gimnasio (mover, no duplicar)', () => {
    const r = assignGymDays(routine, 'hybrid-a', [3]) // GYM A al jueves → GYM B pierde el jueves
    expect(r.days.map((d) => d.weekdays)).toEqual([[3], [], [5]])
  })
  it('las reglas de recuperación bloquean cambios peligrosos venga el cambio de donde venga', () => {
    // GYM: GYM A también el miércoles → L-M-X-J seguidos y 1 solo día de recuperación
    const g = tryAssignGymDays(routine, 'hybrid-a', [0, 2], combat, profile)
    expect(g.ok).toBe(false)
    expect(g.routine).toBe(routine)
    expect(g.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['RECOVERY_DAYS', 'TOO_MANY_CONSECUTIVE']))
    // COMBAT: MMA el miércoles también
    const c = tryChangeCombat(combat, { ...combat, sessions: [...combat.sessions, { ...combat.sessions[0], day: 2 }] }, routine, profile)
    expect(c.ok).toBe(false)
    expect(c.combat).toBe(combat)
    // Recuperación global: sin ningún descanso completo
    expect(tryChangeRestDays([], routine, combat, profile)).toMatchObject({ ok: false, restDays: DEFAULT_REST_DAYS })
    expect(tryChangeRestDays([], routine, combat, profile).issues.map((i) => i.code)).toContain('NO_REST')
  })
  it('permite cambios válidos', () => {
    const g = tryAssignGymDays(routine, 'hybrid-b', [2], combat, profile) // GYM B al miércoles
    expect(g.ok).toBe(true)
    expect(g.routine.days.find((d) => d.id === 'hybrid-b')!.weekdays).toEqual([2])
    expect(tryChangeRestDays([2, 6], routine, combat, profile).ok).toBe(true)
    // quitar una sesión de combate nunca rompe la recuperación
    expect(tryChangeCombat(combat, { ...combat, sessions: [combat.sessions[0]] }, routine, profile).ok).toBe(true)
  })
  it('advierte de piernas antes de combate intenso, días duros seguidos y doble sesión', () => {
    const hard = { ...combat, sessions: combat.sessions.map((s) => (s.day === 4 ? { ...s, intensity: 'hard' as const } : s)) }
    const codes = validatePlan(composeWeek(routine, hard, profile), profile, routine).map((i) => i.code)
    expect(codes).toContain('LEGS_BEFORE_COMBAT')
    expect(codes).toContain('HARD_STREAK')
    const dbl = assignGymDays(routine, 'hybrid-a', [1]) // GYM A el martes, día de MMA
    expect(validatePlan(composeWeek(dbl, combat, profile), profile, dbl).map((i) => i.code)).toContain('DOUBLE_SESSION')
  })
  it('hoy, próximo gimnasio y próxima sesión de combate se calculan por separado', () => {
    const t = todayPlan({ plan, routine, sessions: [], activities: [], now: thursday })
    expect(t.slot?.type).toBe('gym')
    expect(t.routineDay?.id).toBe('hybrid-b')
    expect(nextGym({ routine, sessions: [], now: thursday })).toMatchObject({ day: { id: 'hybrid-b' }, label: 'Hoy' })
    expect(nextCombat({ plan, activities: [], now: thursday })).toMatchObject({ label: 'Mañana', weekday: 4 })
    // hecho el gimnasio de hoy, el siguiente es GYM C; el combate no cambia
    const done = [{ ...gym(0, thursday), dayName: 'GYM B — Tren inferior' }]
    expect(nextGym({ routine, sessions: done, now: thursday })).toMatchObject({ day: { id: 'hybrid-c' }, label: 'Sábado' })
    expect(nextCombat({ plan, activities: [], now: thursday })?.weekday).toBe(4)
    // una sesión de combate hecha no afecta al gimnasio
    expect(nextGym({ routine, sessions: [], now: friday })?.day.id).toBe('hybrid-c')
    expect(nextCombat({ plan, activities: [act(1, friday, { ts: friday.getTime() - 3600000 })], now: friday })?.weekday).toBe(1)
    expect(todayPlan({ plan, routine, sessions: [], activities: [], now: new Date('2026-11-15T12:00:00') }).slot?.type).toBe('rest')
  })
  it('migra la semana mezclada de versiones anteriores', () => {
    const m = migrateLegacyPlan({ name: 'x', updatedAt: 1, slots: [
      { day: 1, type: 'combat', label: 'MMA', intensity: 'light', combat: { sport: 'Boxeo', disciplines: ['Striking'], sparring: false } },
      { day: 2, type: 'recovery', label: 'R' }, { day: 6, type: 'rest', label: 'D' },
      { day: 4, type: 'combat', label: 'MMA', intensity: 'moderate', combat: { disciplines: ['Wrestling'], sparring: true, minutes: 80 } },
    ] })
    expect(m.restDays).toEqual([6])
    expect(m.combat.sessions).toEqual([
      { day: 1, sport: 'Boxeo', label: 'MMA', focus: undefined, intensity: 'light', areas: ['Striking'], sparring: false, minutes: undefined },
      { day: 4, sport: 'MMA', label: 'MMA', focus: undefined, intensity: 'moderate', areas: ['Wrestling'], sparring: true, minutes: 80 },
    ])
  })
})

describe('motor de ajuste híbrido', () => {
  it('modera el tren inferior el día antes del combate con sparring, no el superior', () => {
    const adj = planAdjustment(ctx({ now: thursday }))
    expect(adj).toMatchObject({ active: true, holdLower: true, lowerSetDelta: -1, holdAll: false })
    expect(adj.notes.join(' ')).toMatch(/Mañana hay combate con sparring/)
    expect(prescribe({ sets: 3, reps: '5-8', muscle: 'Cuádriceps' }, adj)).toMatchObject({ sets: 2, hold: true })
    expect(prescribe({ sets: 3, reps: '6-8', muscle: 'Pecho' }, adj)).toMatchObject({ sets: 3, hold: false, weightFactor: 1 })
    const w = buildWorkout(routine.days[1], ctx({ now: thursday }), adj)
    expect(w.logs[0].sets).toHaveLength(2)
    expect(w.logs[1].sets).toHaveLength(2)
    expect(w.logs[3].sets).toHaveLength(2)
  })
  it('un día normal no cambia nada', () => {
    expect(planAdjustment(ctx({ now: new Date('2026-11-09T12:00:00') })).active).toBe(false)
  })
  it('tras sparring duro reciente modera piernas; tras técnica ligera no', () => {
    expect(planAdjustment(ctx({ now: saturday, activities: [act(14, saturday, { sparring: true })] }))).toMatchObject({ holdLower: true, lowerSetDelta: -1 })
    expect(planAdjustment(ctx({ now: saturday, activities: [act(14, saturday, { rpe: 4, intensity: 'light' })] })).active).toBe(false)
  })
  it('no sube de peso si el día es de piernas y hay combate exigente cerca', () => {
    const squat: Session = { id: 's', routineName: 'r', dayName: 'd', startedAt: 1, endedAt: 2, exercises: [{ id: 'e', exerciseId: 'sentadilla', name: 'Sentadilla con barra', muscle: 'Cuádriceps', targetReps: '5-8', rest: 180, sets: [8, 8, 8].map((reps) => ({ weight: 60, reps, done: true })) }] }
    const free = buildWorkout(routine.days[1], ctx({ sessions: [squat], now: new Date('2026-11-09T12:00:00') }))
    expect(free.logs[0].sets[0].weight).toBe(62.5)
    const held = buildWorkout(routine.days[1], ctx({ sessions: [squat], now: thursday }), planAdjustment(ctx({ sessions: [squat], now: thursday })))
    expect(held.logs[0].sets[0].weight).toBeLessThanOrEqual(60)
  })
  it('recuperación baja recorta todo y bloquea subidas', () => {
    const w: Wellness[] = [{ id: dateKey(friday), sleepHours: 4.5, energy: 1, fatigue: 5 }]
    expect(readiness(w, friday).level).toBe('low')
    expect(planAdjustment(ctx({ wellness: w }))).toMatchObject({ setDelta: -1, holdAll: true, weightFactor: 0.92 })
  })
  it('nivel principiante: menos series y más repeticiones', () => {
    expect(prescribe({ sets: 3, reps: '6-8', muscle: 'Pecho' }, undefined, 'beginner')).toMatchObject({ sets: 3, reps: '8-10' })
    expect(prescribe({ sets: 4, reps: '8', muscle: 'Pecho' }, undefined, 'beginner')).toMatchObject({ sets: 3, reps: '10' })
    expect(prescribe({ sets: 2, reps: '12', muscle: 'Pecho' }, undefined, 'beginner').sets).toBe(2)
    expect(prescribe({ sets: 3, reps: '30-40 m', muscle: 'Antebrazos' }, undefined, 'beginner').reps).toBe('30-40 m')
  })
  it('evita volumen innecesario: omite accesorios si el músculo ya acumula series', () => {
    const lots: Session = { id: 'v', routineName: 'r', dayName: 'd', startedAt: 1, endedAt: friday.getTime() - DAY, exercises: [{ id: 'e', exerciseId: 'press-banca', name: 'Press banca', muscle: 'Pecho', targetReps: '8', rest: 90, sets: Array.from({ length: 12 }, () => ({ weight: 40, reps: 8, done: true })) }] }
    const w = buildWorkout(routine.days[0], ctx({ sessions: [lots], now: new Date('2026-11-16T12:00:00') }))
    expect(w.logs.filter((l) => l.muscle === 'Pecho').reduce((a, l) => a + l.sets.length, 0)).toBeLessThanOrEqual(5)
    const more = { ...lots, exercises: [{ ...lots.exercises[0], sets: Array.from({ length: 14 }, () => ({ weight: 40, reps: 8, done: true })) }] }
    const w2 = buildWorkout(routine.days[0], ctx({ sessions: [more], now: new Date('2026-11-16T12:00:00') }))
    expect(w2.logs.filter((l) => l.muscle === 'Pecho').reduce((a, l) => a + l.sets.length, 0)).toBe(4)
    expect(w2.notes.join(' ')).toMatch(/Pecho.*omiten/)
  })
})

describe('carga interna y días duros (indicador global)', () => {
  it('suma gimnasio, combate y movilidad (duración × RPE) en un único total', () => {
    const now = friday
    const l = loadBetween([gym(2, now, 7, 60)], [act(30, now, { minutes: 90, rpe: 6 }), { id: 'm', ts: now.getTime() - 3600000, sport: 'Movilidad', minutes: 20, rpe: 2, kind: 'recovery' }], now.getTime() - 7 * DAY, now.getTime() + 1)
    expect(l).toMatchObject({ gym: 420, combat: 540, other: 40, total: 1000 })
    expect(loadBetween([gym(2, now)], [], now.getTime() - 7 * DAY, now.getTime() + 1).gym).toBe(360)
  })
  it('detecta días duros seguidos', () => {
    const hard = [act(30, friday), act(54, friday, { rpe: 7 })]
    expect(consecutiveHardDays([], hard, friday)).toBe(2)
    expect(consecutiveHardDays([gym(1, friday, 9)], [act(50, friday, { rpe: 3 })], friday)).toBe(1)
    const adj = planAdjustment(ctx({ activities: hard }))
    expect(adj.suggestRecoveryDay).toBe(true)
    expect(adj.notes.join(' ')).toMatch(/2 días duros seguidos/)
  })
})

describe('semana de descarga', () => {
  const weekly = (n: number, now: Date) => Array.from({ length: n }, (_, i) => gym(i * 7 + 1, now, 7))
  it('no es automática ni antes de tiempo', () => {
    expect(deloadStatus(ctx({ sessions: weekly(3, friday) })).state).toBe('not-due')
    expect(deloadStatus(ctx({})).state).toBe('not-due')
  })
  it('toca por calendario pero solo se sugiere si lo justifican los datos', () => {
    const sessions = weekly(7, friday)
    expect(deloadStatus(ctx({ sessions })).state).toBe('due-fine')
    const tired: Wellness[] = [0, 1, 2].map((d) => ({ id: dateKey(new Date(friday.getTime() - d * DAY)), sleepHours: 5, energy: 1, fatigue: 5, recovery: 1 }))
    const st = deloadStatus(ctx({ sessions, wellness: tired }))
    expect(st.state).toBe('suggested')
    expect(st.reasons.join(' ')).toMatch(/recuperación/)
  })
  it('es configurable (4-6 semanas) y se puede posponer, iniciar y terminar', () => {
    const sessions = weekly(5, friday)
    expect(deloadStatus(ctx({ sessions, profile: { ...profile, deloadEveryWeeks: 4 } })).state).not.toBe('not-due')
    expect(deloadStatus(ctx({ sessions, profile: { ...profile, deloadEveryWeeks: 6 } })).state).toBe('not-due')
    expect(deloadStatus(ctx({ sessions, profile: { ...profile, deloadEveryWeeks: 99 } })).every).toBe(6)
    const tired: Wellness[] = [0, 1, 2].map((d) => ({ id: dateKey(new Date(friday.getTime() - d * DAY)), sleepHours: 5, energy: 1, fatigue: 5 }))
    const snoozed = { ...profile, ...snoozeDeload(friday) }
    expect(deloadStatus(ctx({ sessions: weekly(7, friday), wellness: tired, profile: snoozed })).state).toBe('snoozed')
    const started = { ...profile, ...startDeload(friday) }
    expect(deloadStatus(ctx({ profile: started })).state).toBe('active')
    const adj = planAdjustment(ctx({ profile: started }))
    expect(adj).toMatchObject({ deload: true, holdAll: true })
    expect(prescribe({ sets: 4, reps: '6-8', muscle: 'Pecho' }, adj).sets).toBe(2)
    const after = { ...started, ...endDeload(new Date(friday.getTime() + 7 * DAY)) }
    expect(deloadStatus(ctx({ profile: after, sessions: weekly(7, friday), now: new Date(friday.getTime() + 8 * DAY) })).state).toBe('not-due')
    expect(deloadStatus(ctx({ profile: started, now: new Date(friday.getTime() + 9 * DAY) })).state).not.toBe('active')
  })
})

describe('combate', () => {
  const base = { sport: 'MMA', disciplines: ['Striking' as const], techniques: ['Jab'], skills: ['Timing'], sparring: false, ts: 1 }
  it('no asume intensidad alta y exige RPE o intensidad', () => {
    expect(buildCombatActivity({ ...base, minutes: 60 }).error).toMatch(/no se asume/)
    expect(buildCombatActivity({ ...base }).error).toMatch(/duración/)
    const light = buildCombatActivity({ ...base, minutes: 60, intensity: 'light' }).activity!
    expect(light).toMatchObject({ rpe: 4, intensity: 'light', kind: 'combat', techniques: ['Jab'], skills: ['Timing'] })
    expect(buildCombatActivity({ ...base, minutes: 60, rpe: 8 }).activity).toMatchObject({ intensity: 'hard' })
    expect(buildCombatActivity({ ...base, minutes: 60, rpe: 11 }).error).toMatch(/entre 1 y 10/)
    expect(buildCombatActivity({ ...base, minutes: 60, rpe: 7, sparring: true, sparringRounds: 5, note: ' guardia baja ' }).activity).toMatchObject({ sparring: true, sparringRounds: 5, note: 'guardia baja' })
  })
  it('resumen por disciplina y sparring', () => {
    const a = (o: Partial<Activity>): Activity => ({ id: Math.random() + '', ts: friday.getTime() - DAY, sport: 'MMA', minutes: 60, rpe: 5, kind: 'combat', ...o })
    const s = combatSummary([a({ disciplines: ['Striking'], techniques: ['Jab'] }), a({ disciplines: ['Striking', 'Wrestling'], techniques: ['Jab', 'Sprawl'], sparring: true, rpe: 8 }), a({ ts: friday.getTime() - 60 * DAY })], 30, friday)
    expect(s).toMatchObject({ sessions: 2, minutes: 120, sparringSessions: 1, hardSessions: 1 })
    expect(s.byDiscipline[0]).toEqual({ discipline: 'Striking', count: 2 })
    expect(s.topTechniques[0]).toEqual({ technique: 'Jab', count: 2 })
  })
})

describe('importación independiente por módulo', () => {
  beforeEach(() => setCustomExercises([]))
  const full = JSON.stringify({
    athlete: { type: 'Balanced Hybrid Athlete', primaryDiscipline: 'MMA', gymSessions: 3, contactSessions: 2, recoveryDays: 2, deloadEveryWeeks: 8, experience: 'avanzado' },
    name: 'Plan ChatGPT',
    days: [
      { name: 'GYM A — Superior', exercises: [{ name: 'Press banca', muscle: 'Pecho', sets: 3, reps: '6-8', rest: 150 }, { name: 'Remo con cable neutro', muscle: 'Espalda', sets: 3, reps: '10', rest: 90 }] },
      { name: 'GYM B — Inferior', exercises: [{ name: 'Sentadilla con barra', muscle: 'Cuádriceps', sets: 3, reps: '5', rest: 180 }] },
    ],
    week: [
      { day: 'Lunes', type: 'gym', gymDay: 'GYM A' }, { day: 'Martes', type: 'mma', label: 'MMA', areas: ['Boxeo', 'bjj'], intensity: 'ligera', sparring: false, minutes: 90 },
      { day: 'Miércoles', type: 'recuperación' }, { day: 'Jueves', type: 'gym', gymDay: 'GYM B' },
      { day: 'Viernes', type: 'mma', intensity: 'moderate', sparring: true, areas: ['Wrestling'] },
      { day: 'Sábado', type: 'rest' }, { day: 'Domingo', type: 'descanso' },
    ],
    customExercises: [{ name: 'Remo con cable neutro', muscle: 'Espalda', equipment: ['Polea'], steps: ['Tira hacia el abdomen'] }, { name: 'Press banca', muscle: 'Pecho' }],
  })
  const ctxI = { profile: DEFAULT_PROFILE, routine, combatPlan: combat }

  it('híbrido: cada parte va a su módulo', () => {
    const b = parseBundle(full, { routine })
    expect(b.issues.filter((i) => i.level === 'error')).toEqual([])
    expect(b.routine?.days).toHaveLength(2)
    expect(b.week?.entries).toHaveLength(7)
    expect(b.week?.combat[0]).toMatchObject({ day: 1, intensity: 'light', areas: ['Boxeo', 'Brazilian Jiu-Jitsu'], minutes: 90, sparring: false })
    expect(b.week?.combat[1]).toMatchObject({ day: 4, sparring: true })
    expect(b.athlete).toMatchObject({ weeklyGoal: 3, contactSessionsPerWeek: 2, recoveryDaysPerWeek: 2, deloadEveryWeeks: 6, experience: 'advanced' })
    expect(b.customExercises).toHaveLength(1)
    expect(b.routine!.days[0].exercises[1].exerciseId).toBe(b.customExercises![0].id)
    const a = analyzeBundle(b, ctxI)
    expect(a.weekBlocked).toBe(false)
    expect(a.routine!.days.map((d) => d.weekdays)).toEqual([[0], [3]])
    const applied = applyBundle(b, a, { includeWeek: true })
    expect(applied.routine!.days.map((d) => d.weekdays)).toEqual([[0], [3]])
    expect(applied.combatPlan!.sessions.map((s) => s.day)).toEqual([1, 4])
    expect(applied.profilePatch).toMatchObject({ weeklyGoal: 3, restDays: [5, 6] })
  })
  it('GYM: solo importa rutina y ejercicios; ignora combate y perfil con aviso', () => {
    const b = parseBundle(full, { routine }, 'gym')
    expect(b.routine).toBeDefined()
    expect(b.customExercises).toHaveLength(1)
    expect(b.week).toBeUndefined()
    expect(b.combatSessions).toBeUndefined()
    expect(b.athlete).toBeUndefined()
    expect(b.issues.some((i) => /solo de GYM.*semana y sesiones de combate.*COMBAT/.test(i.message))).toBe(true)
    const applied = applyBundle(b, analyzeBundle(b, ctxI), { includeWeek: false })
    expect(applied.combatPlan).toBeUndefined()
    expect(applied.routine!.days.every((d) => d.weekdays.length === 0)).toBe(true)
  })
  it('COMBAT: solo importa sesiones de combate; ignora rutinas con aviso', () => {
    const b = parseBundle(full, { routine }, 'combat')
    expect(b.routine).toBeUndefined()
    expect(b.customExercises).toBeUndefined()
    expect(b.combatSessions?.map((s) => s.day)).toEqual([1, 4])
    expect(b.issues.some((i) => /solo de COMBAT.*GYM/.test(i.message))).toBe(true)
    const a = analyzeBundle(b, ctxI)
    const applied = applyBundle(b, a, { includeWeek: true })
    expect(applied.routine).toBeUndefined()
    expect(applied.combatPlan?.sessions).toHaveLength(2)
  })
  it('importador de combate independiente: sesiones, deportes y avisos', () => {
    const r = parseCombatImport(JSON.stringify({ sessions: [{ day: 'Lunes', sport: 'bjj', intensity: 'light', areas: ['Defensa'], sparring: true, minutes: 60 }, { day: 'Jueves', sport: 'Muay Thai' }, { day: 'Viernes', sport: 'Natación' }], days: [{ name: 'x', exercises: [] }] }), 'MMA')
    expect(r.sessions.map((s) => [s.day, s.sport, s.intensity])).toEqual([[0, 'Brazilian Jiu-Jitsu', 'light'], [3, 'Kickboxing', 'moderate'], [4, 'MMA', 'moderate']])
    expect(r.issues.some((i) => /Natación.*no reconocido/.test(i.message))).toBe(true)
    expect(r.issues.some((i) => /ignoran aquí.*GYM/.test(i.message))).toBe(true)
    expect(parseCombatImport('{"foo":1}', 'MMA').issues[0].level).toBe('error')
  })
  it('un ejercicio personalizado parecido a uno de la biblioteca no se confunde con él', () => {
    const b = parseBundle(JSON.stringify({ name: 'R', days: [{ name: 'A', exercises: [{ name: 'Remo con polea neutra', muscle: 'Espalda', sets: 3, reps: '10', rest: 90 }] }], customExercises: [{ name: 'Remo con polea neutra', muscle: 'Espalda', equipment: ['Polea'] }] }), { routine }, 'gym')
    expect(b.customExercises![0].id).toBe('custom-remo-con-polea-neutra')
    expect(b.routine!.days[0].exercises[0].exerciseId).toBe('custom-remo-con-polea-neutra')
  })
  it('bloquea una semana sin recuperación y explica por qué', () => {
    const week = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => ({ day, type: 'gym', gymDay: 'GYM A' }))
    const b = parseBundle(JSON.stringify({ name: 'Mala', days: [{ name: 'GYM A', exercises: [{ name: 'Press banca', sets: 3, reps: '8' }] }], week }), { routine })
    const a = analyzeBundle(b, ctxI)
    expect(a.weekBlocked).toBe(true)
    expect(a.issues.filter((i) => i.level === 'error').map((i) => i.code)).toEqual(expect.arrayContaining(['RECOVERY_DAYS', 'NO_REST']))
    const applied = applyBundle(b, a, { includeWeek: true })
    expect(applied.combatPlan).toBeUndefined()
    expect(applied.routine).toBeDefined()
    expect(applied.routine!.days.every((d) => d.weekdays.length === 0)).toBe(true)
  })
  it('solo combate suelto: se fusiona sin tocar el gimnasio y se bloquea si rompe la recuperación', () => {
    const ok = analyzeBundle(parseBundle(JSON.stringify({ mma: [{ day: 'Martes', areas: ['Boxeo'], intensity: 'light' }] }), { routine }, 'combat'), ctxI)
    expect(ok.weekBlocked).toBe(false)
    expect(ok.combatPlan!.sessions.find((s) => s.day === 1)!.areas).toEqual(['Boxeo'])
    expect(ok.combatPlan!.sessions).toHaveLength(2)
    const bad = analyzeBundle(parseBundle(JSON.stringify({ mma: [{ day: 'Miércoles', intensity: 'light' }] }), { routine }, 'combat'), ctxI)
    expect(bad.weekBlocked).toBe(true)
    expect(bad.issues.map((i) => i.code)).toContain('RECOVERY_DAYS')
  })
  it('avisa de volumen semanal excesivo y de rutinas que no caben en el tiempo', () => {
    const ex = (n: string) => ({ name: n, muscle: 'Pecho', sets: 6, reps: '8', rest: 120 })
    const b = parseBundle(JSON.stringify({ name: 'Pecho', days: [{ name: 'A', weekdays: ['Lunes'], exercises: [ex('Press banca'), ex('Aperturas con mancuernas'), ex('Flexiones')] }, { name: 'B', weekdays: ['Jueves'], exercises: [ex('Press inclinado con barra')] }] }), { routine }, 'gym')
    const a = analyzeBundle(b, { ...ctxI, profile: { ...DEFAULT_PROFILE, sessionMinutes: 45 } })
    expect(a.issues.some((i) => i.code === 'VOLUME_CAP' && /Pecho: 24/.test(i.message))).toBe(true)
    expect(a.issues.some((i) => i.code === 'TOO_LONG')).toBe(true)
  })
  it('compatibilidad con rutinas simples y texto; basura con explicación', () => {
    expect(parseBundle('{"name":"x","days":[{"name":"D","exercises":[{"name":"Sentadilla","sets":3,"reps":"5","rest":120}]}]}', { routine }, 'gym').routine?.days).toHaveLength(1)
    expect(parseBundle('Día 1\nSentadilla 3x5', { routine }, 'gym').format).toBe('text')
    expect(parseBundle('Día 1\nSentadilla 3x5', { routine }, 'combat').issues[0].level).toBe('error')
    const bad = parseBundle('{"foo": 1}')
    expect(bad.issues[0]).toMatchObject({ level: 'error' })
    expect(bad.issues[0].fix).toMatch(/days|week/)
    const dup = parseBundle('{"week":[{"day":"Lunes","type":"rest"},{"day":"Lunes","type":"gym"},{"day":"Martes","type":"volar"}]}')
    expect(dup.issues.some((i) => /más de una vez/.test(i.message))).toBe(true)
    expect(dup.issues.some((i) => i.level === 'error' && /Tipo de día/.test(i.message))).toBe(true)
  })
})
