import { exerciseById } from '../data/exercises'
import type { BodyEntry, BodyMetric, Goal, Profile, Session, Settings } from '../types'
import { exerciseSeries } from './stats'
import { clamp } from './utils'

export const DEFAULT_SETTINGS: Settings = { unit: 'kg', sound: true, vibrate: true, adaptToRecovery: true }

/** Datos iniciales precargados (editables). No se inventa nada más. */
export const DEFAULT_PROFILE: Profile = {
  name: '', ageManual: 23, heightCm: 171, weightKg: 60,
  secondaryGoals: [], sports: ['Gimnasio'], weeklyGoal: 4, availableDays: [], equipment: [], bjjDays: [], goals: [],
}

export const SPORTS = ['Gimnasio', 'Jiu-Jitsu', 'Running', 'Natación', 'Ciclismo', 'Fútbol', 'Boxeo', 'Calistenia']
export const EQUIPMENT = ['Gimnasio completo', 'Barra y discos', 'Mancuernas', 'Rack', 'Banco', 'Poleas', 'Máquinas', 'Barra de dominadas', 'Bandas elásticas', 'Kettlebell', 'Solo peso corporal']
export const MAIN_GOALS = ['Ganar músculo', 'Ganar fuerza', 'Perder grasa', 'Mejorar rendimiento en Jiu-Jitsu', 'Resistencia', 'Movilidad', 'Condición física general']
export const SECONDARY_GOALS = ['Ganar músculo', 'Fuerza máxima', 'Resistencia', 'Movilidad', 'Condición física', 'Peso corporal', 'Rendimiento en Jiu-Jitsu', 'Prevenir lesiones']
export const METRIC_LABEL: Record<BodyMetric, string> = { weight: 'Peso', waist: 'Cintura', chest: 'Pecho', arm: 'Brazos', thigh: 'Piernas', hip: 'Cadera' }
export const METRIC_UNIT: Record<BodyMetric, string> = { weight: 'kg', waist: 'cm', chest: 'cm', arm: 'cm', thigh: 'cm', hip: 'cm' }
export const METRICS = Object.keys(METRIC_LABEL) as BodyMetric[]
export const GOAL_KIND_LABEL = { muscle: 'Ganancia muscular', strength: 'Fuerza máxima', endurance: 'Resistencia', mobility: 'Movilidad', fitness: 'Condición física', weight: 'Peso corporal' } as const

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function calcAge(birth?: string, now = new Date()): number | undefined {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return undefined
  const [y, m, d] = birth.split('-').map(Number)
  if (!y || y > now.getFullYear()) return undefined
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age >= 0 && age < 120 ? age : undefined
}

export const ageOf = (p: Profile, now = new Date()) => calcAge(p.birthDate, now) ?? p.ageManual

export function bodySeries(body: BodyEntry[], metric: BodyMetric): { ts: number; v: number }[] {
  return body
    .filter((b) => typeof b[metric] === 'number')
    .map((b) => ({ ts: b.ts, v: b[metric] as number }))
    .sort((a, b) => a.ts - b.ts)
}

export const latestMetric = (body: BodyEntry[], metric: BodyMetric): number | undefined => {
  const s = bodySeries(body, metric)
  return s.length ? s[s.length - 1].v : undefined
}

/** Peso actual: la última medición registrada o, si no hay, el dato del perfil */
export const currentWeight = (profile: Profile, body: BodyEntry[]): number | undefined =>
  latestMetric(body, 'weight') ?? profile.weightKg

export interface GoalProgress { current?: number; pct: number; done: boolean }

export function goalProgress(g: Goal, ctx: { profile: Profile; body: BodyEntry[]; sessions: Session[] }): GoalProgress {
  let current: number | undefined
  if (g.metric === 'manual') current = g.current
  else if (g.metric === 'e1rm') {
    const ex = exerciseById(g.exerciseId)
    if (ex) {
      const s = exerciseSeries(ctx.sessions, ex.name, ex.id)
      if (s.length) current = Math.max(...s.map((p) => p.e1rm))
    }
  } else if (g.metric === 'weight') current = currentWeight(ctx.profile, ctx.body)
  else current = latestMetric(ctx.body, g.metric)

  if (current === undefined) return { pct: 0, done: false }
  const span = g.target - g.start
  const pct = span === 0 ? (current === g.target ? 1 : 0) : clamp((current - g.start) / span, 0, 1)
  return { current, pct, done: pct >= 1 }
}

/** Reparte N días de entrenamiento entre los días disponibles, evitando los de Jiu-Jitsu si se puede */
export function suggestWeekdays(count: number, profile: Profile): number[] {
  const pool = profile.availableDays.length ? profile.availableDays : [0, 1, 2, 3, 4, 5, 6]
  let cands = pool.filter((d) => !profile.bjjDays.includes(d))
  if (cands.length < count) cands = [...cands, ...pool.filter((d) => profile.bjjDays.includes(d))]
  cands = [...new Set(cands)].sort((a, b) => a - b)
  if (count >= cands.length) return cands
  return Array.from({ length: count }, (_, i) => cands[Math.floor((i * cands.length) / count)])
}

export function migrateLegacy(legacy: Record<string, unknown> | undefined): Profile {
  const l = legacy ?? {}
  return {
    ...DEFAULT_PROFILE,
    name: typeof l.name === 'string' ? l.name : '',
    weeklyGoal: typeof l.weeklyGoal === 'number' ? l.weeklyGoal : DEFAULT_PROFILE.weeklyGoal,
    experience: l.experience === 'beginner' || l.experience === 'intermediate' || l.experience === 'advanced' ? l.experience : undefined,
    weightKg: typeof l.bodyWeight === 'number' ? l.bodyWeight : DEFAULT_PROFILE.weightKg,
  }
}

/** Reduce una foto a un JPEG pequeño en data URL (privado, en IndexedDB) */
export function resizeImage(file: File, max = 720, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}
