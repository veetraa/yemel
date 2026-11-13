/**
 * philosophyService — lógica propia de FILOSOFÍA: frase diaria, favoritos, diario y sugerencias.
 * No conoce nada de Gym ni de Combat; solo recibe, si hace falta, el indicador global de recuperación.
 */
import { dateKey, normalize, uid } from '../../../shared/lib/utils'
import { PHILOSOPHERS } from '../data/philosophers'
import { QUOTES } from '../data/quotes'
import { REFLECTIONS } from '../data/reflections'
import type { FavKind, JournalEntry, PhiloFavorites, PhiloTheme, Quote, Reflection } from '../types'

export const EMPTY_FAVORITES: PhiloFavorites = { quotes: [], philosophers: [], reflections: [] }

export const quoteById = (id?: string) => QUOTES.find((q) => q.id === id)
export const philosopherById = (id?: string) => PHILOSOPHERS.find((p) => p.id === id)
export const reflectionById = (id?: string) => REFLECTIONS.find((r) => r.id === id)

export function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

/** La frase del día es determinista: la misma para todo el día, y rota cada día. */
export function quoteOfDay(date = new Date(), theme?: PhiloTheme, offset = 0): Quote {
  const pool = theme ? QUOTES.filter((q) => q.themes.includes(theme)) : QUOTES
  const list = pool.length ? pool : QUOTES
  return list[(dayOfYear(date) + offset) % list.length]
}

/** Tema sugerido: con recuperación baja, calma y resiliencia; si no, rota por la semana. */
export function suggestedTheme(readiness: 'good' | 'moderate' | 'low' | 'unknown', date = new Date()): PhiloTheme {
  if (readiness === 'low') return 'calma'
  const rot: PhiloTheme[] = ['disciplina', 'autocontrol', 'resiliencia', 'accion']
  return rot[dayOfYear(date) % rot.length]
}

/** Reflexión sugerida según la hora del día y el indicador de recuperación */
export function suggestedReflection(date = new Date(), readiness: 'good' | 'moderate' | 'low' | 'unknown' = 'unknown'): Reflection {
  if (readiness === 'low') return reflectionById('calma')!
  const h = date.getHours()
  return reflectionById(h < 13 ? 'manana' : h >= 19 ? 'noche' : 'control')!
}

export function searchQuotes(q: string, theme?: PhiloTheme): Quote[] {
  const n = normalize(q)
  return QUOTES.filter((x) => (!theme || x.themes.includes(theme)) && (!n || normalize(`${x.text} ${x.author} ${x.work ?? ''}`).includes(n)))
}

// ───────── Favoritos ─────────
export const isFavorite = (f: PhiloFavorites, kind: FavKind, id: string) => f[kind].includes(id)
export function toggleFavorite(f: PhiloFavorites, kind: FavKind, id: string): PhiloFavorites {
  return { ...f, [kind]: f[kind].includes(id) ? f[kind].filter((x) => x !== id) : [id, ...f[kind]] }
}

// ───────── Diario ─────────
export function newEntry(init: Partial<JournalEntry> = {}): JournalEntry {
  return { id: uid(), ts: Date.now(), kind: 'free', text: '', ...init }
}

/** Una entrada vale si tiene texto o alguna respuesta */
export const isEntryEmpty = (e: Pick<JournalEntry, 'text' | 'prompts'>) => !e.text.trim() && !(e.prompts ?? []).some((p) => p.a.trim())

/** Días seguidos con diario (cuenta desde hoy o desde ayer) */
export function journalStreak(entries: JournalEntry[], now = new Date()): number {
  const days = new Set(entries.map((e) => dateKey(new Date(e.ts))))
  let d = new Date(now); d.setHours(12, 0, 0, 0)
  if (!days.has(dateKey(d))) d = new Date(d.getTime() - 86400000)
  let n = 0
  while (days.has(dateKey(d))) { n++; d = new Date(d.getTime() - 86400000) }
  return n
}

export function searchJournal(entries: JournalEntry[], q: string): JournalEntry[] {
  const n = normalize(q)
  if (!n) return entries
  return entries.filter((e) => normalize(`${e.title ?? ''} ${e.text} ${(e.prompts ?? []).map((p) => `${p.q} ${p.a}`).join(' ')}`).includes(n))
}

export const entryTitle = (e: JournalEntry) => e.title || (e.kind === 'reflection' ? reflectionById(e.reflectionId)?.title : undefined) || 'Entrada libre'
export const entryPreview = (e: JournalEntry) => (e.text.trim() || (e.prompts ?? []).map((p) => p.a.trim()).filter(Boolean).join(' · ')).slice(0, 140)
