import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { EXERCISES } from '../src/modules/gym/data/exercises'
import { imagesOf, loadLibraryExercise, loadLibraryIndex, matchExact, suggestSimilar, type LibExercise, type LibIndexItem } from '../src/modules/gym/library/library'
import { parseJsonRoutine } from '../src/modules/gym/services/gymImportService'

const PUB = join(__dirname, '..', 'public', 'data', 'library')
const json = <T>(f: string) => JSON.parse(readFileSync(join(PUB, f), 'utf8')) as T
const links = JSON.parse(readFileSync(join(__dirname, '..', 'scripts', 'library-links.json'), 'utf8')).core as { id: string; name: string; kinetic: string | null; repdb: string | null; yuhonas: string | null }[]
const index = json<LibIndexItem[]>('index.json')

beforeAll(async () => {
  // la app descarga estos archivos con fetch: aquí se sirven desde public/
  globalThis.fetch = (async (u: string) => {
    const f = join(PUB, String(u).replace(/^.*data\/library\//, ''))
    return existsSync(f) ? { ok: true, status: 200, json: async () => JSON.parse(readFileSync(f, 'utf8')) } : { ok: false, status: 404, json: async () => null }
  }) as unknown as typeof fetch
  await loadLibraryIndex()
})

describe('biblioteca unificada', () => {
  it('cada ejercicio propio tiene vínculo verificado y conserva su id estable', () => {
    expect(links.map((l) => l.id).sort()).toEqual(EXERCISES.map((e) => e.id).sort())
    for (const e of EXERCISES) expect(links.find((l) => l.id === e.id)!.name).toBe(e.name)
    for (const e of EXERCISES) expect(index.some((i) => i.id === e.id && i.core), e.id).toBe(true)
  })

  it('no hay identificadores duplicados ni recursos asociados a ejercicios distintos', () => {
    expect(new Set(index.map((i) => i.id)).size).toBe(index.length)
    for (const k of ['kinetic', 'repdb', 'yuhonas'] as const) {
      const v = links.map((l) => l[k]).filter(Boolean)
      expect(new Set(v).size, `${k}: un recurso por ejercicio`).toBe(v.length)
    }
    const ys = index.filter((i) => i.y).map((i) => i.y)
    expect(new Set(ys).size, 'una foto de referencia por ejercicio').toBe(ys.length)
  })

  it('cada entrada tiene ficha y sus imágenes son las suyas y existen', () => {
    const dir = new Set(readdirSync(join(PUB, 'ex')))
    for (const i of index) {
      expect(dir.has(`${i.id}.json`), i.id).toBe(true)
      if (i.i === 1) expect(existsSync(join(PUB, 'img', `${i.id}-start.webp`)) || existsSync(join(PUB, 'img', `${i.id}-main.webp`)), `${i.id}: ilustración`).toBe(true)
    }
    for (const f of readdirSync(join(PUB, 'img'))) expect(index.some((i) => f.startsWith(`${i.id}-`)), f).toBe(true)
  })

  it('no se incorporan vídeos sin derechos verificados', () => {
    for (const f of readdirSync(join(PUB, 'ex'))) expect(json<LibExercise>(`ex/${f}`).video, f).toBeNull()
  })

  it('las fuentes con licencia y la atribución a RepDB están registradas', () => {
    const s = json<{ sources: { id: string; license: string; url: string }[] }>('sources.json')
    expect(s.sources.map((x) => x.id).sort()).toEqual(['kinetic', 'repdb', 'yuhonas'])
    expect(s.sources.find((x) => x.id === 'kinetic')!.license).toBe('MIT')
    expect(s.sources.find((x) => x.id === 'yuhonas')!.license).toBe('Unlicense')
  })

  it('las imágenes salen de la ficha del propio ejercicio', async () => {
    const d = (await loadLibraryExercise('press-banca'))!
    expect(d.name).toBe('Press banca')
    const im = imagesOf(d)!
    expect(im.source).toBe('repdb'); expect(im.start).toContain('press-banca-start.webp'); expect(im.end).toContain('press-banca-end.webp')
    const far = index.find((i) => !i.core && i.i === 2)!
    const f = imagesOf((await loadLibraryExercise(far.id))!)!
    expect(f.source).toBe('yuhonas'); expect(f.start).toContain(`/${far.y}/0.jpg`)
    expect(await loadLibraryExercise('no-existe')).toBeNull()
  })
})

describe('importación: coincidencia exacta con la biblioteca', () => {
  it('vincula por nombre, alias o nombre en inglés y nunca por parecido', () => {
    expect(matchExact('Press banca')?.id).toBe('press-banca')
    expect(matchExact('press de banca')?.id).toBe('press-banca')
    expect(matchExact('Barbell Bench Press')?.id).toBe('press-banca')
    const other = index.find((i) => !i.core)!
    expect(matchExact(other.n)?.id).toBe(other.id)
    expect(matchExact('Press banca con barra y pausa de 3 segundos')).toBeUndefined()
    expect(suggestSimilar('Sentadilla frontal con barra olímpica')).toBeTruthy()
  })

  it('conserva series y repeticiones, vincula los exactos y avisa de los demás sin asignar uno parecido', () => {
    const lib = index.find((i) => !i.core && i.i === 2)!
    const r = parseJsonRoutine(JSON.stringify({ name: 'Prueba', days: [{ name: 'Día 1', exercises: [
      { name: 'Press banca', sets: 4, reps: '6-8', rest: 120 },
      { name: lib.n, sets: 3, reps: '12', rest: 60 },
      { name: 'Remo con polea neutra especial', sets: 2, reps: '15', rest: 45 },
    ] }] }))
    const ex = r.routine!.days[0].exercises
    expect(ex.map((e) => e.exerciseId)).toEqual(['press-banca', lib.id, undefined])
    expect(ex.map((e) => [e.sets, e.reps, e.rest])).toEqual([[4, '6-8', 120], [3, '12', 60], [2, '15', 45]])
    expect(ex[2].name).toBe('Remo con polea neutra especial')
    expect(r.issues.some((i) => i.message.includes('Remo con polea neutra especial') && i.message.includes('no está en la biblioteca'))).toBe(true)
  })
})
