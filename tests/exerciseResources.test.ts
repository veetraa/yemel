import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXERCISES } from '../src/modules/gym/data/exercises'
import { TEMPLATES } from '../src/modules/gym/data/poses'
import { RESOURCES, VIDEOS, resourceById, templateOf } from '../src/modules/gym/resources/catalog'
import { videoUrl } from '../src/modules/gym/resources/userVideos'

describe('recursos por ejercicio', () => {
  it('cada ejercicio tiene su registro completo con modelo 3D, animación y miniatura propios', () => {
    expect(RESOURCES).toHaveLength(EXERCISES.length)
    expect(new Set(RESOURCES.map((r) => r.id)).size).toBe(RESOURCES.length)
    for (const e of EXERCISES) {
      const r = resourceById(e.id)!
      expect(r.name).toBe(e.name)
      expect(r.muscle).toBe(e.primary)
      expect(r.model3d.template, `${e.id}: plantilla`).toBe(e.anim)
      expect(r.thumbnail.template).toBe(e.anim)
      expect(TEMPLATES[e.anim], `${e.id}: existe la plantilla ${e.anim}`).toBeTruthy()
      expect(templateOf(r)).toBe(TEMPLATES[e.anim])
    }
  })

  it('los vídeos declarados existen, son del propio ejercicio y tienen autor y licencia', () => {
    for (const [id, v] of Object.entries(VIDEOS)) {
      expect(EXERCISES.some((e) => e.id === id), `${id}: ejercicio existente`).toBe(true)
      expect(existsSync(join(__dirname, '..', 'public', v.src)), `${id}: ${v.src}`).toBe(true)
      expect(v.seconds).toBeGreaterThanOrEqual(5)
      expect(v.seconds).toBeLessThanOrEqual(30)
      expect(v.credit.length).toBeGreaterThan(2)
      expect(v.license.length).toBeGreaterThan(1)
    }
  })

  it('solo se aceptan enlaces directos a archivos de vídeo', () => {
    expect(videoUrl('https://ejemplo.com/a/sentadilla.mp4')).toBe('https://ejemplo.com/a/sentadilla.mp4')
    expect(videoUrl('ejemplo.com/x.webm')).toBe('https://ejemplo.com/x.webm')
    expect(videoUrl('https://www.youtube.com/watch?v=abc')).toBeNull()
    expect(videoUrl('javascript:alert(1)')).toBeNull()
    expect(videoUrl('')).toBeNull()
  })
})

describe('animaciones de ejercicios', () => {
  it('cada animación pertenece a un ejercicio de la app, existe, es un GIF 180×180 y no se reutiliza entre ejercicios', async () => {
    const { ANIMATIONS, GYMVISUAL } = await import('../src/modules/gym/resources/catalog')
    expect(new Set(Object.values(GYMVISUAL)).size, 'un recurso por ejercicio').toBe(Object.keys(GYMVISUAL).length)
    for (const [id, a] of Object.entries(ANIMATIONS)) {
      expect(EXERCISES.some((e) => e.id === id), `${id}: ejercicio existente`).toBe(true)
      const f = join(__dirname, '..', 'public', a.src)
      expect(existsSync(f), `${id}: falta ${a.src}`).toBe(true)
      const b = readFileSync(f)
      expect(b.subarray(0, 3).toString(), `${id}: no es un GIF`).toBe('GIF')
      expect([b.readUInt16LE(6), b.readUInt16LE(8)], `${id}: resolución`).toEqual([a.width, a.height])
      if (a.license === 'granted') expect(a.licenseRef?.length, `${id}: falta la referencia de la licencia`).toBeGreaterThan(3)
      expect(a.credit).toContain('Gym visual')
    }
  })
})
