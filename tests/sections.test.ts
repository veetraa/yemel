import { describe, expect, it } from 'vitest'
import { LIBRARY } from '../src/modules/combat/data/library'
import { COMBAT_TEMPLATES } from '../src/modules/combat/data/poses'
import { categoriesOf, findTechnique, findTraining, searchTechniques, sportActivities, sportSummary } from '../src/modules/combat/services/combatLibraryService'
import { COMBAT_SECTIONS } from '../src/modules/combat/services/combatService'
import { EXERCISES } from '../src/modules/gym/data/exercises'
import { PHILOSOPHERS } from '../src/modules/philosophy/data/philosophers'
import { QUOTES } from '../src/modules/philosophy/data/quotes'
import { PILLARS, REFLECTIONS } from '../src/modules/philosophy/data/reflections'
import { EMPTY_FAVORITES, dayOfYear, isEntryEmpty, journalStreak, newEntry, quoteOfDay, searchJournal, searchQuotes, suggestedReflection, suggestedTheme, toggleFavorite } from '../src/modules/philosophy/services/philosophyService'
import { loadSummaries, exerciseHistoryLog } from '../src/modules/gym/services/workoutService'
import type { Activity, Session } from '../src/types'

describe('COMBAT: contenido propio por disciplina', () => {
  it('cada disciplina tiene biblioteca, entrenos y consejos', () => {
    expect(COMBAT_SECTIONS).toEqual(['MMA', 'Brazilian Jiu-Jitsu', 'Boxeo', 'Kickboxing', 'Wrestling'])
    for (const s of COMBAT_SECTIONS) {
      const l = LIBRARY[s]
      expect(l.sport).toBe(s)
      expect(l.techniques.length, `${s} técnicas`).toBeGreaterThanOrEqual(7)
      expect(l.trainings.length, `${s} entrenos`).toBeGreaterThanOrEqual(3)
      expect(l.tips.length, `${s} consejos`).toBeGreaterThanOrEqual(4)
      expect(new Set(l.techniques.map((t) => t.id)).size).toBe(l.techniques.length)
      for (const t of l.techniques) { expect(t.steps.length).toBeGreaterThanOrEqual(2); expect(t.cues.length).toBeGreaterThan(0); expect(t.mistakes.length).toBeGreaterThan(0) }
    }
  })
  it('los entrenos solo referencian técnicas de su propia disciplina y tienen bloques coherentes', () => {
    for (const s of COMBAT_SECTIONS) for (const tr of LIBRARY[s].trainings) {
      for (const id of tr.techniques) expect(findTechnique(s, id), `${s}/${tr.id}/${id}`).toBeDefined()
      expect(tr.blocks.reduce((a, b) => a + b.minutes, 0)).toBeGreaterThanOrEqual(tr.minutes - 10)
      expect(findTraining(s, tr.id)).toBe(tr)
    }
    expect(findTechnique('Boxeo', 'bjj-shrimp')).toBeUndefined() // no se mezclan disciplinas
  })
  it('las animaciones de técnicas existen y son propias de Combat', () => {
    for (const s of COMBAT_SECTIONS) for (const t of LIBRARY[s].techniques) if (t.anim) expect(COMBAT_TEMPLATES[t.anim], `${s}/${t.id}`).toBeDefined()
    expect(Object.keys(COMBAT_TEMPLATES)).toEqual(expect.arrayContaining(['jab', 'cross', 'lowKick', 'teep', 'sprawl', 'shot', 'shrimp', 'bridge']))
  })
  it('combat no contiene ejercicios de musculación y gym no contiene técnicas de combate', () => {
    const combatText = COMBAT_SECTIONS.flatMap((s) => LIBRARY[s].techniques.map((t) => t.name.toLowerCase())).join(' | ')
    for (const e of EXERCISES) expect(combatText.includes(e.name.toLowerCase()), `combat contiene «${e.name}»`).toBe(false)
    const gymText = EXERCISES.map((e) => `${e.name} ${e.aliases.join(' ')}`.toLowerCase()).join(' | ')
    expect(gymText).not.toMatch(/jiu|boxeo|kickboxing|sparring|sprawl|armbar|estrangulaci/)
  })
  it('búsqueda y categorías por disciplina', () => {
    expect(categoriesOf('Boxeo')).toContain('Golpes')
    expect(searchTechniques('Boxeo', 'jab').map((t) => t.id)).toContain('box-jab')
    expect(searchTechniques('Boxeo', '', 'Defensa').map((t) => t.id)).toEqual(['box-slip'])
    expect(searchTechniques('Wrestling', 'sprawl').length).toBeGreaterThan(0)
  })
  it('el historial de cada disciplina es independiente', () => {
    const now = new Date('2026-11-13T12:00:00')
    const a = (sport: string, rpe = 5, o: Partial<Activity> = {}): Activity => ({ id: Math.random() + '', ts: now.getTime() - 86400000, sport, minutes: 60, rpe, kind: 'combat', ...o })
    const acts = [a('Boxeo', 4, { techniques: ['Jab'] }), a('Boxeo', 6), a('Brazilian Jiu-Jitsu', 8, { sparring: true }), { ...a('Movilidad'), kind: 'recovery' as const }]
    expect(sportActivities(acts, 'Boxeo')).toHaveLength(2)
    expect(sportActivities(acts, 'Brazilian Jiu-Jitsu')).toHaveLength(1)
    expect(sportActivities(acts, 'Wrestling')).toHaveLength(0)
    expect(sportSummary(acts, 'Boxeo', 30, now)).toMatchObject({ sessions: 2, minutes: 120, avgRpe: 5 })
    expect(sportSummary(acts, 'Brazilian Jiu-Jitsu', 30, now)).toMatchObject({ sparringSessions: 1, hardSessions: 1 })
  })
})

describe('FILOSOFÍA: contenido y servicios propios', () => {
  it('contenido consistente', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(25)
    expect(new Set(QUOTES.map((q) => q.id)).size).toBe(QUOTES.length)
    for (const p of PHILOSOPHERS) for (const id of p.quoteIds) expect(QUOTES.some((q) => q.id === id), `${p.id}/${id}`).toBe(true)
    for (const p of PILLARS) for (const id of p.reflectionIds) expect(REFLECTIONS.some((r) => r.id === id)).toBe(true)
    expect(PILLARS.map((p) => p.id)).toEqual(['disciplina', 'autocontrol', 'resiliencia'])
    for (const t of ['disciplina', 'autocontrol', 'resiliencia'] as const) expect(QUOTES.filter((q) => q.themes.includes(t)).length, t).toBeGreaterThanOrEqual(5)
    expect(PHILOSOPHERS.map((p) => p.name)).toEqual(expect.arrayContaining(['Marco Aurelio', 'Séneca', 'Epicteto']))
    expect(QUOTES.every((q) => q.text && q.author)).toBe(true)
    // no contiene nada de gimnasio ni de combate
    expect(JSON.stringify(QUOTES).toLowerCase()).not.toMatch(/sparring|jiu|mancuerna/)
  })
  it('la frase del día es determinista, rota cada día y respeta el tema', () => {
    const d = new Date('2026-11-13T09:00:00')
    expect(quoteOfDay(d).id).toBe(quoteOfDay(new Date('2026-11-13T22:00:00')).id)
    expect(quoteOfDay(d).id).not.toBe(quoteOfDay(new Date('2026-11-14T09:00:00')).id)
    expect(quoteOfDay(d, 'resiliencia').themes).toContain('resiliencia')
    expect(quoteOfDay(d, undefined, 1).id).not.toBe(quoteOfDay(d).id)
    expect(dayOfYear(new Date('2026-01-01T12:00:00'))).toBe(1)
  })
  it('sugerencias según la recuperación global y la hora', () => {
    expect(suggestedTheme('low')).toBe('calma')
    expect(suggestedReflection(new Date('2026-11-13T08:00:00'), 'good').id).toBe('manana')
    expect(suggestedReflection(new Date('2026-11-13T21:00:00'), 'good').id).toBe('noche')
    expect(suggestedReflection(new Date('2026-11-13T15:00:00'), 'unknown').id).toBe('control')
    expect(suggestedReflection(new Date('2026-11-13T08:00:00'), 'low').id).toBe('calma')
  })
  it('búsqueda de frases', () => {
    expect(searchQuotes('séneca').every((q) => q.author === 'Séneca')).toBe(true)
    expect(searchQuotes('', 'autocontrol').every((q) => q.themes.includes('autocontrol'))).toBe(true)
    expect(searchQuotes('zzzz')).toEqual([])
  })
  it('favoritos', () => {
    let f = toggleFavorite(EMPTY_FAVORITES, 'quotes', 'ma-obstaculo')
    f = toggleFavorite(f, 'philosophers', 'seneca')
    expect(f).toEqual({ quotes: ['ma-obstaculo'], philosophers: ['seneca'], reflections: [] })
    expect(toggleFavorite(f, 'quotes', 'ma-obstaculo').quotes).toEqual([])
    expect(EMPTY_FAVORITES.quotes).toEqual([]) // no muta
  })
  it('diario: entradas, racha y búsqueda', () => {
    const now = new Date('2026-11-13T12:00:00')
    const e = (daysAgo: number, text: string) => newEntry({ ts: now.getTime() - daysAgo * 86400000, text })
    expect(journalStreak([e(0, 'a'), e(1, 'b'), e(2, 'c')], now)).toBe(3)
    expect(journalStreak([e(1, 'a'), e(2, 'b')], now)).toBe(2) // aún no has escrito hoy
    expect(journalStreak([e(0, 'a'), e(2, 'b')], now)).toBe(1)
    expect(journalStreak([e(3, 'a')], now)).toBe(0)
    expect(isEntryEmpty(newEntry())).toBe(true)
    expect(isEntryEmpty(newEntry({ prompts: [{ q: '¿?', a: '  ' }] }))).toBe(true)
    expect(isEntryEmpty(newEntry({ prompts: [{ q: '¿?', a: 'algo' }] }))).toBe(false)
    expect(searchJournal([e(0, 'Hoy practiqué la calma'), e(1, 'Otro día')], 'CALMA')).toHaveLength(1)
    expect(newEntry().id).not.toBe(newEntry().id)
  })
})

describe('GYM: historial de cargas (solo musculación)', () => {
  const ses = (id: string, end: number, sets: [number, number][]): Session => ({ id, routineName: 'r', dayName: 'GYM A', startedAt: end - 3600000, endedAt: end, exercises: [{ id: 'e' + id, exerciseId: 'press-banca', name: 'Press banca', muscle: 'Pecho', targetReps: '6-8', rest: 90, sets: sets.map(([weight, reps]) => ({ weight, reps, done: true })) }] })
  it('resumen por ejercicio y registro de cargas', () => {
    const s = [ses('a', 1000000, [[60, 8], [60, 8]]), ses('b', 5000000, [[62.5, 8], [62.5, 6]])]
    const sum = loadSummaries(s)
    expect(sum).toHaveLength(1)
    expect(sum[0]).toMatchObject({ name: 'Press banca', count: 2, last: { weight: 62.5, reps: 8 } })
    expect(sum[0].best.weight).toBe(62.5)
    const log = exerciseHistoryLog(s, 'press-banca')
    expect(log.map((e) => e.sessionId)).toEqual(['b', 'a'])
    expect(log[0].sets).toEqual([{ weight: 62.5, reps: 8 }, { weight: 62.5, reps: 6 }])
    expect(loadSummaries([])).toEqual([])
  })
})
