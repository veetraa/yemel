import type { Intensity } from '../../shared/types'

// Modelos de datos del módulo COMBAT (deportes de contacto). No dependen de Gym ni de Filosofía.
export type CombatDiscipline =
  | 'Striking' | 'Boxeo' | 'Kickboxing' | 'Wrestling' | 'Brazilian Jiu-Jitsu' | 'Grappling' | 'Transiciones' | 'Defensa y escapes'

/** Secciones de la pestaña COMBAT; cada una tiene su propia biblioteca, entrenos, vídeos, historial y consejos */
export type CombatSport = 'MMA' | 'Brazilian Jiu-Jitsu' | 'Boxeo' | 'Kickboxing' | 'Wrestling'

/** Sesión de combate planificada para un día de la semana (dato propio de COMBAT) */
export interface CombatSlot {
  /** 0 = lunes … 6 = domingo */
  day: number
  sport: CombatSport
  label: string
  focus?: string
  intensity: Intensity
  /** Áreas de trabajo (striking, grappling…) */
  areas: CombatDiscipline[]
  sparring: boolean
  minutes?: number
}

export interface CombatPlan {
  sessions: CombatSlot[]
  updatedAt: number
}

/** Vídeo propio del usuario (archivo guardado solo en el dispositivo, o enlace) */
export interface CombatVideo {
  id: string
  sport: CombatSport
  title: string
  kind: 'file' | 'link'
  url?: string
  blob?: Blob
  techniqueId?: string
  createdAt: number
}
