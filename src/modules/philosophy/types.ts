// Modelos de datos del módulo FILOSOFÍA (estoicismo y desarrollo mental). No dependen de Gym ni de Combat.
export type PhiloTheme = 'disciplina' | 'autocontrol' | 'resiliencia' | 'accion' | 'calma'

export interface Quote {
  id: string
  /** Adaptación al español (no es una traducción literal) */
  text: string
  author: string
  work?: string
  themes: PhiloTheme[]
}

export interface Philosopher {
  id: string
  name: string
  years: string
  role: string
  bio: string
  ideas: string[]
  startWith: string
  quoteIds: string[]
}

export interface Reflection {
  id: string
  title: string
  when: 'Mañana' | 'Noche' | 'Cuando lo necesites' | 'Tras entrenar'
  minutes: number
  intro: string
  prompts: string[]
  theme: PhiloTheme
}

export interface Pillar {
  id: 'disciplina' | 'autocontrol' | 'resiliencia'
  title: string
  definition: string
  principles: string[]
  practices: string[]
  reflectionIds: string[]
}

export interface JournalEntry {
  id: string
  ts: number
  kind: 'free' | 'reflection'
  title?: string
  reflectionId?: string
  quoteId?: string
  prompts?: { q: string; a: string }[]
  text: string
}

export interface PhiloFavorites { quotes: string[]; philosophers: string[]; reflections: string[] }
export type FavKind = keyof PhiloFavorites
