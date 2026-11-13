import { describe, expect, it } from 'vitest'
import { parseJsonRoutine, parseTextRoutine, parseAuto, parseRest, hasErrors, routineToJson } from '../src/modules/gym/services/gymImportService'
import { recommendWeight } from '../src/modules/gym/services/progressionService'
import type { Session } from '../src/types'

const settings = { experience: 'intermediate' as const, bodyWeight: 80 }

describe('importer JSON', () => {
  it('importa el ejemplo del enunciado sin perder datos', () => {
    const r = parseJsonRoutine(`{"name":"Rutina de hipertrofia","goal":"Muscle gain","days":[{"name":"Día 1 - Tren superior","exercises":[{"name":"Press banca","muscle":"Pecho","sets":4,"reps":"8-10","rest":120,"recommendedWeight":40,"notes":"Mantener control en la fase excéntrica","tempo":"3-1-1"}]}]}`)
    expect(hasErrors(r)).toBe(false)
    const ex = r.routine!.days[0].exercises[0]
    expect(ex).toMatchObject({ name: 'Press banca', muscle: 'Pecho', sets: 4, reps: '8-10', rest: 120, recommendedWeight: 40, exerciseId: 'press-banca' })
    expect(ex.extra).toEqual({ tempo: '3-1-1' })
    expect(routineToJson(r.routine!).days[0].exercises[0]).toMatchObject({ tempo: '3-1-1' })
  })
  it('tolera bloques markdown, comillas tipográficas y comas finales', () => {
    const r = parseJsonRoutine('Aquí tienes:\n```json\n{“name”: “X”, "days": [{"name":"D","exercises":[{"name":"Sentadilla","sets":3,"reps":"5","rest":"3 min",},],},]}\n```\nÁnimo!')
    expect(hasErrors(r)).toBe(false)
    expect(r.routine!.days[0].exercises[0].rest).toBe(180)
  })
  it('acepta claves en español', () => {
    const r = parseJsonRoutine('{"nombre":"R","dias":[{"nombre":"D1","dias_semana":["Lunes","jueves"],"ejercicios":[{"nombre":"Dominadas","series":"3","repeticiones":"6-8","descanso":"90s"}]}]}')
    expect(hasErrors(r)).toBe(false)
    expect(r.routine!.days[0].weekdays).toEqual([0, 3])
    expect(r.routine!.days[0].exercises[0]).toMatchObject({ sets: 3, reps: '6-8', rest: 90 })
  })
  it('explica los errores', () => {
    const r = parseJsonRoutine('{"name":"R","days":[{"name":"D","exercises":[{"sets":3}]}]}')
    expect(hasErrors(r)).toBe(true)
    expect(r.issues.some((i) => i.fix && i.level === 'error')).toBe(true)
    expect(hasErrors(parseJsonRoutine('{"name": '))).toBe(true)
  })
})

describe('importer texto', () => {
  it('parsea formato libre', () => {
    const r = parseTextRoutine(`Rutina: Fuerza\nObjetivo: Fuerza\nDía 1 - Empuje\n- Press banca 4x6-8 descanso 150s peso 60kg\n2. Press militar - 3 x 8 - 2 min (controlado)\nDía 2 - Tirón\nDominadas: 4 series de 6-8, descanso 90s`)
    expect(hasErrors(r)).toBe(false)
    expect(r.routine!.name).toBe('Fuerza')
    expect(r.routine!.days).toHaveLength(2)
    const [a, b] = r.routine!.days[0].exercises
    expect(a).toMatchObject({ name: 'Press banca', sets: 4, reps: '6-8', rest: 150, recommendedWeight: 60 })
    expect(b).toMatchObject({ sets: 3, reps: '8', rest: 120, notes: 'controlado' })
    expect(r.routine!.days[1].exercises[0]).toMatchObject({ sets: 4, reps: '6-8', rest: 90 })
  })
  it('detecta formato automáticamente', () => {
    expect(parseAuto('{"name":"x","days":[]}').format).toBe('json')
    expect(parseAuto('Día 1\nSentadilla 3x5').format).toBe('text')
  })
})

describe('recomendaciones', () => {
  const t = { name: 'Press banca', exerciseId: 'press-banca', targetReps: '8-10' }
  const sess = (w: number, reps: number[], at: number): Session => ({
    id: String(at), routineName: 'r', dayName: 'd', startedAt: at, endedAt: at + 1000,
    exercises: [{ id: 'e', exerciseId: 'press-banca', name: 'Press banca', muscle: 'Pecho', targetReps: '8-10', rest: 90, sets: reps.map((r) => ({ weight: w, reps: r, done: true })) }],
  })
  it('sin historial usa el peso del plan, luego estimación', () => {
    expect(recommendWeight({ ...t, recommendedWeight: 40 }, [], settings)).toMatchObject({ weight: 40, kind: 'plan' })
    expect(recommendWeight(t, [], settings)).toMatchObject({ weight: 55, kind: 'estimate' })
  })
  it('sube al completar el rango', () => {
    expect(recommendWeight(t, [sess(60, [10, 10, 10], 1)], settings)).toMatchObject({ weight: 62.5, kind: 'progress' })
  })
  it('repite si no llega al máximo', () => {
    expect(recommendWeight(t, [sess(60, [9, 8, 8], 1)], settings)).toMatchObject({ weight: 60, kind: 'repeat' })
  })
  it('descarga tras dos sesiones fallidas', () => {
    expect(recommendWeight(t, [sess(60, [6, 6, 5], 1), sess(60, [6, 5, 5], 2)], settings)).toMatchObject({ weight: 54, kind: 'deload' })
  })
})

describe('parseRest', () => {
  it('formatos', () => {
    expect(parseRest('1:30')).toBe(90)
    expect(parseRest('90s')).toBe(90)
    expect(parseRest('2 min')).toBe(120)
    expect(parseRest(120)).toBe(120)
    expect(parseRest('abc')).toBeUndefined()
  })
})
