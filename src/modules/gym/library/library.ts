/**
 * Biblioteca unificada de ejercicios (GYM): una sola lista con identificadores estables.
 * Los datos se generan con `scripts/build-library.mjs` a partir de fuentes públicas (ver `sources.json`) y se
 * cargan bajo demanda: el índice (ligero) al abrir Ejercicios o importar, y la ficha completa al abrir cada ejercicio.
 */
import { normalize } from '../../../shared/lib/utils'
import { allExercises, customExercises, type Exercise } from '../data/exercises'

export interface LibIndexItem {
  id: string
  /** nombre en español */
  n: string
  /** nombre en inglés */
  en?: string
  /** grupo muscular */
  g: string
  e: string[]
  d: string | null
  /** imágenes: 1 = ilustraciones incluidas en la app, 2 = fotos de referencia en línea (bajo demanda), 0 = sin imagen */
  i: 0 | 1 | 2
  /** id en Free Exercise DB (fotos de referencia) */
  y?: string
  /** ejercicio propio de la app (id heredado, estable) */
  core?: 1
}

export interface LibExercise {
  id: string
  name: string
  nameEn?: string
  group: string
  primary: string
  secondary: string[]
  equipment: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null
  category: string | null
  summary: string | null
  setup: string[]
  steps: string[] | null
  cues: string[]
  mistakes: { m: string; c: string }[]
  breathing: string | null
  anatomy: string[]
  /** ilustraciones locales (nombres de archivo en data/library/img) */
  img: { start?: string; end?: string; main?: string } | null
  /** id en Free Exercise DB: fotos de referencia en línea */
  y: string | null
  /** vídeo de demostración con licencia verificada (ninguno por ahora) */
  video: { src: string; credit: string; license: string } | null
  sources: { id: string; ref: string }[]
}

const BASE = `${import.meta.env.BASE_URL}data/library/`
const YUH = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

let indexCache: LibIndexItem[] | null = null
let indexPromise: Promise<LibIndexItem[]> | null = null
const detailCache = new Map<string, LibExercise | null>()

export const libraryIndex = () => indexCache

export function loadLibraryIndex(): Promise<LibIndexItem[]> {
  if (indexCache) return Promise.resolve(indexCache)
  indexPromise ??= fetch(`${BASE}index.json`)
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<LibIndexItem[]> })
    .then((list) => { indexCache = list; rebuildNames(); return list })
    .catch(() => { indexPromise = null; return [] as LibIndexItem[] })
  return indexPromise
}

export async function loadLibraryExercise(id: string): Promise<LibExercise | null> {
  if (detailCache.has(id)) return detailCache.get(id) ?? null
  try {
    const r = await fetch(`${BASE}ex/${encodeURIComponent(id)}.json`)
    if (!r.ok) throw new Error(String(r.status))
    const d = (await r.json()) as LibExercise
    detailCache.set(id, d)
    return d
  } catch {
    return null
  }
}

export interface LibImages { start?: string; end?: string; main?: string; source: 'repdb' | 'yuhonas' }
/** Imágenes de una ficha: ilustraciones incluidas o fotos de referencia en línea (nunca de otro ejercicio). */
export function imagesOf(d: Pick<LibExercise, 'img' | 'y'> | null | undefined): LibImages | null {
  if (!d) return null
  if (d.img) return { source: 'repdb', ...Object.fromEntries(Object.entries(d.img).map(([k, v]) => [k, `${BASE}img/${v}`])) }
  if (d.y) return { source: 'yuhonas', start: `${YUH}${encodeURIComponent(d.y)}/0.jpg`, end: `${YUH}${encodeURIComponent(d.y)}/1.jpg` }
  return null
}
/** Miniatura ligera: solo las ilustraciones incluidas en la app (las fotos en línea no se piden en listados). */
export const thumbOf = (it: Pick<LibIndexItem, 'id' | 'i'>) => (it.i === 1 ? `${BASE}img/${it.id}-start.webp` : null)

// ── Coincidencia EXACTA por nombre (importación de rutinas) ──
interface Named { id: string; name: string; core?: Exercise; item?: LibIndexItem }
let names = new Map<string, Named[]>()
let seenCustom: Exercise[] | null = null
function rebuildNames() {
  seenCustom = customExercises()
  const m = new Map<string, Named[]>()
  const add = (key: string, v: Named) => { const k = normalize(key); if (!k) return; const a = m.get(k) ?? []; if (!a.some((x) => x.id === v.id)) a.push(v); m.set(k, a) }
  for (const e of allExercises()) { const v = { id: e.id, name: e.name, core: e }; add(e.name, v); e.aliases.forEach((a) => add(a, v)) }
  for (const it of indexCache ?? []) {
    if (it.core) { const c = allExercises().find((e) => e.id === it.id); if (c && it.en) add(it.en, { id: c.id, name: c.name, core: c }) } // nombre en inglés del ejercicio propio
    else { const v = { id: it.id, name: it.n, item: it }; add(it.n, v); if (it.en) add(it.en, v) }
  }
  names = m
}
rebuildNames()
const fresh = () => { if (customExercises() !== seenCustom) rebuildNames() }

export interface ExactMatch { id: string; name: string; core?: Exercise; item?: LibIndexItem }
/** Coincidencia exacta (nombre o alias, sin tildes ni mayúsculas). Si el nombre es ambiguo no devuelve nada. */
export function matchExact(name: string): ExactMatch | undefined {
  fresh()
  const a = names.get(normalize(name))
  return a?.length === 1 ? a[0] : undefined
}

/** Ejercicio parecido (solo para sugerir al usuario; nunca se asigna automáticamente). */
export function suggestSimilar(name: string): string | undefined {
  fresh()
  const t = new Set(normalize(name).split(' ').filter((w) => w.length > 2))
  if (t.size < 1) return undefined
  let best: { n: string; s: number } | undefined
  for (const [k, arr] of names) {
    const c = new Set(k.split(' ').filter((w) => w.length > 2))
    let inter = 0; t.forEach((w) => c.has(w) && inter++)
    const s = inter / Math.max(t.size, c.size)
    if (s >= 0.5 && s > (best?.s ?? 0)) best = { n: arr[0].name, s }
  }
  return best?.n
}

export const GROUPS = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquiotibiales', 'Glúteos', 'Gemelos', 'Core', 'Trapecio', 'Antebrazos'] as const
