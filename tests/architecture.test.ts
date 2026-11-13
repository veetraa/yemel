import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', 'src')
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [] })
const files = walk(SRC)
const rel = (p: string) => relative(SRC, p).replace(/\\/g, '/')

/** Módulo al que pertenece un archivo de src/ */
const owner = (r: string) => (r.startsWith('modules/') ? r.split('/')[1] : r.startsWith('shared/') ? 'shared' : 'root')

const imports = (f: string): string[] => {
  const src = readFileSync(f, 'utf8')
  const out: string[] = []
  for (const m of src.matchAll(/(?:from\s+|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) out.push(rel(normalize(join(dirname(f), m[1]))))
  return out
}
const edges = files.flatMap((f) => imports(f).map((t) => ({ from: rel(f), to: t })))
const SECTIONS = ['gym', 'combat', 'philosophy']

describe('arquitectura: Gym, Combat y Filosofía son tres experiencias independientes', () => {
  it('cada sección es una carpeta propia con sus pantallas y servicios', () => {
    for (const s of SECTIONS) {
      const own = files.map(rel).filter((f) => f.startsWith(`modules/${s}/`))
      expect(own.some((f) => f.includes('/screens/')), `${s}: pantallas`).toBe(true)
      expect(own.some((f) => f.includes('/services/')), `${s}: servicios`).toBe(true)
      expect(own.some((f) => f.endsWith('/types.ts')), `${s}: modelos de datos`).toBe(true)
      expect(own.some((f) => f.endsWith('/routes.tsx')), `${s}: rutas`).toBe(true)
    }
  })

  it('ninguna sección importa código de otra sección', () => {
    const bad = edges.filter((e) => SECTIONS.includes(owner(e.from)) && SECTIONS.includes(owner(e.to)) && owner(e.from) !== owner(e.to))
    expect(bad).toEqual([])
  })

  it('las secciones no dependen de las pantallas de resumen (Inicio, Progreso, Perfil)', () => {
    const bad = edges.filter((e) => SECTIONS.includes(owner(e.from)) && ['home', 'progress', 'profile'].includes(owner(e.to)))
    expect(bad).toEqual([])
  })

  it('shared no depende de Filosofía ni de pantallas de resumen', () => {
    const bad = edges.filter((e) => owner(e.from) === 'shared' && ['philosophy', 'home', 'progress', 'profile'].includes(owner(e.to)))
    expect(bad).toEqual([])
  })

  it('shared solo toca Gym/Combat en orquestadores documentados', () => {
    const ALLOWED = [
      'shared/types.ts', // tipos de contexto (solo tipos)
      'shared/services/profileService.ts', // objetivos de fuerza leen el 1RM de Gym
      'shared/services/hybridImportService.ts', // importación híbrida: entrega cada parte a su módulo
      'shared/screens/ImportScreen.tsx', // pantalla de importación con alcance gym / combat / hybrid
    ]
    const bad = edges.filter((e) => owner(e.from) === 'shared' && SECTIONS.includes(owner(e.to)) && !ALLOWED.includes(e.from))
    expect(bad).toEqual([])
  })

  it('los modelos de datos de cada sección no importan de otras', () => {
    for (const s of SECTIONS) {
      const t = edges.filter((e) => e.from === `modules/${s}/types.ts`)
      expect(t.filter((e) => SECTIONS.includes(owner(e.to)) && owner(e.to) !== s)).toEqual([])
    }
  })

  it('cada sección tiene su propio almacén de datos cuando los necesita', () => {
    expect(files.map(rel)).toEqual(expect.arrayContaining(['modules/philosophy/store.tsx', 'modules/combat/store.tsx']))
  })
})
