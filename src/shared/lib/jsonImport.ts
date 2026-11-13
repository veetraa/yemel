/** Utilidades comunes de importación JSON (sin conocimiento de ningún módulo). */
import { normalize } from './utils'

export interface ImportIssue {
  level: 'error' | 'warning' | 'info'
  path: string
  message: string
  fix?: string
}


export type Obj = Record<string, unknown>
export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
export const anyKey = (o: Obj, keys: string[]): unknown => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined }
export const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean) : typeof v === 'string' ? v.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean) : []
export const slug = (s: string) => normalize(s).replace(/ /g, '-')
export const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : undefined }
export const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

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

