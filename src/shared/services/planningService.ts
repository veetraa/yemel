/**
 * planningService — semana tipo (gimnasio, combate, recuperación, descanso),
 * validación de reglas de recuperación y edición segura de días.
 */
import type { Activity, CombatPlan, CombatSport, EngineCtx, Intensity, PlanSlot, Profile, Routine, RoutineDay, Session, SlotType, WeekPlan } from '../../types'
import { startOfDay, WEEKDAYS, weekdayIndex } from '../lib/utils'
import { T, isLowerBody } from './principlesService'
import { isCombat } from '../lib/activity'

export const SLOT_LABEL: Record<SlotType, string> = { gym: 'Gimnasio', combat: 'Combate', recovery: 'Recuperación', rest: 'Descanso' }
export const SLOT_SHORT: Record<SlotType, string> = { gym: 'G', combat: 'C', recovery: 'R', rest: 'D' }
export const isTraining = (t: SlotType) => t === 'gym' || t === 'combat'

export const DEFAULT_REST_DAYS = [6]

/** Convierte la semana mezclada de versiones anteriores en datos propios de cada dominio */
export function migrateLegacyPlan(plan: WeekPlan): { combat: CombatPlan; restDays: number[] } {
  const known = ['MMA', 'Brazilian Jiu-Jitsu', 'Boxeo', 'Kickboxing', 'Wrestling']
  return {
    combat: {
      updatedAt: Date.now(),
      sessions: plan.slots.filter((s) => s.type === 'combat').map((s) => ({
        day: s.day, sport: (known.includes(s.combat?.sport ?? '') ? s.combat!.sport : 'MMA') as CombatSport, label: s.label, focus: s.focus,
        intensity: s.intensity ?? 'moderate', areas: s.combat?.disciplines ?? [], sparring: !!s.combat?.sparring, minutes: s.combat?.minutes,
      })),
    },
    restDays: plan.slots.filter((s) => s.type === 'rest').map((s) => s.day),
  }
}

/** Sesiones de combate por defecto del propietario (dato propio de COMBAT) */
export function defaultCombatPlan(): CombatPlan {
  return {
    updatedAt: Date.now(),
    sessions: [
      { day: 1, sport: 'MMA', label: 'MMA', focus: 'Técnica, striking, grappling y desplazamientos', intensity: 'light', areas: ['Striking', 'Grappling', 'Transiciones'], sparring: false },
      { day: 4, sport: 'MMA', label: 'MMA', focus: 'Técnica, situaciones específicas y sparring según nivel', intensity: 'moderate', areas: ['Striking', 'Wrestling', 'Brazilian Jiu-Jitsu', 'Defensa y escapes'], sparring: true },
    ],
  }
}

const shortGymLabel = (name: string) => name.split(/\s[—–-]\s/)[0].trim()

/**
 * La semana NO se guarda: se DERIVA de tres fuentes independientes, sin duplicar datos.
 *  · GYM: los días de la semana de cada día de la rutina (`routine.days[].weekdays`)
 *  · COMBAT: sus sesiones planificadas (`combatPlan`)
 *  · Recuperación global: `profile.restDays` (descanso completo); el resto de días libres son de recuperación activa
 */
export function composeWeek(routine: Routine | undefined, combat: CombatPlan | undefined, profile: Pick<Profile, 'restDays'>): WeekPlan {
  const rest = profile.restDays ?? DEFAULT_REST_DAYS
  const slots: PlanSlot[] = Array.from({ length: 7 }, (_, day) => {
    const gym = routine?.days.find((d) => d.weekdays.includes(day))
    const c = combat?.sessions.find((x) => x.day === day)
    if (c) {
      return { day, type: 'combat', label: c.label, focus: c.focus, intensity: c.intensity, routineDayId: gym?.id,
        combat: { sport: c.sport, disciplines: c.areas, sparring: c.sparring, minutes: c.minutes } } satisfies PlanSlot
    }
    if (gym) return { day, type: 'gym', label: shortGymLabel(gym.name), focus: gym.notes, routineDayId: gym.id } satisfies PlanSlot
    if (rest.includes(day)) return { day, type: 'rest', label: 'DESCANSO COMPLETO', focus: 'Sin entrenamiento', intensity: 'light' } satisfies PlanSlot
    return { day, type: 'recovery', label: 'RECUPERACIÓN', focus: 'Movilidad y descanso activo', intensity: 'light' } satisfies PlanSlot
  })
  return { name: 'Semana', routineId: routine?.id, slots, updatedAt: Math.max(routine?.updatedAt ?? 0, combat?.updatedAt ?? 0) }
}

export const slotFor = (plan: WeekPlan | undefined, day: number) => plan?.slots.find((s) => s.day === day)
export const combatDays = (plan?: WeekPlan) => (plan?.slots ?? []).filter((s) => s.type === 'combat').map((s) => s.day)
export const gymDays = (plan?: WeekPlan) => (plan?.slots ?? []).filter((s) => s.type === 'gym').map((s) => s.day)

// ───────── Foco corporal e intensidad por día ─────────
export type BodyFocus = 'upper' | 'lower' | 'full'

export function gymFocus(slot: PlanSlot, routine?: Routine): BodyFocus {
  const day = routine?.days.find((d) => d.id === slot.routineDayId)
  if (day && day.exercises.length) {
    const total = day.exercises.reduce((a, e) => a + e.sets, 0)
    const lower = day.exercises.filter((e) => isLowerBody(e.muscle)).reduce((a, e) => a + e.sets, 0)
    const upper = day.exercises.filter((e) => !isLowerBody(e.muscle) && e.muscle !== 'Core').reduce((a, e) => a + e.sets, 0)
    if (lower / total >= 0.45) return 'lower'
    if (lower / total >= 0.1 && upper / total >= 0.3) return 'full'
    return 'upper'
  }
  const txt = `${slot.label} ${slot.focus ?? ''}`.toLowerCase()
  if (/inferior|pierna|lower|legs/.test(txt)) return 'lower'
  if (/superior|upper|torso/.test(txt)) return 'upper'
  return 'full'
}

export function slotIntensity(slot: PlanSlot, routine?: Routine): Intensity {
  if (slot.type === 'combat') return slot.intensity ?? 'moderate'
  if (slot.type === 'gym') return gymFocus(slot, routine) === 'lower' ? 'hard' : 'moderate'
  return 'light'
}

/** Combate del que conviene llegar con piernas frescas: intensidad alta o sparring planificado */
export const isDemandingCombat = (slot?: PlanSlot) => !!slot && slot.type === 'combat' && (slot.intensity === 'hard' || !!slot.combat?.sparring)

// ───────── Validación ─────────
export interface PlanIssue { level: 'error' | 'warning' | 'info'; code: string; day?: number; message: string }

const dn = (d: number) => WEEKDAYS[d].toLowerCase()

export function validatePlan(plan: WeekPlan, profile: Profile, routine?: Routine): PlanIssue[] {
  const out: PlanIssue[] = []
  const slots = [...plan.slots].sort((a, b) => a.day - b.day)
  const at = (d: number) => slots.find((s) => s.day === ((d % 7) + 7) % 7)
  const minRecovery = profile.recoveryDaysPerWeek ?? T.MIN_RECOVERY_DAYS

  const rec = slots.filter((s) => !isTraining(s.type)).length
  if (rec < minRecovery) out.push({ level: 'error', code: 'RECOVERY_DAYS', message: `Necesitas al menos ${minRecovery} días de recuperación o descanso a la semana (ahora ${rec}).` })
  if (!slots.some((s) => s.type === 'rest')) out.push({ level: 'error', code: 'NO_REST', message: `Incluye al menos ${T.MIN_FULL_REST_DAYS} día de descanso completo.` })

  // Racha máxima de días de entrenamiento (la semana es circular)
  const train = Array.from({ length: 7 }, (_, d) => !!at(d) && isTraining(at(d)!.type))
  if (train.every(Boolean)) out.push({ level: 'error', code: 'TOO_MANY_CONSECUTIVE', message: 'Entrenas los 7 días: no hay recuperación.' })
  else {
    const start = train.findIndex((x) => !x)
    let run = 0, runStart = 0
    for (let i = 1; i <= 7; i++) {
      const d = (start + i) % 7
      if (train[d]) { if (run === 0) runStart = d; run++ } else { 
        if (run > T.MAX_CONSECUTIVE_TRAINING_DAYS) out.push({ level: 'error', code: 'TOO_MANY_CONSECUTIVE', day: runStart, message: `${run} días de entrenamiento seguidos desde el ${dn(runStart)}: el máximo es ${T.MAX_CONSECUTIVE_TRAINING_DAYS}.` })
        run = 0
      }
    }
  }

  for (const s of slots) {
    const next = at(s.day + 1)
    const prev = at(s.day - 1)
    const hard = slotIntensity(s, routine) === 'hard'
    if (hard && next && slotIntensity(next, routine) === 'hard' && isTraining(next.type))
      out.push({ level: 'warning', code: 'HARD_STREAK', day: s.day, message: `Dos días duros seguidos: ${dn(s.day)} y ${dn(next.day)}.` })
    if (s.type === 'combat' && s.routineDayId)
      out.push({ level: 'warning', code: 'DOUBLE_SESSION', day: s.day, message: `Doble sesión el ${dn(s.day)}: gimnasio y combate el mismo día.` })
    if (s.routineDayId && s.type !== 'combat' && gymFocus(s, routine) === 'lower') {
      if (next?.type === 'combat' && next.intensity === 'hard')
        out.push({ level: 'warning', code: 'LEGS_BEFORE_COMBAT', day: s.day, message: `Piernas el ${dn(s.day)} justo antes de combate intenso el ${dn(next.day)}. Mueve uno de los dos días.` })
      else if (next && isDemandingCombat(next))
        out.push({ level: 'info', code: 'LEGS_BEFORE_SPARRING', day: s.day, message: `El ${dn(next.day)} hay combate con sparring: el gimnasio de piernas del ${dn(s.day)} se moderará automáticamente.` })
      if (prev?.type === 'combat' && prev.intensity === 'hard')
        out.push({ level: 'warning', code: 'LEGS_AFTER_COMBAT', day: s.day, message: `Piernas el ${dn(s.day)} justo después de combate intenso el ${dn(prev.day)}.` })
    }
    if (profile.availableDays.length && isTraining(s.type) && !profile.availableDays.includes(s.day))
      out.push({ level: 'warning', code: 'UNAVAILABLE', day: s.day, message: `El ${dn(s.day)} está fuera de tus días disponibles.` })
  }

  const gyms = slots.filter((s) => !!s.routineDayId).length
  if (gyms !== profile.weeklyGoal) out.push({ level: 'info', code: 'GYM_COUNT', message: `Hay ${gyms} sesiones de gimnasio y tu objetivo es ${profile.weeklyGoal}.` })
  const combats = slots.filter((s) => s.type === 'combat').length
  if (profile.contactSessionsPerWeek !== undefined && combats !== profile.contactSessionsPerWeek)
    out.push({ level: 'info', code: 'COMBAT_COUNT', message: `Hay ${combats} sesiones de combate y tu objetivo es ${profile.contactSessionsPerWeek}.` })
  return out
}

export const errorsOf = (issues: PlanIssue[]) => issues.filter((i) => i.level === 'error')

// ───────── Edición segura (cada dominio edita SOLO lo suyo) ─────────

/**
 * Aplica un cambio solo si no rompe las reglas de recuperación
 * (o si reduce los errores de una semana que ya estaba rota, p. ej. importada).
 */
export function guardWeek(current: WeekPlan, candidate: WeekPlan, profile: Profile, routine?: Routine) {
  const before = errorsOf(validatePlan(current, profile, routine)).length
  const issues = validatePlan(candidate, profile, routine)
  const after = errorsOf(issues).length
  return { ok: after === 0 || after < before, issues }
}

/** GYM: asigna los días de la semana de un día de rutina (cada día de la semana admite un solo día de rutina de gimnasio) */
export function assignGymDays(routine: Routine, dayId: string, weekdays: number[]): Routine {
  const set = [...new Set(weekdays)].sort()
  return { ...routine, days: routine.days.map((d) => (d.id === dayId ? { ...d, weekdays: set } : { ...d, weekdays: d.weekdays.filter((w) => !set.includes(w)) })) }
}

export function tryAssignGymDays(routine: Routine, dayId: string, weekdays: number[], combat: CombatPlan | undefined, profile: Profile) {
  const candidate = assignGymDays(routine, dayId, weekdays)
  const g = guardWeek(composeWeek(routine, combat, profile), composeWeek(candidate, combat, profile), profile, candidate)
  return { ...g, routine: g.ok ? candidate : routine }
}

/** COMBAT: cambia sus sesiones (un máximo de una por día de la semana) */
export function tryChangeCombat(combat: CombatPlan, candidate: CombatPlan, routine: Routine | undefined, profile: Profile) {
  const g = guardWeek(composeWeek(routine, combat, profile), composeWeek(routine, candidate, profile), profile, routine)
  return { ...g, combat: g.ok ? candidate : combat }
}

/** Recuperación global: días de descanso completo */
export function tryChangeRestDays(restDays: number[], routine: Routine | undefined, combat: CombatPlan | undefined, profile: Profile) {
  const g = guardWeek(composeWeek(routine, combat, profile), composeWeek(routine, combat, { ...profile, restDays }), { ...profile, restDays }, routine)
  return { ...g, restDays: g.ok ? restDays : profile.restDays ?? DEFAULT_REST_DAYS }
}

/** Reparte N días entre los disponibles evitando los de combate si es posible */
export function suggestWeekdays(count: number, profile: Profile, combat: number[] = []): number[] {
  const pool = profile.availableDays.length ? profile.availableDays : [0, 1, 2, 3, 4, 5, 6]
  let cands = pool.filter((d) => !combat.includes(d))
  if (cands.length < count) cands = [...cands, ...pool.filter((d) => combat.includes(d))]
  cands = [...new Set(cands)].sort((a, b) => a - b)
  if (count >= cands.length) return cands
  return Array.from({ length: count }, (_, i) => cands[Math.floor((i * cands.length) / count)])
}

// ───────── Hoy / próximos ─────────
export interface TodayPlan {
  slot?: PlanSlot
  routineDay?: RoutineDay
  done: boolean
  next?: { slot: PlanSlot; label: string; offset: number }
}

const sameDay = (ts: number, now: Date) => startOfDay(ts) === startOfDay(now.getTime())

export function todayPlan(ctx: Pick<EngineCtx, 'plan' | 'routine' | 'sessions' | 'activities'> & { now?: Date }): TodayPlan {
  const now = ctx.now ?? new Date()
  const wd = weekdayIndex(now)
  const slot = slotFor(ctx.plan, wd)
  const routineDay = slot?.routineDayId ? ctx.routine?.days.find((d) => d.id === slot.routineDayId) : undefined
  let done = false
  if (slot?.type === 'gym') done = ctx.sessions.some((s) => sameDay(s.endedAt, now) && (!routineDay || s.dayName === routineDay.name))
  else if (slot?.type === 'combat') done = ctx.activities.some((a) => sameDay(a.ts, now) && isCombat(a))
  else if (slot?.type === 'recovery') done = ctx.activities.some((a) => sameDay(a.ts, now) && a.kind === 'recovery')
  let next: TodayPlan['next']
  for (let off = 1; off <= 7 && !next; off++) {
    const s = slotFor(ctx.plan, (wd + off) % 7)
    if (s && s.type !== 'rest') next = { slot: s, offset: off, label: off === 1 ? 'Mañana' : WEEKDAYS[(wd + off) % 7] }
  }
  return { slot, routineDay, done, next }
}

export interface UpcomingGym { day: RoutineDay; weekday: number; offset: number; label: string; done: boolean }
export interface UpcomingCombat { slot: PlanSlot; weekday: number; offset: number; label: string; done: boolean }
const offsetLabel = (off: number, wd: number) => (off === 0 ? 'Hoy' : off === 1 ? 'Mañana' : WEEKDAYS[wd])

/** Próxima sesión de GIMNASIO (solo mira los días de la rutina) */
export function nextGym(ctx: Pick<EngineCtx, 'routine' | 'sessions'> & { now?: Date }): UpcomingGym | undefined {
  const now = ctx.now ?? new Date()
  const wd0 = weekdayIndex(now)
  for (let off = 0; off <= 7; off++) {
    const wd = (wd0 + off) % 7
    const day = ctx.routine?.days.find((d) => d.weekdays.includes(wd))
    if (!day) continue
    const done = off === 0 && ctx.sessions.some((s) => sameDay(s.endedAt, now) && s.dayName === day.name)
    if (off === 0 && done) continue
    return { day, weekday: wd, offset: off, label: offsetLabel(off, wd), done }
  }
}

/** Próxima sesión de COMBATE (solo mira las sesiones de combate) */
export function nextCombat(ctx: Pick<EngineCtx, 'plan' | 'activities'> & { now?: Date }): UpcomingCombat | undefined {
  const now = ctx.now ?? new Date()
  const wd0 = weekdayIndex(now)
  for (let off = 0; off <= 7; off++) {
    const wd = (wd0 + off) % 7
    const slot = slotFor(ctx.plan, wd)
    if (slot?.type !== 'combat') continue
    const done = off === 0 && ctx.activities.some((a) => sameDay(a.ts, now) && isCombat(a))
    if (off === 0 && done) continue
    return { slot, weekday: wd, offset: off, label: offsetLabel(off, wd), done }
  }
}

/** Combate exigente mañana (el tren inferior de hoy debe moderarse) */
export const demandingCombatTomorrow = (plan: WeekPlan | undefined, now = new Date()) => {
  const s = slotFor(plan, (weekdayIndex(now) + 1) % 7)
  return isDemandingCombat(s) ? s : undefined
}

// ───────── Volumen y conflictos de una rutina en la semana ─────────
export function plannedWeeklySets(routine: Routine, plan?: WeekPlan): Record<string, number> {
  const linked = plan?.slots.filter((s) => s.type === 'gym' && s.routineDayId) ?? []
  const days = linked.length ? linked.map((s) => routine.days.find((d) => d.id === s.routineDayId)).filter((d): d is RoutineDay => !!d) : routine.days
  const out: Record<string, number> = {}
  for (const d of days) for (const e of d.exercises) out[e.muscle] = (out[e.muscle] ?? 0) + e.sets
  return out
}

export function volumeIssues(sets: Record<string, number>): PlanIssue[] {
  return Object.entries(sets)
    .filter(([m, n]) => n > T.WEEKLY_SET_CAP && m !== 'General')
    .map(([m, n]) => ({ level: 'warning' as const, code: 'VOLUME_CAP', message: `${m}: ${n} series/semana supera el máximo recomendado (${T.WEEKLY_SET_CAP}). Se omitirán accesorios.` }))
}

/** Avisos de una rutina con días asignados frente al plan/perfil */
export function scheduleNotes(profile: Profile, days: RoutineDay[], plan?: WeekPlan): string[] {
  const out: string[] = []
  const combat = combatDays(plan)
  for (const d of days.filter((x) => x.weekdays.length)) {
    const clash = d.weekdays.filter((w) => combat.includes(w))
    if (clash.length) out.push(`«${d.name}» cae en ${clash.map(dn).join(' y ')}, día de combate.`)
    const off = profile.availableDays.length ? d.weekdays.filter((w) => !profile.availableDays.includes(w)) : []
    if (off.length) out.push(`«${d.name}» cae en ${off.map(dn).join(' y ')}, fuera de tus días disponibles.`)
  }
  return out
}

export const activitiesToday = (activities: Activity[], now = new Date()) => activities.filter((a) => sameDay(a.ts, now))
export const sessionsToday = (sessions: Session[], now = new Date()) => sessions.filter((s) => sameDay(s.endedAt, now))
