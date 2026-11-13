/** combatService — catálogo de disciplinas, registro de sesiones de combate y resúmenes. */
import type { Activity, CombatDiscipline, CombatSport, Intensity } from '../../../types'
import { T } from '../../../shared/services/principlesService'

export const DISCIPLINES: CombatDiscipline[] = [
  'Striking', 'Boxeo', 'Kickboxing', 'Wrestling', 'Brazilian Jiu-Jitsu', 'Grappling', 'Transiciones', 'Defensa y escapes',
]

export const TECHNIQUES: Record<CombatDiscipline, string[]> = {
  Striking: ['Combinaciones', 'Defensa de golpes', 'Distancia y timing', 'Manoplas', 'Saco pesado', 'Contraataque'],
  Boxeo: ['Jab', 'Cross', 'Gancho', 'Uppercut', 'Esquivas (slip/roll)', 'Juego de pies', 'Sombra'],
  Kickboxing: ['Low kick', 'Teep', 'Patada al cuerpo', 'Patada alta', 'Check de patadas', 'Rodillazos'],
  Wrestling: ['Derribo a piernas', 'Derribo a una pierna', 'Sprawl', 'Clinch', 'Control en pie', 'Cadena de derribos'],
  'Brazilian Jiu-Jitsu': ['Guardia cerrada', 'Pasaje de guardia', 'Montada', 'Control lateral', 'Espalda', 'Estrangulaciones', 'Luxaciones'],
  Grappling: ['Control de cabeza y brazo', 'Rolling', 'Pummeling', 'Control posicional', 'Sumisiones'],
  Transiciones: ['Striking → derribo', 'Derribo → control', 'Levantarse (técnico)', 'Cambio de nivel', 'Entrada al clinch'],
  'Defensa y escapes': ['Escape de montada', 'Escape de control lateral', 'Defensa de espalda', 'Defensa de derribo', 'Defensa de guillotina', 'Recuperar guardia'],
}

export const SKILLS = ['Técnica', 'Timing', 'Distancia', 'Presión', 'Defensa', 'Control', 'Cardio específico', 'Velocidad', 'Potencia', 'Agarre', 'Estrategia']

export const INTENSITY_LABEL: Record<Intensity, string> = { light: 'Ligera', moderate: 'Moderada', hard: 'Alta' }
/** RPE de partida al elegir una intensidad (el usuario puede ajustarlo) */
export const INTENSITY_RPE: Record<Intensity, number> = { light: 4, moderate: 6, hard: 8 }

export const rpeToIntensity = (rpe: number): Intensity => (rpe <= 4 ? 'light' : rpe <= 6 ? 'moderate' : 'hard')

/** Secciones de la pestaña COMBAT */
export const COMBAT_SECTIONS: CombatSport[] = ['MMA', 'Brazilian Jiu-Jitsu', 'Boxeo', 'Kickboxing', 'Wrestling']
import { isCombat } from '../../../shared/lib/activity'
export { isCombatSport, hasCombatSport, isCombat, isDemanding } from '../../../shared/lib/activity'

export interface CombatInput {
  sport: string
  minutes?: number
  rpe?: number
  intensity?: Intensity
  disciplines: CombatDiscipline[]
  techniques: string[]
  skills: string[]
  sparring: boolean
  sparringRounds?: number
  note?: string
  ts: number
}

/** Valida y construye el registro. No asume intensidad: exige RPE o intensidad. */
export function buildCombatActivity(i: CombatInput): { activity?: Omit<Activity, 'id'>; error?: string } {
  if (!i.minutes || i.minutes <= 0) return { error: 'Indica la duración de la sesión.' }
  if (i.minutes > 600) return { error: 'La duración parece demasiado larga (máx. 600 min).' }
  const rpe = i.rpe ?? (i.intensity ? INTENSITY_RPE[i.intensity] : undefined)
  if (rpe === undefined) return { error: 'Indica la intensidad o el RPE: no se asume que la sesión fue dura.' }
  if (rpe < 1 || rpe > 10) return { error: 'El RPE debe estar entre 1 y 10.' }
  return {
    activity: {
      ts: i.ts, sport: i.sport, minutes: Math.round(i.minutes), rpe, kind: 'combat',
      intensity: i.intensity ?? rpeToIntensity(rpe),
      disciplines: i.disciplines.length ? i.disciplines : undefined,
      techniques: i.techniques.length ? i.techniques : undefined,
      skills: i.skills.length ? i.skills : undefined,
      sparring: i.sparring || undefined,
      sparringRounds: i.sparring && i.sparringRounds ? i.sparringRounds : undefined,
      note: i.note?.trim() || undefined,
    },
  }
}

export interface CombatSummary {
  sessions: number
  minutes: number
  avgRpe?: number
  sparringSessions: number
  hardSessions: number
  byDiscipline: { discipline: string; count: number }[]
  topTechniques: { technique: string; count: number }[]
}

export function combatSummary(activities: Activity[], days = 30, now = new Date()): CombatSummary {
  const since = now.getTime() - days * 86400000
  const list = activities.filter((a) => isCombat(a) && a.ts >= since && a.ts <= now.getTime() + 86400000)
  const disc = new Map<string, number>()
  const tech = new Map<string, number>()
  for (const a of list) {
    for (const d of a.disciplines ?? []) disc.set(d, (disc.get(d) ?? 0) + 1)
    for (const t of a.techniques ?? []) tech.set(t, (tech.get(t) ?? 0) + 1)
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])
  return {
    sessions: list.length,
    minutes: list.reduce((a, x) => a + x.minutes, 0),
    avgRpe: list.length ? list.reduce((a, x) => a + x.rpe, 0) / list.length : undefined,
    sparringSessions: list.filter((a) => a.sparring).length,
    hardSessions: list.filter((a) => a.rpe >= T.HARD_RPE).length,
    byDiscipline: top(disc).map(([discipline, count]) => ({ discipline, count })),
    topTechniques: top(tech).slice(0, 5).map(([technique, count]) => ({ technique, count })),
  }
}
