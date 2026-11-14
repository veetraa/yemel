/**
 * Catálogo de recursos por ejercicio (GYM).
 *
 * Cada ejercicio de la biblioteca tiene SU propio registro con: identificador, nombre, grupo muscular,
 * miniatura, modelo 3D, animación y vídeo explicativo. El registro se deriva de `EXERCISES`, así que
 * al añadir un ejercicio nuevo ya tiene miniatura, modelo 3D y animación; solo el vídeo se añade aparte.
 *
 * CÓMO AÑADIR UN VÍDEO (nunca se sustituye por el de otro ejercicio):
 *  1. Copia el archivo a `public/videos/gym/<id-del-ejercicio>.mp4` (vertical, 10–25 s, H.264 ≤ 4 MB).
 *  2. Añade su entrada en `VIDEOS` con autor y licencia. El test comprueba que el archivo existe.
 * Mientras no haya entrada, la ficha muestra «Vídeo no disponible» y permite añadir uno propio.
 */
import { EXERCISES, exerciseById, type Exercise } from '../data/exercises'
import { TEMPLATES, type Template } from '../data/poses'

export interface VideoAsset {
  /** Ruta relativa a `public/` */
  src: string
  poster?: string
  seconds: number
  /** Autor y licencia del recurso (obligatorios: solo se admiten recursos libres o propios) */
  credit: string
  license: string
}

/** Modelo 3D procedural (se construye en el dispositivo a partir de la plantilla de poses; no hay descarga). */
export interface Model3D {
  kind: 'procedural'
  /** Clave de plantilla de poses del ejercicio */
  template: string
}

export interface ExerciseResource {
  id: string
  name: string
  muscle: string
  /** Miniatura: figura vectorial del propio ejercicio */
  thumbnail: { template: string }
  model3d: Model3D
  /** Animación: pose inicial → pose final (segundos por repetición) */
  animation: { template: string; seconds: number }
  video?: VideoAsset
}

/** Vídeos explicativos disponibles, por id de ejercicio. Vacío hasta que se aporten recursos con licencia compatible. */
export const VIDEOS: Record<string, VideoAsset> = {}

export const MAX_VIDEO_MB = 60

const build = (e: Exercise): ExerciseResource => ({
  id: e.id,
  name: e.name,
  muscle: e.primary,
  thumbnail: { template: e.anim },
  model3d: { kind: 'procedural', template: e.anim },
  animation: { template: e.anim, seconds: 3.4 },
  video: VIDEOS[e.id],
})

export const RESOURCES: ExerciseResource[] = EXERCISES.map(build)

export function resourceById(id: string): ExerciseResource | undefined {
  const e = exerciseById(id)
  return e ? build(e) : undefined
}

export const templateOf = (r: ExerciseResource): Template => TEMPLATES[r.model3d.template] ?? TEMPLATES.squat
