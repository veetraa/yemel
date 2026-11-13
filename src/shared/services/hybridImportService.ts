/**
 * hybridImportService — orquesta importaciones que tocan varios módulos (planificación híbrida completa),
 * comprueba conflictos de horario/volumen/recuperación y gestiona las copias de seguridad.
 * Cada parte se entrega a SU módulo: la rutina a Gym, las sesiones a Combat, el atleta al perfil.
 * Con `scope` se limita a un solo módulo (importación independiente de GYM o de COMBAT).
 */
import type { BackupFile, CombatPlan, CombatSlot, CombatSport, Profile, Routine, SlotType } from '../../types'
import { buildRoutine, matchRoutineDay, parseCustomExercises, parseTextRoutine, KEYS } from '../../modules/gym/services/gymImportService'
import { estimateMinutes } from '../../modules/gym/services/workoutService'
import type { Exercise } from '../../modules/gym/data/exercises'
import { COMBAT_EXAMPLE, COMBAT_KEYS, parseCombatSection, parseCombatSession } from '../../modules/combat/services/combatImportService'
import { WEEKDAY_NAMES, anyKey, isObj, num, pick, repairJson, type ImportIssue, type Obj } from '../lib/jsonImport'
import { normalize } from '../lib/utils'
import { T } from './principlesService'
import { DEFAULT_REST_DAYS, composeWeek, errorsOf, plannedWeeklySets, validatePlan, volumeIssues, type PlanIssue } from './planningService'

export type ImportScope = 'hybrid' | 'gym' | 'combat'

export interface WeekEntry { type: SlotType; day: number; gymRef?: string }

export interface ImportBundle {
  routine?: Routine
  customExercises?: Exercise[]
  /** `week` completa (reemplaza la semana): gym por referencia, combate y descansos */
  week?: { entries: WeekEntry[]; combat: CombatSlot[] }
  /** Sesiones de combate sueltas (se fusionan con las actuales) */
  combatSessions?: CombatSlot[]
  athlete?: Partial<Profile>
  issues: ImportIssue[]
  format: 'json' | 'text'
}

const HYBRID_KEYS = ['week', 'weekPlan', 'plan', 'schedule', 'semana', 'planSemanal', 'athlete', 'atleta', 'profile', 'customExercises', 'ejerciciosPersonalizados', 'custom_exercises', 'gym', 'gimnasio', 'schema', 'version', 'routine', 'routines', ...COMBAT_KEYS]
const WEEK_KEYS = ['week', 'weekPlan', 'plan', 'schedule', 'semana', 'planSemanal']

const TYPE_ALIASES: [RegExp, SlotType][] = [
  [/^(gym|gimnasio|fuerza|pesas|strength)/, 'gym'],
  [/^(mma|combat|combate|contacto|striking|boxeo|kickboxing|muay|wrestling|grappling|bjj|jiu|brazilian|lucha|sparring)/, 'combat'],
  [/^(recovery|recuperacion|movilidad|mobility|active|descanso activo)/, 'recovery'],
  [/^(rest|descanso|off|libre)/, 'rest'],
]
const slotType = (v: unknown): SlotType | undefined => TYPE_ALIASES.find(([re]) => re.test(normalize(String(v ?? ''))))?.[1]

// ───────── Perfil de atleta ─────────
function parseAthlete(raw: Obj, issues: ImportIssue[]): Partial<Profile> {
  const p: Partial<Profile> = {}
  const str = (keys: string[]) => { const v = anyKey(raw, keys); return v !== undefined ? String(v) : undefined }
  p.athleteType = str(['type', 'athleteType', 'tipo'])
  p.primaryDiscipline = str(['primaryDiscipline', 'discipline', 'disciplina', 'disciplinaPrincipal'])
  p.mainGoal = str(['goal', 'mainGoal', 'objetivo'])
  const g = anyKey(raw, ['gymSessions', 'gimnasio', 'weeklyGym']); if (g !== undefined) { const n = num(g, 1, 7); if (n) p.weeklyGoal = n; else issues.push({ level: 'warning', path: 'athlete.gymSessions', message: 'Sesiones de gimnasio no válidas (1-7).' }) }
  const c = anyKey(raw, ['contactSessions', 'combatSessions', 'contacto']); if (c !== undefined) { const n = num(c, 0, 7); if (n !== undefined) p.contactSessionsPerWeek = n; else issues.push({ level: 'warning', path: 'athlete.contactSessions', message: 'Sesiones de combate no válidas (0-7).' }) }
  const r = anyKey(raw, ['recoveryDays', 'recuperacion']); if (r !== undefined) { const n = num(r, 0, 7); if (n !== undefined) p.recoveryDaysPerWeek = n; else issues.push({ level: 'warning', path: 'athlete.recoveryDays', message: 'Días de recuperación no válidos (0-7).' }) }
  const d = anyKey(raw, ['deloadEveryWeeks', 'deload']); if (d !== undefined) {
    const n = num(d, 1, 52)
    if (n !== undefined) { p.deloadEveryWeeks = Math.min(T.DELOAD_WEEKS_MAX, Math.max(T.DELOAD_WEEKS_MIN, n)); if (p.deloadEveryWeeks !== n) issues.push({ level: 'info', path: 'athlete.deloadEveryWeeks', message: `La descarga se ajusta al rango ${T.DELOAD_WEEKS_MIN}-${T.DELOAD_WEEKS_MAX} semanas (${p.deloadEveryWeeks}).` }) }
  }
  const ci = anyKey(raw, ['conditioningIntegrated', 'preparacionFisicaIntegrada']); if (typeof ci === 'boolean') p.conditioningIntegrated = ci
  const sm = anyKey(raw, ['sessionMinutes', 'minutosSesion']); if (sm !== undefined) { const n = num(sm, 10, 300); if (n) p.sessionMinutes = n }
  const ex = normalize(str(['experience', 'level', 'nivel']) ?? '')
  if (/^(beginner|principiante)/.test(ex)) p.experience = 'beginner'; else if (/^(intermediate|intermedio)/.test(ex)) p.experience = 'intermediate'; else if (/^(advanced|avanzado)/.test(ex)) p.experience = 'advanced'
  for (const k of Object.keys(p) as (keyof Profile)[]) if (p[k] === undefined) delete p[k]
  return p
}

// ───────── Semana ─────────
function parseWeek(raw: unknown, issues: ImportIssue[], defaultSport: CombatSport): { entries: WeekEntry[]; combat: CombatSlot[] } {
  const entries: WeekEntry[] = []
  const combat: CombatSlot[] = []
  const items: [unknown, string, unknown?][] = Array.isArray(raw) ? raw.map((r, i) => [r, `week[${i}]`]) : isObj(raw) ? Object.entries(raw).map(([k, r]) => [r, `week.${k}`, k]) : []
  const seen = new Set<number>()
  for (const [r0, path, hint] of items) {
    const r = typeof r0 === 'string' ? { type: r0 } : isObj(r0) ? r0 : {}
    const dayV = anyKey(r, ['day', 'dia', 'día', 'weekday']) ?? hint
    const dayParsed = parseCombatSession({ day: dayV }, path, [], defaultSport)
    if (!dayParsed) { issues.push({ level: 'error', path: `${path}.day`, message: `Día no reconocido (${JSON.stringify(dayV)}).`, fix: 'Usa "day": "Lunes" (o un número 0–6, 0 = lunes).' }); continue }
    const day = dayParsed.day
    if (seen.has(day)) { issues.push({ level: 'warning', path: 'week', message: `El ${WEEKDAY_NAMES[day]} aparece más de una vez; se usa la primera.`, fix: 'Cada día de la semana admite una sola franja.' }); continue }
    const type = slotType(anyKey(r, ['type', 'tipo', 'kind']) ?? anyKey(r, ['label', 'name', 'nombre']))
    if (!type) { issues.push({ level: 'error', path: `${path}.type`, message: `Tipo de día no reconocido para el ${WEEKDAY_NAMES[day]}.`, fix: 'Usa "type": "gym", "mma", "recovery" o "rest".' }); continue }
    seen.add(day)
    if (type === 'combat') { const s = parseCombatSession(r, path, issues, defaultSport, day); if (s) combat.push(s) }
    entries.push({ type, day, gymRef: type === 'gym' ? String(anyKey(r, ['gymDay', 'routineDay', 'diaRutina', 'workout']) ?? anyKey(r, ['label', 'name', 'nombre']) ?? '') : undefined })
  }
  return { entries, combat }
}

const SCOPE_NOTE: Record<ImportScope, string> = { hybrid: '', gym: 'Esta importación es solo de GYM: ', combat: 'Esta importación es solo de COMBAT: ' }

export function parseBundle(input: string, current: { routine?: Routine; defaultSport?: CombatSport } = {}, scope: ImportScope = 'hybrid'): ImportBundle {
  const t = input.trim()
  const defaultSport = current.defaultSport ?? 'MMA'
  if (!t) return { issues: [{ level: 'error', path: '', message: 'No hay texto que analizar.', fix: 'Pega aquí el JSON que te ha dado ChatGPT.' }], format: 'json' }
  if (!/^(```|\{|\[)/.test(t) && !/"days"\s*:/.test(t)) {
    if (scope === 'combat') return { issues: [{ level: 'error', path: '', message: 'El texto estructurado solo sirve para rutinas de gimnasio.', fix: 'Usa JSON con "sessions" para combate, o importa la rutina desde GYM.' }], format: 'text' }
    const r = parseTextRoutine(input)
    return { routine: r.routine, issues: r.issues, format: 'text' }
  }
  const issues: ImportIssue[] = []
  let data: unknown
  try { data = JSON.parse(repairJson(input)) } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const pos = msg.match(/position (\d+)/)
    return { issues: [{ level: 'error', path: '', message: `El JSON no es válido: ${msg}`, fix: pos ? `Revisa cerca del carácter ${pos[1]}: suele faltar una coma, una comilla o un corchete. Pídele a ChatGPT: "devuélvelo solo como JSON válido".` : 'Comprueba comas, comillas dobles y llaves. Pídele a ChatGPT: "devuélvelo solo como JSON válido".' }], format: 'json' }
  }
  if (Array.isArray(data)) {
    const objs = data.filter(isObj)
    if (objs.length && objs.every((d) => pick(d, KEYS.exercises))) { issues.push({ level: 'info', path: '', message: 'Se recibió una lista de días sin envoltorio; se ha creado una rutina con ellos.' }); data = { name: 'Rutina importada', days: data } }
    else if (objs.length && objs.every((d) => anyKey(d, ['day', 'dia', 'día']) !== undefined)) data = { week: data }
    else if (data.length === 1 && isObj(data[0])) data = data[0]
    else return { issues: [{ level: 'error', path: '', message: 'Se recibió una lista en la raíz.', fix: 'El JSON debe ser un objeto: { "name": ..., "days": [...], "week": [...] }.' }], format: 'json' }
  }
  if (!isObj(data)) return { issues: [{ level: 'error', path: '', message: 'El JSON debe ser un objeto.', fix: 'Debe empezar por { ... }.' }], format: 'json' }
  let root: Obj = data
  if (isObj(root.hybrid)) root = root.hybrid as Obj

  const out: ImportBundle = { issues, format: 'json' }
  const wantGym = scope !== 'combat'
  const wantCombat = scope !== 'gym'
  const ignored: string[] = []

  // ── GYM ──
  const gym = anyKey(root, ['gym', 'gimnasio'])
  const rest: Obj = {}
  for (const k of Object.keys(root)) if (!HYBRID_KEYS.includes(k)) rest[k] = root[k]
  let routineRaw: Obj | undefined
  if (Array.isArray(pick(rest, KEYS.days))) routineRaw = rest
  else if (isObj(gym) && Array.isArray(pick(gym, KEYS.days))) routineRaw = { ...rest, ...gym }
  else if (isObj(root.routine)) routineRaw = root.routine as Obj
  else if (Array.isArray(root.routines) && isObj(root.routines[0])) {
    if (root.routines.length > 1) issues.push({ level: 'warning', path: 'routines', message: `El archivo contiene ${root.routines.length} rutinas; se importa solo la primera.`, fix: 'Importa las demás una a una.' })
    routineRaw = root.routines[0] as Obj
  }
  const customRaw = anyKey(root, ['customExercises', 'ejerciciosPersonalizados', 'custom_exercises'])
  if (wantGym) {
    if (Array.isArray(customRaw)) out.customExercises = parseCustomExercises(customRaw, issues)
    if (routineRaw) out.routine = buildRoutine(routineRaw, issues)
  } else if (routineRaw || customRaw) ignored.push('rutinas y ejercicios de gimnasio (impórtalos desde GYM)')

  // ── COMBAT / semana ──
  const weekRaw = anyKey(root, WEEK_KEYS)
  if (wantCombat) {
    const sessions = parseCombatSection(root, issues, defaultSport)
    if (sessions.length) out.combatSessions = sessions
    if (weekRaw !== undefined && scope === 'hybrid') out.week = parseWeek(weekRaw, issues, defaultSport)
    else if (weekRaw !== undefined && scope === 'combat') {
      const w = parseWeek(weekRaw, issues, defaultSport)
      if (w.combat.length) { out.combatSessions = [...(out.combatSessions ?? []), ...w.combat.filter((c) => !(out.combatSessions ?? []).some((x) => x.day === c.day))]; issues.push({ level: 'info', path: 'week', message: 'Se importan solo las franjas de combate de la semana; los días de gimnasio pertenecen a GYM.' }) }
    }
  } else if (weekRaw !== undefined || anyKey(root, COMBAT_KEYS) !== undefined) ignored.push('semana y sesiones de combate (impórtalas desde COMBAT)')

  // ── Perfil (solo planificación híbrida completa) ──
  const ath = anyKey(root, ['athlete', 'atleta', 'profile'])
  if (scope === 'hybrid' && isObj(ath)) { const a = parseAthlete(ath, issues); if (Object.keys(a).length) out.athlete = a }
  else if (isObj(ath)) ignored.push('datos de atleta (se importan desde Perfil → importación híbrida)')

  if (ignored.length) issues.push({ level: 'info', path: '', message: `${SCOPE_NOTE[scope]}se ignora: ${ignored.join('; ')}.` })

  // Un ejercicio personalizado con el mismo nombre exacto manda sobre cualquier coincidencia difusa con la biblioteca
  if (out.routine && out.customExercises?.length) {
    for (const d of out.routine.days) for (const e of d.exercises) {
      const c = out.customExercises.find((x) => normalize(x.name) === normalize(e.name))
      if (c) { e.exerciseId = c.id; if (e.muscle === 'General') e.muscle = c.primary }
    }
  }
  if (!out.routine && !out.week && !out.combatSessions?.length && !out.customExercises?.length && !out.athlete && !issues.some((i) => i.level === 'error')) {
    const hint = scope === 'gym' ? 'Incluye "days" (rutina) o "customExercises".' : scope === 'combat' ? 'Incluye "sessions" o "mma": [ { "day": "Martes", "sport": "MMA" } ].' : 'Incluye al menos "days" (rutina), "week" (semana), "mma" (combate) o "customExercises".'
    issues.push({ level: 'error', path: '', message: `${SCOPE_NOTE[scope]}no se reconoce nada importable.`, fix: hint })
  }
  return out
}

// ───────── Comprobación de conflictos ─────────
export interface BundleAnalysis {
  issues: PlanIssue[]
  /** Rutina resultante (con los días asignados) y sesiones de combate/descansos resultantes */
  routine?: Routine
  combatPlan?: CombatPlan
  restDays?: number[]
  /** La importación toca la semana (días de gimnasio, combate o descansos) */
  weekChanged: boolean
  /** La semana propuesta rompe las reglas de recuperación: no se aplica */
  weekBlocked: boolean
}

export function analyzeBundle(bundle: ImportBundle, ctx: { profile: Profile; routine?: Routine; combatPlan?: CombatPlan }): BundleAnalysis {
  const profile = { ...ctx.profile, ...bundle.athlete }
  let routine = bundle.routine ?? ctx.routine
  let sessions = (ctx.combatPlan?.sessions ?? []).map((s) => ({ ...s }))
  let restDays = ctx.profile.restDays ?? DEFAULT_REST_DAYS
  const issues: PlanIssue[] = []
  let weekChanged = false

  if (bundle.week && routine) {
    weekChanged = true
    // Semana completa: la rutina pierde sus días y se vuelven a asignar; combate y descansos se reemplazan
    routine = { ...routine, days: routine.days.map((d) => ({ ...d, weekdays: [] })) }
    for (const e of bundle.week.entries.filter((x) => x.type === 'gym')) {
      const d = matchRoutineDay(e.gymRef ?? '', routine)
      if (!d) { issues.push({ level: 'warning', code: 'GYM_REF', day: e.day, message: `No encuentro el día de rutina «${e.gymRef}» (${WEEKDAY_NAMES[e.day]}).` }); continue }
      routine = { ...routine, days: routine.days.map((x) => (x.id === d.id ? { ...x, weekdays: [...x.weekdays, e.day].sort() } : x)) }
    }
    sessions = bundle.week.combat
    restDays = bundle.week.entries.filter((x) => x.type === 'rest').map((x) => x.day)
  } else if (bundle.week) {
    weekChanged = true
    sessions = bundle.week.combat
    restDays = bundle.week.entries.filter((x) => x.type === 'rest').map((x) => x.day)
  }
  if (bundle.combatSessions?.length) {
    weekChanged = true
    const days = new Set(bundle.combatSessions.map((s) => s.day))
    sessions = [...sessions.filter((s) => !days.has(s.day)), ...bundle.combatSessions].sort((a, b) => a.day - b.day)
  }
  if (bundle.routine && !bundle.week && bundle.routine.days.some((d) => d.weekdays.length)) weekChanged = true

  const combatPlan: CombatPlan = { sessions, updatedAt: Date.now() }
  const week = composeWeek(routine, combatPlan, { restDays })
  const weekIssues = validatePlan(week, { ...profile, restDays }, routine)
  issues.push(...weekIssues)
  if (routine) {
    issues.push(...volumeIssues(plannedWeeklySets(routine, week)))
    if (profile.sessionMinutes) {
      for (const d of routine.days.filter((x) => x.weekdays.length)) {
        if (estimateMinutes(d) > profile.sessionMinutes) issues.push({ level: 'warning', code: 'TOO_LONG', message: `«${d.name}» dura ~${estimateMinutes(d)} min y tu límite es ${profile.sessionMinutes} min (podrás acortarla al empezar).` })
      }
    }
  }
  return { issues, routine, combatPlan, restDays, weekChanged, weekBlocked: weekChanged && errorsOf(weekIssues).length > 0 }
}

/** Lo que se entrega a cada módulo al aplicar la importación */
export interface AppliedBundle { routine?: Routine; combatPlan?: CombatPlan; customExercises: Exercise[]; profilePatch?: Partial<Profile> }

export function applyBundle(bundle: ImportBundle, analysis: BundleAnalysis, opts: { includeWeek: boolean }): AppliedBundle {
  const useWeek = opts.includeWeek && analysis.weekChanged && !analysis.weekBlocked
  let routine = bundle.routine
  if (routine && !useWeek) routine = { ...routine, days: routine.days.map((d) => ({ ...d, weekdays: [] })) } // sin días asignados
  if (useWeek && analysis.routine && (bundle.routine || bundle.week)) routine = analysis.routine
  const patch: Partial<Profile> = { ...(bundle.athlete ?? {}) }
  if (useWeek && analysis.restDays && bundle.week) patch.restDays = analysis.restDays
  return {
    routine, combatPlan: useWeek && (bundle.week || bundle.combatSessions?.length) ? analysis.combatPlan : undefined,
    customExercises: bundle.customExercises ?? [], profilePatch: Object.keys(patch).length ? patch : undefined,
  }
}

// ═════════════ Copias de seguridad ═════════════

export function parseBackup(text: string): { ok: true; data: BackupFile } | { ok: false; message: string } {
  let data: BackupFile
  try { data = JSON.parse(text) } catch { return { ok: false, message: 'El archivo no es un JSON válido.' } }
  if (data?.app !== 'forma' || !Array.isArray(data.routines) || !Array.isArray(data.sessions)) return { ok: false, message: 'No parece una copia de seguridad de Forma.' }
  return { ok: true, data }
}

export function mergeById<T extends { id: string }>(incoming: T[] | undefined, current: T[], mode: 'merge' | 'replace'): T[] {
  const inc = incoming ?? []
  return mode === 'replace' ? inc : [...inc, ...current.filter((c) => !inc.some((x) => x.id === c.id))]
}

// ═════════════ Formato híbrido para ChatGPT ═════════════

export const HYBRID_EXAMPLE = `{
  "athlete": { "type": "Balanced Hybrid Athlete", "primaryDiscipline": "MMA", "gymSessions": 3, "contactSessions": 2, "recoveryDays": 2, "deloadEveryWeeks": 5 },
  "name": "Hybrid Athlete",
  "days": [
    { "name": "GYM A — Tren superior", "exercises": [
      { "name": "Press banca", "muscle": "Pecho", "sets": 3, "reps": "6-8", "rest": 150 }
    ] }
  ],
  "week": [
    { "day": "Lunes", "type": "gym", "gymDay": "GYM A" },
    { "day": "Martes", "type": "mma", "label": "MMA", "focus": "Técnica y striking", "intensity": "light",
      "areas": ["Striking", "Grappling"], "minutes": 90, "sparring": false },
    { "day": "Miércoles", "type": "recovery" },
    { "day": "Domingo", "type": "rest" }
  ],
  "customExercises": [
    { "name": "Remo con apoyo en pecho", "muscle": "Espalda", "equipment": ["Mancuernas"], "steps": ["..."] }
  ]
}`

export function chatGptPrompt(): string {
  return `Actúa como entrenador de atletas híbridos (fuerza + deportes de combate). Devuelve ÚNICAMENTE un bloque de código JSON válido (sin texto antes ni después). La app separa los datos: la rutina de musculación va a GYM, las sesiones a COMBAT y "athlete" al perfil. Usa solo las secciones que necesites:

${HYBRID_EXAMPLE}

Reglas:
- Rutina de gimnasio ("days"): cada día con "name" y "exercises"; ejercicio: "name", "muscle" (Pecho, Espalda, Hombros, Bíceps, Tríceps, Cuádriceps, Isquiotibiales, Glúteos, Gemelos, Core, Trapecio, Antebrazos), "sets", "reps" (texto), "rest" (SEGUNDOS), "recommendedWeight" (opcional) y "notes".
- Semana ("week"): una franja por día con "day" y "type" ("gym", "mma", "recovery" o "rest"). Gimnasio: "gymDay" con el nombre del día de la rutina. Combate: "sport" (MMA, Brazilian Jiu-Jitsu, Boxeo, Kickboxing, Wrestling), "areas", "minutes", "intensity" ("light", "moderate", "hard") y "sparring" (true/false). No asumas que todo el combate es intenso.
- Reglas de recuperación que la app comprobará: al menos 2 días de recuperación/descanso y 1 de descanso completo; máximo 3 días de entrenamiento seguidos; no piernas pesadas justo antes de combate intenso; no dos días duros seguidos; máximo ${T.WEEKLY_SET_CAP} series semanales por músculo.
- JSON estricto: comillas dobles, sin comentarios y sin comas finales.

Mis datos: [edad, peso, nivel de experiencia, días disponibles, material, objetivo, lesiones, nivel de combate].`
}

export { COMBAT_EXAMPLE }
