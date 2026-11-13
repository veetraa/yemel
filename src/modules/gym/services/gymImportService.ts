/**
 * gymImportService — importación EXCLUSIVA de rutinas de musculación y ejercicios de fuerza personalizados.
 * No conoce nada de Combat ni de Filosofía.
 */
import { TEMPLATES } from '../data/poses'
import { EXERCISES, MUSCLES, matchExercise, type Exercise } from '../data/exercises'
import type { Routine, RoutineDay, RoutineExercise } from '../types'
import { normalize, uid } from '../../../shared/lib/utils'
import { anyKey, isObj, list, parseWeekdays, pick, repairJson, slug, type ImportIssue, type Obj } from '../../../shared/lib/jsonImport'
export type { ImportIssue }

export interface ImportResult {
  routine?: Routine
  issues: ImportIssue[]
  format: 'json' | 'text'
}

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

export function parseCustomExercises(arr: unknown[], issues: ImportIssue[]): Exercise[] {
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


export function gymChatGptPrompt(): string {
  const names = EXERCISES.map((e) => e.name).join(', ')
  return `Actúa como entrenador personal experto en fuerza e hipertrofia. Crea una rutina de MUSCULACIÓN y devuélvela ÚNICAMENTE como un bloque de código JSON válido (sin texto antes ni después), con exactamente este formato:

${SCHEMA_EXAMPLE}

Reglas del formato:
- "name": nombre de la rutina. "goal": objetivo (opcional).
- "days": lista de días de entrenamiento. Cada día tiene "name" y "exercises". "weekdays" es opcional (0 = lunes … 6 = domingo, o nombres en español).
- Cada ejercicio: "name" (texto), "muscle" (Pecho, Espalda, Hombros, Bíceps, Tríceps, Cuádriceps, Isquiotibiales, Glúteos, Gemelos, Core, Trapecio, Antebrazos), "sets" (número entero), "reps" (texto, por ejemplo "8-10" o "12"), "rest" (descanso en SEGUNDOS, número), "recommendedWeight" (kg, opcional) y "notes" (opcional).
- Usa preferiblemente estos nombres de ejercicio para que la app muestre su animación: ${names}.
- Si necesitas un ejercicio que no esté en la lista, descríbelo en "customExercises": [ { "name": "...", "muscle": "...", "equipment": ["..."], "steps": ["..."] } ].
- NO incluyas técnicas de combate (boxeo, jiu-jitsu, MMA…): eso va en la sección COMBAT.
- JSON estricto: comillas dobles, sin comentarios y sin comas finales.

Mis datos: [edad, peso, nivel de experiencia, días por semana, material disponible, objetivo, lesiones].`
}
