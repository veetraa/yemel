/**
 * combatImportService — importación EXCLUSIVA de sesiones/planificación de combate.
 * No conoce nada de Gym ni de Filosofía.
 */
import type { CombatDiscipline, CombatSlot, CombatSport, Intensity } from '../../../types'
import { normalize } from '../../../shared/lib/utils'
import { WEEKDAY_NAMES, anyKey, isObj, list, parseWeekdays, repairJson, type ImportIssue, type Obj } from '../../../shared/lib/jsonImport'
import { DISCIPLINES, COMBAT_SECTIONS } from './combatService'

export const parseIntensity = (v: unknown): Intensity | undefined => {
  const n = normalize(String(v ?? ''))
  if (/^(light|ligera|suave|baja|facil)/.test(n)) return 'light'
  if (/^(moderate|moderada|media|medio|normal)/.test(n)) return 'moderate'
  if (/^(hard|alta|dura|fuerte|intensa|high)/.test(n)) return 'hard'
  return undefined
}

const AREA_ALIASES: Record<string, CombatDiscipline> = {
  bjj: 'Brazilian Jiu-Jitsu', 'jiu jitsu': 'Brazilian Jiu-Jitsu', jiujitsu: 'Brazilian Jiu-Jitsu', 'muay thai': 'Kickboxing', box: 'Boxeo',
  lucha: 'Wrestling', takedowns: 'Wrestling', sumisiones: 'Grappling', defensa: 'Defensa y escapes', escapes: 'Defensa y escapes', transicion: 'Transiciones',
}
export const matchArea = (v: unknown): CombatDiscipline | undefined => {
  const n = normalize(String(v ?? ''))
  return DISCIPLINES.find((d) => normalize(d) === n) ?? AREA_ALIASES[n]
}

const SPORT_ALIASES: [RegExp, CombatSport][] = [
  [/^(mma|artes marciales mixtas)/, 'MMA'],
  [/^(bjj|jiu|brazilian|jiujitsu)/, 'Brazilian Jiu-Jitsu'],
  [/^(box)/, 'Boxeo'],
  [/^(kick|muay|k1)/, 'Kickboxing'],
  [/^(wrest|lucha)/, 'Wrestling'],
]
export const matchSport = (v: unknown): CombatSport | undefined => {
  const n = normalize(String(v ?? ''))
  return COMBAT_SECTIONS.find((s) => normalize(s) === n) ?? SPORT_ALIASES.find(([re]) => re.test(n))?.[1]
}

/** Una sesión de combate planificada. `defaultSport` se usa si el JSON no indica deporte. */
export function parseCombatSession(raw: unknown, path: string, issues: ImportIssue[], defaultSport: CombatSport, dayHint?: unknown): CombatSlot | null {
  if (!isObj(raw)) { issues.push({ level: 'error', path, message: 'La sesión de combate no es un objeto.', fix: 'Usa { "day": "Martes", "sport": "MMA", "intensity": "light" }.' }); return null }
  const dayV = anyKey(raw, ['day', 'dia', 'día', 'weekday']) ?? dayHint
  const days = parseWeekdays(dayV)
  if (days.length !== 1) {
    issues.push({ level: 'error', path: `${path}.day`, message: days.length ? 'Cada sesión debe tener un solo día.' : `Día no reconocido (${JSON.stringify(dayV)}).`, fix: 'Usa "day": "Martes" (o un número 0–6, 0 = lunes).' })
    return null
  }
  const sportV = anyKey(raw, ['sport', 'deporte', 'discipline', 'disciplina'])
  let sport = defaultSport
  if (sportV !== undefined) {
    const m = matchSport(sportV)
    if (m) sport = m
    else issues.push({ level: 'warning', path: `${path}.sport`, message: `Deporte «${String(sportV)}» no reconocido; se usará ${defaultSport}.`, fix: `Usa: ${COMBAT_SECTIONS.join(', ')}.` })
  }
  const areaRaw = list(anyKey(raw, ['areas', 'disciplines', 'disciplinas', 'focusAreas']))
  const areas = areaRaw.map((a) => ({ a, m: matchArea(a) }))
  for (const x of areas.filter((x) => !x.m)) issues.push({ level: 'warning', path: `${path}.areas`, message: `Área «${x.a}» no reconocida.`, fix: `Usa: ${DISCIPLINES.join(', ')}.` })
  const iv = anyKey(raw, ['intensity', 'intensidad'])
  let intensity: Intensity = 'moderate'
  if (iv !== undefined) {
    const i = parseIntensity(iv)
    if (i) intensity = i
    else issues.push({ level: 'warning', path: `${path}.intensity`, message: `Intensidad no reconocida (${JSON.stringify(iv)}); se usará moderada.`, fix: 'Usa "light", "moderate" o "hard". No se asume que todo el combate es intenso.' })
  }
  const minutes = Number(anyKey(raw, ['minutes', 'minutos', 'duration', 'duracion']))
  const sp = anyKey(raw, ['sparring'])
  const focus = anyKey(raw, ['focus', 'enfoque', 'description', 'descripcion', 'notes', 'notas'])
  return {
    day: days[0], sport, label: String(anyKey(raw, ['label', 'name', 'nombre', 'title']) ?? sport), focus: focus ? String(focus) : undefined,
    intensity, areas: areas.map((x) => x.m).filter((m): m is CombatDiscipline => !!m),
    sparring: sp === true || /^(si|sí|true|yes)$/i.test(String(sp ?? '')),
    minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined,
  }
}

export const COMBAT_KEYS = ['mma', 'combat', 'combate', 'combatPlan', 'sessions', 'sesiones']

/** Sección de sesiones de combate de un JSON (array o { sessions: [...] }) */
export function parseCombatSection(root: Obj, issues: ImportIssue[], defaultSport: CombatSport): CombatSlot[] {
  const raw = anyKey(root, COMBAT_KEYS)
  const arr = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.sessions) ? (raw.sessions as unknown[]) : []
  const out: CombatSlot[] = []
  arr.forEach((r, i) => { const s = parseCombatSession(r, `mma[${i}]`, issues, defaultSport); if (s) { const k = out.findIndex((x) => x.day === s.day); if (k >= 0) out[k] = s; else out.push(s) } })
  return out
}

export interface CombatImportResult { sessions: CombatSlot[]; issues: ImportIssue[] }

/** Importación independiente de COMBAT (solo lee sesiones de combate; ignora todo lo demás con aviso). */
export function parseCombatImport(input: string, defaultSport: CombatSport): CombatImportResult {
  const issues: ImportIssue[] = []
  const t = input.trim()
  if (!t) return { sessions: [], issues: [{ level: 'error', path: '', message: 'No hay texto que analizar.', fix: 'Pega aquí el JSON que te ha dado ChatGPT.' }] }
  let data: unknown
  try { data = JSON.parse(repairJson(input)) } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { sessions: [], issues: [{ level: 'error', path: '', message: `El JSON no es válido: ${msg}`, fix: 'Comprueba comas, comillas dobles y llaves. Pídele a ChatGPT: "devuélvelo solo como JSON válido".' }] }
  }
  if (Array.isArray(data)) data = { sessions: data }
  if (!isObj(data)) return { sessions: [], issues: [{ level: 'error', path: '', message: 'El JSON debe ser un objeto o una lista de sesiones.', fix: 'Usa { "sessions": [ ... ] }.' }] }
  let sessions = parseCombatSection(data, issues, defaultSport)
  // Un `week` híbrido: solo se toman las franjas de combate
  const week = anyKey(data, ['week', 'weekPlan', 'schedule', 'semana'])
  if (!sessions.length && Array.isArray(week)) {
    sessions = week.flatMap((w, i) => {
      if (!isObj(w) || !/^(mma|combat|combate|striking|boxeo|kick|muay|wrest|grappling|bjj|jiu|brazilian)/.test(normalize(String(anyKey(w, ['type', 'tipo']) ?? '')))) return []
      const s = parseCombatSession(w, `week[${i}]`, issues, defaultSport); return s ? [s] : []
    })
    if (sessions.length) issues.push({ level: 'info', path: 'week', message: 'Se importan solo las franjas de combate de la semana; el resto pertenece a Gym.' })
  }
  if (isObj(data) && (Array.isArray(data.days) || Array.isArray(data.dias) || data.customExercises)) issues.push({ level: 'info', path: '', message: 'Las rutinas de gimnasio y los ejercicios de fuerza se ignoran aquí: impórtalos desde GYM.' })
  if (!sessions.length && !issues.some((i) => i.level === 'error')) issues.push({ level: 'error', path: '', message: 'No se encontró ninguna sesión de combate.', fix: 'Incluye "sessions" o "mma": [ { "day": "Martes", "sport": "MMA", "intensity": "light" } ].' })
  return { sessions, issues }
}

export const COMBAT_EXAMPLE = `{
  "sessions": [
    { "day": "Martes", "sport": "MMA", "label": "MMA técnico", "focus": "Striking y grappling básico",
      "intensity": "light", "areas": ["Striking", "Grappling"], "minutes": 90, "sparring": false },
    { "day": "Viernes", "sport": "Brazilian Jiu-Jitsu", "label": "BJJ", "intensity": "moderate",
      "areas": ["Defensa y escapes"], "minutes": 75, "sparring": true }
  ]
}`

export function combatPrompt(): string {
  return `Actúa como entrenador de deportes de contacto. Crea mi planificación semanal de combate y devuélvela ÚNICAMENTE como un bloque de código JSON válido (sin texto antes ni después) con este formato:

${COMBAT_EXAMPLE}

Reglas:
- "day": Lunes…Domingo. Una sola sesión por día.
- "sport": ${COMBAT_SECTIONS.join(', ')}.
- "areas": Striking, Boxeo, Kickboxing, Wrestling, Brazilian Jiu-Jitsu, Grappling, Transiciones, Defensa y escapes.
- "intensity": "light", "moderate" o "hard". No asumas que todo el combate es intenso: una sesión técnica es ligera.
- "sparring": true/false. "minutes": duración en minutos.
- NO incluyas rutinas de musculación: eso se importa en la sección GYM.
- JSON estricto: comillas dobles, sin comentarios y sin comas finales.

Mis datos: [edad, peso, nivel en cada deporte, días disponibles, objetivo, lesiones].`
}

export { WEEKDAY_NAMES }
