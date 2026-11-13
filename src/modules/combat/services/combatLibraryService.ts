/** combatLibraryService — acceso a la biblioteca técnica, entrenos y consejos de cada disciplina. */
import { LIBRARY, type SportLibrary, type Technique, type Training } from '../data/library'
import { normalize } from '../../../shared/lib/utils'
import type { Activity, CombatSport } from '../../../types'
import { COMBAT_SECTIONS, combatSummary, isCombat } from './combatService'

export const SPORT_SHORT: Record<CombatSport, string> = { MMA: 'MMA', 'Brazilian Jiu-Jitsu': 'BJJ', Boxeo: 'Boxeo', Kickboxing: 'Kickboxing', Wrestling: 'Wrestling' }
export const libraryOf = (sport: CombatSport): SportLibrary => LIBRARY[sport]
export const isSport = (s: string): s is CombatSport => (COMBAT_SECTIONS as string[]).includes(s)

export const findTechnique = (sport: CombatSport, id: string): Technique | undefined => LIBRARY[sport].techniques.find((t) => t.id === id)
export const findTraining = (sport: CombatSport, id: string): Training | undefined => LIBRARY[sport].trainings.find((t) => t.id === id)
export const categoriesOf = (sport: CombatSport) => [...new Set(LIBRARY[sport].techniques.map((t) => t.category))]

export function searchTechniques(sport: CombatSport, q = '', category?: string): Technique[] {
  const n = normalize(q)
  return LIBRARY[sport].techniques.filter((t) => (!category || t.category === category) && (!n || normalize(`${t.name} ${t.category} ${t.summary}`).includes(n)))
}

/** Sesiones de combate registradas de UNA disciplina (el historial de cada sección es independiente) */
export const sportActivities = (activities: Activity[], sport: CombatSport) => activities.filter((a) => isCombat(a) && a.sport === sport)
export const sportSummary = (activities: Activity[], sport: CombatSport, days = 30, now = new Date()) => combatSummary(sportActivities(activities, sport), days, now)
