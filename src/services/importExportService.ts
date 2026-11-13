import { TEMPLATES } from '../data/poses'
import { EXERCISES, MUSCLES, matchExercise, type Exercise } from '../data/exercises'
import type { BackupFile, CombatDiscipline, Intensity, PlanSlot, Profile, Routine, RoutineDay, RoutineExercise, SlotType, WeekPlan } from '../types'
import { normalize, uid } from '../lib/utils'
import { DISCIPLINES } from './combatService'
import { T } from './philosophyService'
import { buildDefaultPlan, errorsOf, plannedWeeklySets, validatePlan, volumeIssues, type PlanIssue } from './planningService'
import { estimateMinutes } from './workoutService'

export interface ImportIssue {
  level: 'error' | 'warning' | 'info'
  path: string
  message: string
  fix?: string
}
export interface ImportResult {
  routine?: Routine
  issues: ImportIssue[]
  format: 'json' | 'text'
}

type Obj = Record<string, unknown>
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Alias de campos (inglés/español) → clave canónica */
export const KEYS = {
  name: ['name', 'nombre', 'title', 'titulo', 'título'],
  goal: ['goal', 'objetivo', 'objective'],
  description: ['description', 'descripcion', 'descripción', 'summary'],
  days: ['days', 'dias', 'días', 'sessions', 'sesiones', 'workouts'],
  exercises: ['exercises', 'ejercicios'],
  muscle: ['muscle', 'musculo', 'músculo', 'muscleGroup', 'grupoMuscular', 'grupo'],
  sets: ['sets', 'series'],
  reps: ['reps', 'repeticiones', 'repetitions', 'repRange'],
  rest: ['rest', 'descanso', 'restSeconds', 'rest_seconds', 'restTime'],
  weight: ['recommendedWeight', 'peso', 'weight', 'pesoRecomendado', 'peso_recomendado'],
  notes: ['notes', 'notas', 'note', 'nota', 'tips'],
  weekdays: ['weekdays', 'weekday', 'dias_semana', 'diasSemana', 'schedule', 'diaSemana', 'dayOfWeek'],
} as const
const KNOWN = new Set<string>((Object.values(KEYS) as readonly (readonly string[])[]).flat().map((k) => k.toLowerCase()))
const isKnown = (k: string) => KNOWN.has(k.toLowerCase())

export function pick(o: Obj, group: readonly string[]): unknown {
  for (const k of group) if (k in o && o[k] !== null && o[k] !== undefined && o[k] !== '') return o[k]
  const lower = Object.keys(o).reduce<Record<string, string>>((a, k) => ((a[k.toLowerCase()] = k), a), {})
  for (const k of group) if (lower[k.toLowerCase()]) {
    const v = o[lower[k.toLowerCase()]]
    if (v !== null && v !== undefined && v !== '') return v
  }
  return undefined
}

const DAY_NAMES: Record<string, number> = {
  lunes: 0, lun: 0, monday: 0, mon: 0, martes: 1, mar: 1, tuesday: 1, tue: 1,
  miercoles: 2, mie: 2, wednesday: 2, wed: 2, jueves: 3, jue: 3, thursday: 3, thu: 3,
  viernes: 4, vie: 4, friday: 4, fri: 4, sabado: 5, sab: 5, saturday: 5, sat: 5,
  domingo: 6, dom: 6, sunday: 6, sun: 6,
}

export function parseWeekdays(v: unknown): number[] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,/;y&\s]+/) : typeof v === 'number' ? [v] : []
  const out = new Set<number>()
  for (const item of arr) {
    if (typeof item === 'number' && item >= 0 && item <= 6) out.add(Math.floor(item))
    else if (typeof item === 'string') {
      const n = normalize(item)
      if (n in DAY_NAMES) out.add(DAY_NAMES[n])
      else if (/^[0-6]$/.test(n)) out.add(parseInt(n, 10))
    }
  }
  return [...out].sort()
}

/** "90", "90s", "2 min", "1:30", "1,5 min" → segundos */
export function parseRest(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? (v > 0 && v <= 10 ? Math.round(v * 60) : Math.round(v)) : undefined
  if (typeof v !== 'string') return undefined
  const s = v.trim().toLowerCase().replace(',', '.')
  let m = s.match(/^(\d+):(\d{2})$/)
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
  m = s.match(/^(\d+(?:\.\d+)?)\s*(?:min|minutos?|m|')/)
  if (m) return Math.round(parseFloat(m[1]) * 60)
  m = s.match(/^(\d+(?:\.\d+)?)\s*(s|seg|segundos?|sec|")?$/)
  if (m) return Math.round(parseFloat(m[1]))
  return undefined
}

export function repairJson(raw: string): string {
  let s = raw.trim()
  const fence = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
  const first = s.search(/[{[]/)
  const last = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'))
  if (first > 0 || (last >= 0 && last < s.length - 1)) s = s.slice(Math.max(first, 0), last + 1)
  s = s.replace(/\/\/[^\n]*$/gm, '').replace(/,\s*([}\]])/g, '$1')
  return s
}

function normalizeExercise(raw: unknown, path: string, issues: ImportIssue[]): RoutineExercise | null {
  if (typeof raw === 'string') raw = { name: raw }
  if (!isObj(raw)) {
    issues.push({ level: 'error', path, message: 'El ejercicio no es un objeto.', fix: 'Cada ejercicio debe ser { "name": "...", "sets": 3, "reps": "8-10", "rest": 90 }.' })
    return null
  }
  const nameV = pick(raw, KEYS.name)
  const name = typeof nameV === 'string' ? nameV.trim() : ''
  if (!name) {
    issues.push({ level: 'error', path: `${path}.name`, message: 'Falta el nombre del ejercicio.', fix: 'Añade "name": "Press banca".' })
    return null
  }
  const lib = matchExercise(name)
  const musV = pick(raw, KEYS.muscle)
  let muscle = typeof musV === 'string' ? musV.trim() : ''
  if (!muscle) {
    muscle = lib?.primary ?? 'General'
    if (!lib) issues.push({ level: 'info', path: `${path}.muscle`, message: `"${name}" no indica grupo muscular; se usará "General".`, fix: 'Añade "muscle": "Pecho" si quieres estadísticas por músculo.' })
  }

  let sets = 3
  const setsV = pick(raw, KEYS.sets)
  if (setsV === undefined) issues.push({ level: 'warning', path: `${path}.sets`, message: `"${name}": faltan las series; se usarán 3.`, fix: 'Añade "sets": 4.' })
  else {
    const n = typeof setsV === 'number' ? setsV : parseInt(String(setsV), 10)
    if (!Number.isFinite(n) || n < 1 || n > 20) issues.push({ level: 'warning', path: `${path}.sets`, message: `"${name}": series no válidas (${JSON.stringify(setsV)}); se usarán 3.`, fix: 'Usa un número entero entre 1 y 20.' })
    else sets = Math.round(n)
  }

  let reps = '10'
  const repsV = pick(raw, KEYS.reps)
  if (repsV === undefined) issues.push({ level: 'warning', path: `${path}.reps`, message: `"${name}": faltan las repeticiones; se usarán 10.`, fix: 'Añade "reps": "8-10".' })
  else reps = String(repsV).trim().replace(/\s*(repeticiones|reps)\s*$/i, '')

  let rest = 90
  const restV = pick(raw, KEYS.rest)
  if (restV === undefined) issues.push({ level: 'info', path: `${path}.rest`, message: `"${name}": sin descanso; se usarán 90 s.`, fix: 'Añade "rest": 120 (segundos).' })
  else {
    const r = parseRest(restV)
    if (r === undefined || r < 0 || r > 1200) issues.push({ level: 'warning', path: `${path}.rest`, message: `"${name}": descanso no válido (${JSON.stringify(restV)}); se usarán 90 s.`, fix: 'Indica los segundos como número: "rest": 90.' })
    else {
      rest = r
      if (typeof restV === 'number' && restV > 0 && restV <= 10) issues.push({ level: 'info', path: `${path}.rest`, message: `"${name}": descanso ${restV} interpretado como minutos (${r} s).`, fix: 'Usa segundos para evitar ambigüedad.' })
    }
  }

  let recommendedWeight: number | undefined
  const wV = pick(raw, KEYS.weight)
  if (wV !== undefined) {
    const w = typeof wV === 'number' ? wV : parseFloat(String(wV).replace(',', '.'))
    if (Number.isFinite(w) && w >= 0) recommendedWeight = w
    else issues.push({ level: 'warning', path: `${path}.recommendedWeight`, message: `"${name}": peso no válido (${JSON.stringify(wV)}); se ignora.`, fix: 'Usa un número en kg: "recommendedWeight": 40.' })
  }

  const notesV = pick(raw, KEYS.notes)
  const notes = Array.isArray(notesV) ? notesV.join(' · ') : notesV !== undefined ? String(notesV) : undefined

  const extra: Obj = {}
  for (const k of Object.keys(raw)) if (!isKnown(k)) extra[k] = raw[k]
  if (lib && normalize(lib.name) !== normalize(name))
    issues.push({ level: 'info', path: `${path}.name`, message: `"${name}" se ha vinculado con "${lib.name}" de la biblioteca (animación disponible).` })
  if (!lib) issues.push({ level: 'info', path: `${path}.name`, message: `"${name}" no está en la biblioteca: se guarda igualmente, sin animación.` })

  return {
    id: uid(), exerciseId: lib?.id, name, muscle, sets, reps, rest,
    recommendedWeight, notes, extra: Object.keys(extra).length ? extra : undefined,
  }
}

function normalizeDay(raw: unknown, i: number, issues: ImportIssue[]): RoutineDay | null {
  const path = `days[${i}]`
  if (!isObj(raw)) {
    issues.push({ level: 'error', path, message: 'El día no es un objeto.', fix: 'Cada día debe ser { "name": "Día 1", "exercises": [ ... ] }.' })
    return null
  }
  const nameV = pick(raw, KEYS.name)
  const name = typeof nameV === 'string' && nameV.trim() ? nameV.trim() : `Día ${i + 1}`
  if (!nameV) issues.push({ level: 'warning', path: `${path}.name`, message: `El día ${i + 1} no tiene nombre; se llamará "${name}".`, fix: 'Añade "name": "Día 1 - Tren superior".' })
  const exV = pick(raw, KEYS.exercises)
  if (!Array.isArray(exV)) {
    issues.push({ level: 'error', path: `${path}.exercises`, message: `"${name}" no contiene una lista de ejercicios.`, fix: 'Añade "exercises": [ { "name": "Press banca", ... } ].' })
    return null
  }
  const exercises = exV.map((e, j) => normalizeExercise(e, `${path}.exercises[${j}]`, issues)).filter((e): e is RoutineExercise => !!e)
  if (!exercises.length) issues.push({ level: 'error', path: `${path}.exercises`, message: `"${name}" no tiene ejercicios válidos.`, fix: 'Revisa los errores de los ejercicios o añade alguno.' })
  const wdV = pick(raw, KEYS.weekdays)
  const weekdays = wdV !== undefined ? parseWeekdays(wdV) : []
  if (wdV !== undefined && !weekdays.length) issues.push({ level: 'warning', path: `${path}.weekdays`, message: `Días de la semana no reconocidos en "${name}".`, fix: 'Usa números 0–6 (0 = lunes) o nombres: ["Lunes", "Jueves"].' })
  const notesV = pick(raw, KEYS.notes)
  const extra: Obj = {}
  for (const k of Object.keys(raw)) if (!isKnown(k)) extra[k] = raw[k]
  return { id: uid(), name, weekdays, exercises, notes: notesV ? String(notesV) : undefined, extra: Object.keys(extra).length ? extra : undefined }
}

export function buildRoutine(raw: Obj, issues: ImportIssue[]): Routine | undefined {
  const nameV = pick(raw, KEYS.name)
  const name = typeof nameV === 'string' && nameV.trim() ? nameV.trim() : 'Rutina importada'
  if (!nameV) issues.push({ level: 'warning', path: 'name', message: 'La rutina no tiene nombre; se llamará "Rutina importada".', fix: 'Añade "name": "Mi rutina".' })
  const daysV = pick(raw, KEYS.days)
  if (!Array.isArray(daysV)) {
    issues.push({ level: 'error', path: 'days', message: 'No se encontró la lista "days".', fix: 'La rutina necesita "days": [ { "name": "...", "exercises": [ ... ] } ].' })
    return undefined
  }
  const days = daysV.map((d, i) => normalizeDay(d, i, issues)).filter((d): d is RoutineDay => !!d)
  if (!days.length) {
    issues.push({ level: 'error', path: 'days', message: 'Ningún día es válido, no hay nada que importar.', fix: 'Corrige los errores marcados y vuelve a pulsar Analizar.' })
    return undefined
  }
  const goalV = pick(raw, KEYS.goal)
  const descV = pick(raw, KEYS.description)
  const extra: Obj = {}
  for (const k of Object.keys(raw)) if (!isKnown(k)) extra[k] = raw[k]
  const now = Date.now()
  return {
    id: uid(), name, goal: goalV ? String(goalV) : undefined, description: descV ? String(descV) : undefined,
    days, createdAt: now, updatedAt: now, extra: Object.keys(extra).length ? extra : undefined,
  }
}

export function parseJsonRoutine(input: string): ImportResult {
  const issues: ImportIssue[] = []
  if (!input.trim()) {
    return { issues: [{ level: 'error', path: '', message: 'No hay texto que analizar.', fix: 'Pega aquí el JSON que te ha dado ChatGPT.' }], format: 'json' }
  }
  let data: unknown
  try {
    data = JSON.parse(repairJson(input))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const pos = msg.match(/position (\d+)/)
    issues.push({
      level: 'error', path: '',
      message: `El JSON no es válido: ${msg}`,
      fix: pos
        ? `Revisa cerca del carácter ${pos[1]}: suele faltar una coma, una comilla o un corchete. Pídele a ChatGPT: "devuélvelo solo como JSON válido".`
        : 'Comprueba comas, comillas dobles y llaves. Pídele a ChatGPT: "devuélvelo solo como JSON válido".',
    })
    return { issues, format: 'json' }
  }
  if (Array.isArray(data)) {
    if (data.length && data.every(isObj) && data.some((d) => pick(d as Obj, KEYS.exercises))) {
      issues.push({ level: 'info', path: '', message: 'Se recibió una lista de días sin envoltorio; se ha creado una rutina con ellos.' })
      data = { name: 'Rutina importada', days: data }
    } else if (data.length === 1 && isObj(data[0])) data = data[0]
    else {
      issues.push({ level: 'error', path: '', message: 'Se recibió una lista en la raíz.', fix: 'El JSON debe ser un objeto con "name" y "days". Si hay varias rutinas, impórtalas de una en una.' })
      return { issues, format: 'json' }
    }
  }
  if (!isObj(data)) {
    issues.push({ level: 'error', path: '', message: 'El JSON debe ser un objeto.', fix: 'Debe empezar por { "name": ..., "days": [...] }.' })
    return { issues, format: 'json' }
  }
  if (isObj(data.routine)) data = data.routine
  else if (Array.isArray(data.routines) && isObj(data.routines[0])) {
    if (data.routines.length > 1) issues.push({ level: 'warning', path: 'routines', message: `El archivo contiene ${data.routines.length} rutinas; se importa solo la primera.`, fix: 'Importa las demás una a una.' })
    data = data.routines[0]
  }
  const routine = buildRoutine(data as Obj, issues)
  return { routine, issues, format: 'json' }
}

// ---------- Texto estructurado ----------

const DAY_HEADER = /^\s*(?:#{1,4}\s*)?(?:\*\*)?\s*(?:d[ií]a|day|sesi[oó]n|session|workout|entrenamiento)\s*\d*\b.*$/i
const BULLET = /^\s*(?:[-*•·▪‣]|\d+[.)])\s+/

function cleanName(s: string): string {
  return s.replace(BULLET, '').replace(/[*_`]/g, '').replace(/\s*[-–—:|,(]+\s*$/, '').trim()
}

function parseExerciseLine(line: string): RoutineExercise | null {
  let l = line.replace(/\*\*/g, '').trim()
  if (l.includes('|')) {
    const cells = l.split('|').map((c) => c.trim()).filter(Boolean)
    if (cells.length >= 3 && !/^[-: ]+$/.test(cells[0]) && !/^(ejercicio|exercise)$/i.test(cells[0])) {
      const [name, a, b, c, d] = cells
      if (/^\d+$/.test(a)) return mk(cleanName(name), parseInt(a, 10), b, parseRest(c), d)
    }
    return null
  }
  let notes: string | undefined
  const paren = l.match(/\(([^)]{3,})\)\s*$/)
  if (paren && !/^\s*\d/.test(paren[1])) {
    notes = paren[1]
    l = l.replace(paren[0], '').trim()
  }
  const nota = l.match(/(?:[-–—]|;|\.)\s*(?:nota|notas|note|tip)s?\s*:\s*(.+)$/i)
  if (nota) {
    notes = nota[1]
    l = l.replace(nota[0], '').trim()
  }
  let sets: number | undefined
  let reps: string | undefined
  let name = ''
  const m1 = l.match(/(\d+)\s*[x×*]\s*((?:\d+(?:\s*[-–]\s*\d+(?!\d)(?!\s*(?:min|seg|s\b|m\b)))?)|AMRAP|fallo|\d+\s*(?:s|seg|min))/i)
  const m2 = l.match(/(\d+)\s*(?:series|sets)\s*(?:de|of|x|×)?\s*((?:\d+(?:\s*[-–]\s*\d+(?!\d)(?!\s*(?:min|seg|s\b|m\b)))?)|AMRAP|fallo)/i)
  const m = m1 ?? m2
  if (m && m.index !== undefined) {
    sets = parseInt(m[1], 10)
    reps = m[2].replace(/\s+/g, '').replace('–', '-')
    name = cleanName(l.slice(0, m.index))
    if (!name) name = cleanName(l.slice(m.index + m[0].length).split(/descanso|rest|peso|\d+\s*kg/i)[0])
    l = l.slice(m.index + m[0].length)
  } else return null
  const restM = l.match(/(?:descanso|desc\.?|rest|pausa)\s*:?\s*(\d+(?:[.,:]\d+)?\s*(?:min|minutos?|m|s|seg|segundos?|')?)/i) ?? l.match(/(?:[-–—,/·]\s*)(\d+(?:[.,]\d+)?\s*(?:min|minutos?|seg|segundos?|s))\b/i)
  const wM = l.match(/(?:peso\s*:?\s*)?(\d+(?:[.,]\d+)?)\s*(kg|kilos?)/i)
  return mk(name, sets!, reps!, restM ? parseRest(restM[1].trim()) : undefined, undefined, wM ? parseFloat(wM[1].replace(',', '.')) : undefined, notes)
}

function mk(name: string, sets: number, reps: string, rest?: number, notes?: string, weight?: number, notes2?: string): RoutineExercise | null {
  if (!name) return null
  const lib = matchExercise(name)
  const n = [notes, notes2].filter(Boolean).join(' · ') || undefined
  return {
    id: uid(), exerciseId: lib?.id, name, muscle: lib?.primary ?? 'General',
    sets, reps: String(reps), rest: rest ?? 90, recommendedWeight: weight, notes: n,
  }
}

export function parseTextRoutine(input: string): ImportResult {
  const issues: ImportIssue[] = []
  const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return { issues: [{ level: 'error', path: '', message: 'No hay texto que analizar.', fix: 'Pega la rutina en formato texto.' }], format: 'text' }
  let name = 'Rutina importada'
  let goal: string | undefined
  const days: RoutineDay[] = []
  let cur: RoutineDay | null = null
  for (const line of lines) {
    const kv = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').match(/^(rutina|routine|nombre|name|objetivo|goal|programa)\s*:\s*(.+)$/i)
    if (kv && !cur) {
      if (/objetivo|goal/i.test(kv[1])) goal = kv[2].trim()
      else name = kv[2].trim()
      continue
    }
    const ex = parseExerciseLine(line)
    if (ex) {
      if (!cur) {
        cur = { id: uid(), name: 'Día 1', weekdays: [], exercises: [] }
        days.push(cur)
        issues.push({ level: 'info', path: '', message: 'No se detectó cabecera de día antes del primer ejercicio; se creó "Día 1".' })
      }
      cur.exercises.push(ex)
      continue
    }
    const clean = line.replace(/\*\*/g, '').replace(/^#+\s*/, '').replace(/[:：]\s*$/, '').trim()
    if (DAY_HEADER.test(line) || (/^#{1,4}\s/.test(line) && clean.length < 60) || (/:\s*$/.test(line) && clean.length < 50 && !BULLET.test(line))) {
      const wd = parseWeekdays(clean.match(/\b(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi) ?? [])
      cur = { id: uid(), name: clean, weekdays: wd, exercises: [] }
      days.push(cur)
      continue
    }
    if (cur && cur.exercises.length === 0 && !cur.notes) { cur.notes = clean; continue }
    issues.push({ level: 'warning', path: '', message: `No se pudo interpretar la línea: "${line.slice(0, 80)}"`, fix: 'Usa el formato "Nombre - 4x8-10 - descanso 90s". Si no, usa JSON.' })
  }
  const valid = days.filter((d) => d.exercises.length)
  days.filter((d) => !d.exercises.length).forEach((d) => issues.push({ level: 'warning', path: '', message: `"${d.name}" no tiene ejercicios reconocidos y se descarta.`, fix: 'Cada ejercicio debe tener series × repeticiones, por ejemplo "Sentadilla 4x8".' }))
  if (!valid.length) {
    issues.push({ level: 'error', path: '', message: 'No se reconoció ningún ejercicio.', fix: 'Formato esperado:\nDía 1 - Tren superior\n- Press banca 4x8-10 descanso 120s\n- Remo con barra 3x10 descanso 90s' })
    return { issues, format: 'text' }
  }
  issues.push({ level: 'info', path: '', message: `Detectados ${valid.length} día(s) y ${valid.reduce((a, d) => a + d.exercises.length, 0)} ejercicio(s). Revísalos en la vista previa.` })
  const now = Date.now()
  return { routine: { id: uid(), name, goal, days: valid, createdAt: now, updatedAt: now }, issues, format: 'text' }
}

/** Detecta si es JSON o texto y analiza */
export function parseAuto(input: string): ImportResult {
  const t = input.trim()
  if (/^(```|\{|\[)/.test(t) || /"days"\s*:/.test(t)) return parseJsonRoutine(input)
  return parseTextRoutine(input)
}

export const hasErrors = (r: ImportResult) => !r.routine || r.issues.some((i) => i.level === 'error')

export function routineToJson(r: Routine) {
  return {
    name: r.name,
    ...(r.goal ? { goal: r.goal } : {}),
    ...(r.description ? { description: r.description } : {}),
    days: r.days.map((d) => ({
      name: d.name,
      ...(d.weekdays.length ? { weekdays: d.weekdays } : {}),
      exercises: d.exercises.map((e) => ({
        name: e.name, muscle: e.muscle, sets: e.sets, reps: e.reps, rest: e.rest,
        ...(e.recommendedWeight !== undefined ? { recommendedWeight: e.recommendedWeight } : {}),
        ...(e.notes ? { notes: e.notes } : {}),
        ...(e.extra ?? {}),
      })),
      ...(d.extra ?? {}),
    })),
    ...(r.extra ?? {}),
  }
}


// ═════════════════════════════════════════════════════════════
// Importación unificada: rutinas, planificación semanal, combate,
// planes híbridos completos y ejercicios personalizados.
// ═════════════════════════════════════════════════════════════

export interface ImportBundle {
  routine?: Routine
  /** Franjas de la semana importadas (se fusionan con el plan actual) */
  slots?: (PlanSlot & { gymRef?: string })[]
  customExercises?: Exercise[]
  athlete?: Partial<Profile>
  issues: ImportIssue[]
  format: 'json' | 'text'
}

const HYBRID_KEYS = ['week', 'weekPlan', 'plan', 'schedule', 'semana', 'planSemanal', 'mma', 'combat', 'combate', 'combatPlan', 'athlete', 'atleta', 'profile', 'customExercises', 'ejerciciosPersonalizados', 'custom_exercises', 'gym', 'gimnasio', 'schema', 'version', 'routine', 'routines']
const anyKey = (o: Obj, keys: string[]): unknown => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined }

const TYPE_ALIASES: [RegExp, SlotType][] = [
  [/^(gym|gimnasio|fuerza|pesas|strength)/, 'gym'],
  [/^(mma|combat|combate|contacto|striking|boxeo|kickboxing|muay|wrestling|grappling|bjj|jiu|brazilian|lucha|sparring)/, 'combat'],
  [/^(recovery|recuperacion|movilidad|mobility|active|descanso activo)/, 'recovery'],
  [/^(rest|descanso|off|libre)/, 'rest'],
]
const slotType = (v: unknown): SlotType | undefined => {
  const n = normalize(String(v ?? ''))
  return TYPE_ALIASES.find(([re]) => re.test(n))?.[1]
}
const parseIntensity = (v: unknown): Intensity | undefined => {
  const n = normalize(String(v ?? ''))
  if (/^(light|ligera|suave|baja|facil)/.test(n)) return 'light'
  if (/^(moderate|moderada|media|medio|normal)/.test(n)) return 'moderate'
  if (/^(hard|alta|dura|fuerte|intensa|high)/.test(n)) return 'hard'
  return undefined
}
const DISC_ALIASES: Record<string, CombatDiscipline> = {
  bjj: 'Brazilian Jiu-Jitsu', 'jiu jitsu': 'Brazilian Jiu-Jitsu', jiujitsu: 'Brazilian Jiu-Jitsu', 'muay thai': 'Kickboxing', box: 'Boxeo',
  lucha: 'Wrestling', takedowns: 'Wrestling', sumisiones: 'Grappling', defensa: 'Defensa y escapes', escapes: 'Defensa y escapes', transicion: 'Transiciones',
}
const matchDiscipline = (v: unknown): CombatDiscipline | undefined => {
  const n = normalize(String(v ?? ''))
  return DISCIPLINES.find((d) => normalize(d) === n) ?? DISC_ALIASES[n]
}
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean) : typeof v === 'string' ? v.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean) : []

function parseSlot(raw: unknown, path: string, issues: ImportIssue[], dayHint?: unknown, forceType?: SlotType): (PlanSlot & { gymRef?: string }) | null {
  if (typeof raw === 'string') raw = { type: raw }
  if (!isObj(raw)) { issues.push({ level: 'error', path, message: 'La franja no es un objeto.', fix: 'Usa { "day": "Lunes", "type": "gym", "label": "GYM A" }.' }); return null }
  const dayV = anyKey(raw, ['day', 'dia', 'día', 'weekday']) ?? dayHint
  const days = parseWeekdays(dayV)
  if (days.length !== 1) {
    issues.push({ level: 'error', path: `${path}.day`, message: days.length ? 'Cada franja debe tener un solo día.' : `Día no reconocido (${JSON.stringify(dayV)}).`, fix: 'Usa "day": "Lunes" (o un número 0–6, 0 = lunes).' })
    return null
  }
  const type = forceType ?? slotType(anyKey(raw, ['type', 'tipo', 'kind']) ?? anyKey(raw, ['label', 'name', 'nombre']))
  if (!type) {
    issues.push({ level: 'error', path: `${path}.type`, message: `Tipo de día no reconocido para el ${WEEKDAY_NAMES[days[0]]}.`, fix: 'Usa "type": "gym", "mma", "recovery" o "rest".' })
    return null
  }
  const defaults: Record<SlotType, string> = { gym: 'GYM', combat: 'MMA', recovery: 'RECUPERACIÓN', rest: 'DESCANSO COMPLETO' }
  const label = String(anyKey(raw, ['label', 'name', 'nombre', 'title']) ?? defaults[type])
  const focus = anyKey(raw, ['focus', 'enfoque', 'description', 'descripcion', 'notes', 'notas'])
  const slot: PlanSlot & { gymRef?: string } = { day: days[0], type, label, focus: focus ? String(focus) : undefined }
  const inten = anyKey(raw, ['intensity', 'intensidad'])
  if (inten !== undefined) {
    const i = parseIntensity(inten)
    if (i) slot.intensity = i
    else issues.push({ level: 'warning', path: `${path}.intensity`, message: `Intensidad no reconocida (${JSON.stringify(inten)}); se usará la predeterminada.`, fix: 'Usa "light", "moderate" o "hard".' })
  }
  if (type === 'combat') {
    const ds = list(anyKey(raw, ['disciplines', 'disciplinas', 'discipline', 'disciplina'])).map((d) => ({ d, m: matchDiscipline(d) }))
    for (const x of ds.filter((x) => !x.m)) issues.push({ level: 'warning', path: `${path}.disciplines`, message: `Disciplina «${x.d}» no reconocida.`, fix: `Usa: ${DISCIPLINES.join(', ')}.` })
    const minutes = Number(anyKey(raw, ['minutes', 'minutos', 'duration', 'duracion']))
    slot.combat = {
      disciplines: ds.map((x) => x.m).filter((m): m is CombatDiscipline => !!m),
      techniques: list(anyKey(raw, ['techniques', 'tecnicas', 'técnicas'])),
      minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined,
      sparring: anyKey(raw, ['sparring']) === true || /^(si|sí|true|yes)$/i.test(String(anyKey(raw, ['sparring']) ?? '')),
    }
    if (!slot.combat.techniques?.length) delete slot.combat.techniques
    slot.intensity ??= 'moderate'
  }
  const ref = anyKey(raw, ['gymDay', 'routineDay', 'diaRutina', 'workout'])
  if (type === 'gym') slot.gymRef = ref !== undefined ? String(ref) : label
  return slot
}

const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export function matchRoutineDay(ref: string, routine?: Routine): RoutineDay | undefined {
  if (!routine) return undefined
  const n = normalize(ref)
  if (!n) return undefined
  const byId = routine.days.find((d) => d.id === ref)
  if (byId) return byId
  const exact = routine.days.find((d) => normalize(d.name) === n)
  if (exact) return exact
  const tokens = n.split(' ').filter(Boolean)
  const hits = routine.days.filter((d) => { const t = normalize(d.name).split(' '); return tokens.every((x) => t.includes(x)) })
  return hits.length === 1 ? hits[0] : undefined
}

// ───────── Ejercicios personalizados ─────────
const ANIM_BY_MUSCLE: Record<string, string> = {
  Pecho: 'bench', Espalda: 'row', Hombros: 'ohp', 'Bíceps': 'curl', 'Tríceps': 'pushdown', 'Cuádriceps': 'squat', Isquiotibiales: 'hinge',
  'Glúteos': 'hipThrust', Gemelos: 'calf', Core: 'plank', Trapecio: 'shrug', Antebrazos: 'carry',
}
const slug = (s: string) => normalize(s).replace(/ /g, '-')

function parseCustomExercises(arr: unknown[], issues: ImportIssue[]): Exercise[] {
  const out: Exercise[] = []
  arr.forEach((raw, i) => {
    const path = `customExercises[${i}]`
    if (!isObj(raw)) { issues.push({ level: 'error', path, message: 'El ejercicio personalizado no es un objeto.', fix: 'Usa { "name": "...", "muscle": "Pecho", "equipment": ["Barra"] }.' }); return }
    const name = String(pick(raw, KEYS.name) ?? '').trim()
    if (!name) { issues.push({ level: 'error', path: `${path}.name`, message: 'Falta el nombre del ejercicio personalizado.', fix: 'Añade "name".' }); return }
    // Solo coincidencia EXACTA (nombre o alias): el emparejamiento difuso confundiría variantes legítimas
    const lib = EXERCISES.find((e) => [e.name, ...e.aliases].some((n) => normalize(n) === normalize(name)))
    if (lib) { issues.push({ level: 'info', path, message: `«${name}» ya existe en la biblioteca («${lib.name}»); se usa el de la biblioteca.` }); return }
    if (out.some((e) => normalize(e.name) === normalize(name))) return
    const mv = String(pick(raw, KEYS.muscle) ?? anyKey(raw, ['primary']) ?? '').trim()
    const muscle = MUSCLES.find((m) => normalize(m) === normalize(mv)) ?? (mv ? undefined : 'General')
    if (!muscle) issues.push({ level: 'warning', path: `${path}.muscle`, message: `Músculo «${mv}» no reconocido en «${name}»; se usará «General».`, fix: `Usa: ${MUSCLES.join(', ')}.` })
    const m = muscle ?? 'General'
    const animRaw = String(anyKey(raw, ['anim', 'animation']) ?? '')
    const step = Number(anyKey(raw, ['step', 'increment']))
    out.push({
      id: `custom-${slug(name)}`, name, aliases: list(anyKey(raw, ['aliases', 'alias'])), primary: m,
      secondary: list(anyKey(raw, ['secondary', 'secundarios', 'secondaryMuscles'])), equipment: list(anyKey(raw, ['equipment', 'equipamiento', 'material'])),
      anim: TEMPLATES[animRaw] ? animRaw : ANIM_BY_MUSCLE[m] ?? 'plank',
      steps: list(anyKey(raw, ['steps', 'pasos', 'instructions'])), tips: list(anyKey(raw, ['tips', 'consejos', 'notes', 'notas'])),
      step: Number.isFinite(step) && step >= 0 ? step : 2.5,
    })
  })
  return out
}

// ───────── Perfil de atleta ─────────
const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : undefined }

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

export function parseBundle(input: string, current?: { routine?: Routine }): ImportBundle {
  const t = input.trim()
  if (!t) return { issues: [{ level: 'error', path: '', message: 'No hay texto que analizar.', fix: 'Pega aquí el JSON que te ha dado ChatGPT.' }], format: 'json' }
  if (!/^(```|\{|\[)/.test(t) && !/"days"\s*:/.test(t)) {
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

  const customRaw = anyKey(root, ['customExercises', 'ejerciciosPersonalizados', 'custom_exercises'])
  if (Array.isArray(customRaw)) out.customExercises = parseCustomExercises(customRaw, issues)

  // Rutina de gimnasio
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
  if (routineRaw) out.routine = buildRoutine(routineRaw, issues)

  // Semana
  const slots: (PlanSlot & { gymRef?: string })[] = []
  const weekRaw = anyKey(root, ['week', 'weekPlan', 'plan', 'schedule', 'semana', 'planSemanal'])
  if (Array.isArray(weekRaw)) weekRaw.forEach((r, i) => { const s = parseSlot(r, `week[${i}]`, issues); if (s) slots.push(s) })
  else if (isObj(weekRaw)) Object.entries(weekRaw).forEach(([k, r]) => { const s = parseSlot(isObj(r) || typeof r === 'string' ? r : {}, `week.${k}`, issues, k); if (s) slots.push(s) })
  const mmaRaw = anyKey(root, ['mma', 'combat', 'combate', 'combatPlan'])
  const mmaList = Array.isArray(mmaRaw) ? mmaRaw : isObj(mmaRaw) && Array.isArray(mmaRaw.sessions) ? (mmaRaw.sessions as unknown[]) : []
  mmaList.forEach((r, i) => { const s = parseSlot(r, `mma[${i}]`, issues, undefined, 'combat'); if (s) { const k = slots.findIndex((x) => x.day === s.day); if (k >= 0) slots[k] = s; else slots.push(s) } })
  const seen = new Set<number>()
  const uniq = slots.filter((s) => { if (seen.has(s.day)) { issues.push({ level: 'warning', path: 'week', message: `El ${WEEKDAY_NAMES[s.day]} aparece más de una vez; se usa la primera.`, fix: 'Cada día de la semana admite una sola franja.' }); return false } seen.add(s.day); return true })
  if (uniq.length) out.slots = uniq

  // Atleta
  const ath = anyKey(root, ['athlete', 'atleta', 'profile'])
  if (isObj(ath)) { const a = parseAthlete(ath, issues); if (Object.keys(a).length) out.athlete = a }

  // Enlaza ejercicios de la rutina con los personalizados importados y las franjas de gimnasio con la rutina
  if (out.routine && out.customExercises?.length) {
    // Un ejercicio personalizado con el mismo nombre exacto manda sobre cualquier coincidencia difusa con la biblioteca
    for (const d of out.routine.days) for (const e of d.exercises) {
      const c = out.customExercises.find((x) => normalize(x.name) === normalize(e.name))
      if (c) { e.exerciseId = c.id; if (e.muscle === 'General') e.muscle = c.primary }
    }
  }
  const routineForRef = out.routine ?? current?.routine
  for (const s of out.slots ?? []) {
    if (s.type !== 'gym') { delete s.gymRef; continue }
    const d = matchRoutineDay(s.gymRef ?? s.label, routineForRef)
    if (d) s.routineDayId = d.id
    else if (routineForRef) issues.push({ level: 'warning', path: 'week', message: `No encuentro el día de rutina «${s.gymRef ?? s.label}» (${WEEKDAY_NAMES[s.day]}).`, fix: 'El "gymDay" debe coincidir con el nombre de un día de la rutina, p. ej. "GYM A".' })
    delete s.gymRef
  }

  if (!out.routine && !out.slots?.length && !out.customExercises?.length && !out.athlete && !issues.some((i) => i.level === 'error'))
    issues.push({ level: 'error', path: '', message: 'No se reconoce ninguna rutina, planificación semanal, sesión de combate ni ejercicio personalizado.', fix: 'Incluye al menos "days" (rutina), "week" (semana), "mma" (combate) o "customExercises".' })
  return out
}

// ───────── Comprobación de conflictos ─────────
export interface BundleAnalysis {
  issues: PlanIssue[]
  /** Plan resultante de fusionar la importación con el actual */
  plan?: WeekPlan
  /** Hay errores de recuperación en el plan propuesto: no se aplica la semana */
  planBlocked: boolean
  planChanged: boolean
}

export function analyzeBundle(bundle: ImportBundle, ctx: { profile: Profile; plan?: WeekPlan; routine?: Routine }): BundleAnalysis {
  const profile = { ...ctx.profile, ...bundle.athlete }
  const routine = bundle.routine ?? ctx.routine
  const base = ctx.plan ?? buildDefaultPlan(routine)
  const issues: PlanIssue[] = []
  let slots = base.slots.map((s) => ({ ...s }))
  let planChanged = false

  for (const s of bundle.slots ?? []) {
    planChanged = true
    const { gymRef: _g, ...clean } = s as PlanSlot & { gymRef?: string }; void _g
    slots = slots.map((x) => (x.day === s.day ? clean : x))
  }
  if (bundle.slots?.length) for (const d of [0, 1, 2, 3, 4, 5, 6]) if (!slots.some((s) => s.day === d)) slots.push({ day: d, type: 'rest', label: 'DESCANSO' })

  if (bundle.routine) {
    const ids = new Set(bundle.routine.days.map((d) => d.id))
    // Enlaces a días de otra rutina dejan de ser válidos
    slots = slots.map((s) => (s.routineDayId && !ids.has(s.routineDayId) ? { ...s, routineDayId: undefined } : s))
    if (!bundle.slots?.length) {
      const scheduled = bundle.routine.days.filter((d) => d.weekdays.length)
      for (const d of scheduled) for (const w of d.weekdays) {
        const cur = slots.find((s) => s.day === w)
        if (cur?.type === 'gym') { cur.routineDayId = d.id; planChanged = true }
        else if (cur) issues.push({ level: 'warning', code: 'ROUTINE_ON_NON_GYM', day: w, message: `«${d.name}» cae en ${WEEKDAY_NAMES[w]}, que está planificado como ${cur.type === 'combat' ? 'combate' : cur.type === 'rest' ? 'descanso completo' : 'recuperación'}: no se asigna.` })
      }
      // Sin días asignados: se enlazan por orden con las franjas de gimnasio libres
      if (!scheduled.length) {
        const free = slots.filter((s) => s.type === 'gym' && !s.routineDayId).sort((a, b) => a.day - b.day)
        free.forEach((s, i) => { const d = bundle.routine!.days[i]; if (d) { s.routineDayId = d.id; planChanged = true } })
        if (free.length) issues.push({ level: 'info', code: 'LINK_BY_ORDER', message: 'La rutina no trae días de la semana: se enlazan por orden con tus sesiones de gimnasio.' })
      }
    }
  }

  const plan: WeekPlan = { ...base, slots: slots.sort((a, b) => a.day - b.day), routineId: bundle.routine?.id ?? base.routineId, updatedAt: Date.now() }
  const planIssues = validatePlan(plan, profile, routine)
  issues.push(...planIssues)
  if (routine) {
    issues.push(...volumeIssues(plannedWeeklySets(routine, plan)))
    if (profile.sessionMinutes) {
      for (const s of plan.slots.filter((x) => x.type === 'gym')) {
        const d = routine.days.find((x) => x.id === s.routineDayId)
        if (d && estimateMinutes(d) > profile.sessionMinutes) issues.push({ level: 'warning', code: 'TOO_LONG', day: s.day, message: `«${d.name}» dura ~${estimateMinutes(d)} min y tu límite es ${profile.sessionMinutes} min (podrás acortarla al empezar).` })
      }
    }
  }
  const planBlocked = planChanged && errorsOf(planIssues).length > 0
  return { issues, plan, planBlocked, planChanged }
}

/** Resultado de aplicar la importación: el store lo persiste */
export interface AppliedBundle { routine?: Routine; plan?: WeekPlan; customExercises: Exercise[]; profilePatch?: Partial<Profile> }

export function applyBundle(bundle: ImportBundle, analysis: BundleAnalysis, opts: { includePlan: boolean }, syncWeekdays: (r: Routine, p: WeekPlan) => Routine): AppliedBundle {
  const plan = opts.includePlan && analysis.planChanged && !analysis.planBlocked ? analysis.plan : undefined
  let routine = bundle.routine
  if (routine && plan) routine = syncWeekdays(routine, plan)
  return { routine, plan, customExercises: bundle.customExercises ?? [], profilePatch: bundle.athlete }
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

// ═════════════ Formato para ChatGPT ═════════════

export const SCHEMA_EXAMPLE = `{
  "name": "Hipertrofia 4 días",
  "goal": "Muscle gain",
  "description": "Torso/pierna, 4 días por semana",
  "days": [
    {
      "name": "Día 1 - Tren superior",
      "weekdays": ["Lunes"],
      "exercises": [
        {
          "name": "Press banca",
          "muscle": "Pecho",
          "sets": 4,
          "reps": "8-10",
          "rest": 120,
          "recommendedWeight": 40,
          "notes": "Mantener control en la fase excéntrica"
        }
      ]
    }
  ]
}`

export const HYBRID_EXAMPLE = `{
  "athlete": { "type": "Balanced Hybrid Athlete", "primaryDiscipline": "MMA", "gymSessions": 3, "contactSessions": 2, "recoveryDays": 2, "deloadEveryWeeks": 5 },
  "name": "Hybrid Athlete",
  "days": [
    { "name": "GYM A — Tren superior", "exercises": [
      { "name": "Press banca", "muscle": "Pecho", "sets": 3, "reps": "6-8", "rest": 150 }
    ] }
  ],
  "week": [
    { "day": "Lunes", "type": "gym", "gymDay": "GYM A", "label": "GYM A", "focus": "Tren superior" },
    { "day": "Martes", "type": "mma", "label": "MMA", "focus": "Técnica y striking", "intensity": "light",
      "disciplines": ["Striking", "Grappling"], "minutes": 90, "sparring": false },
    { "day": "Miércoles", "type": "recovery", "label": "RECUPERACIÓN" },
    { "day": "Domingo", "type": "rest", "label": "DESCANSO COMPLETO" }
  ],
  "customExercises": [
    { "name": "Remo con apoyo en pecho", "muscle": "Espalda", "equipment": ["Mancuernas"], "steps": ["..."] }
  ]
}`

export function chatGptPrompt(): string {
  const names = EXERCISES.map((e) => e.name).join(', ')
  return `Actúa como entrenador personal de atletas híbridos (fuerza + deportes de combate). Devuélvela ÚNICAMENTE como un bloque de código JSON válido (sin texto antes ni después). Un único formato sirve para una rutina de gimnasio, una planificación de MMA, una semana híbrida completa y ejercicios personalizados. Usa solo las secciones que necesites:

${HYBRID_EXAMPLE}

Reglas:
- Rutina de gimnasio: "name", "goal" y "days" (cada día con "name" y "exercises"). Ejercicio: "name", "muscle" (Pecho, Espalda, Hombros, Bíceps, Tríceps, Cuádriceps, Isquiotibiales, Glúteos, Gemelos, Core, Trapecio, Antebrazos), "sets" (entero), "reps" (texto, p. ej. "8-10"), "rest" (SEGUNDOS), "recommendedWeight" (kg, opcional) y "notes" (opcional).
- Semana ("week"): una franja por día con "day" (Lunes…Domingo), "type" ("gym", "mma", "recovery" o "rest"), "label", "focus" y, si es gimnasio, "gymDay" con el nombre del día de la rutina. En combate: "disciplines" (Striking, Boxeo, Kickboxing, Wrestling, Brazilian Jiu-Jitsu, Grappling, Transiciones, Defensa y escapes), "techniques", "minutes", "intensity" ("light", "moderate" o "hard") y "sparring" (true/false). No asumas que todo el combate es intenso.
- También puedes dar solo las sesiones de combate en "mma": [ { "day": "Martes", ... } ].
- Reglas de recuperación que la app comprobará: al menos 2 días de recuperación/descanso y 1 de descanso completo; máximo 3 días de entrenamiento seguidos; no piernas pesadas justo antes de combate intenso; no dos días duros seguidos; máximo ${T.WEEKLY_SET_CAP} series semanales por músculo.
- "customExercises": solo ejercicios que no estén en esta lista: ${names}.
- JSON estricto: comillas dobles, sin comentarios y sin comas finales.

Mis datos: [edad, peso, nivel de experiencia, días disponibles, material, objetivo, lesiones, nivel de combate].`
}
