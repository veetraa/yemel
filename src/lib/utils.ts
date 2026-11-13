export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** 0 = lunes … 6 = domingo */
export const weekdayIndex = (d = new Date()) => (d.getDay() + 6) % 7

export function startOfWeek(d = new Date()): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - weekdayIndex(x))
  return x.getTime()
}

export const startOfDay = (ts: number) => {
  const x = new Date(ts)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`
}

export function formatDuration(ms: number): string {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

export const formatDateLong = (d = new Date()) =>
  new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)

export const formatDateShort = (ts: number) =>
  new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date(ts))

export function formatNumber(n: number, digits = 1): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: digits }).format(n)
}

export function formatVolume(kg: number): string {
  return kg >= 10000 ? `${formatNumber(kg / 1000, 1)} t` : `${formatNumber(Math.round(kg), 0)} kg`
}

/** Quita acentos, minúsculas y símbolos para comparar nombres */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** "8-10" → {min:8,max:10}; "12" → {12,12}; "AMRAP"/"30s" → null */
export function parseRepRange(reps: string): { min: number; max: number } | null {
  const m = reps.match(/^\s*(\d+)\s*(?:[-–—a]\s*(\d+))?\s*$/i)
  if (!m) return null
  const min = parseInt(m[1], 10)
  const max = m[2] ? parseInt(m[2], 10) : min
  return { min: Math.min(min, max), max: Math.max(min, max) }
}

export const KG_PER_LB = 0.45359237
export const toDisplay = (kg: number, unit: 'kg' | 'lb') =>
  unit === 'kg' ? kg : Math.round((kg / KG_PER_LB) * 10) / 10
export const fromDisplay = (v: number, unit: 'kg' | 'lb') =>
  unit === 'kg' ? v : Math.round(v * KG_PER_LB * 100) / 100

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms)
  } catch {
    /* iOS Safari no soporta vibrate */
  }
}

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** 1RM estimado (Epley) */
export const epley = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30))

export function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches'
}
