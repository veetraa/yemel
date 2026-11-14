import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../src/modules/gym/data/exercises'
import { PILOT_ANATOMY } from '../src/modules/gym/resources/catalog'

const DIR = join(__dirname, '..', 'public', 'models', 'anatomy')
const glb = readFileSync(join(DIR, 'anatomy.glb'))
const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString())

describe('modelo anatómico (Z-Anatomy, CC BY-SA 4.0)', () => {
  it('es un GLB válido, ligero y con esqueleto de 17 huesos', () => {
    expect(glb.subarray(0, 4).toString()).toBe('glTF')
    expect(statSync(join(DIR, 'anatomy.glb')).size).toBeLessThan(12 * 1024 * 1024)
    const bones = json.nodes.slice(0, 17).map((n: { name: string }) => n.name)
    expect(bones).toEqual(['hips', 'spine', 'chest', 'neck', 'head', 'uaL', 'faL', 'handL', 'uaR', 'faR', 'handR', 'thL', 'shL', 'ftL', 'thR', 'shR', 'ftR'])
    expect(json.skins[0].joints).toHaveLength(17)
    const tris = json.meshes.reduce((a: number, m: { primitives: { indices: number }[] }) => a + json.accessors[m.primitives[0].indices].count / 3, 0)
    expect(tris).toBeLessThan(300_000)
    expect(json.scenes[0].extras.rig.rest.hips).toHaveLength(3)
  })

  it('cada zona de los ejercicios piloto existe como malla propia (se ilumina por separado)', () => {
    const meshes = json.meshes.map((m: { name: string }) => m.name)
    for (const [id, c] of Object.entries(PILOT_ANATOMY)) {
      expect(EXERCISES.some((e) => e.id === id), `${id}: ejercicio existente`).toBe(true)
      for (const z of [...c.main, ...c.sec]) expect(meshes, `${id}: zona ${z}`).toContain(`m_${z}`)
      expect(c.main.length).toBeGreaterThan(0)
      expect(c.main.filter((z) => c.sec.includes(z))).toEqual([])
    }
    expect(Object.keys(PILOT_ANATOMY).sort()).toEqual(['aperturas-mancuernas', 'curl-barra', 'sentadilla'])
  })

  it('lleva la licencia, la atribución y la indicación de cambios', () => {
    const t = readFileSync(join(DIR, 'LICENSE.txt'), 'utf8')
    expect(existsSync(join(DIR, 'LICENSE.txt'))).toBe(true)
    for (const k of ['Z-Anatomy', 'CC BY-SA 4.0', 'Cambios realizados']) expect(t).toContain(k)
    expect(json.asset.copyright).toContain('Z-Anatomy')
  })
})
