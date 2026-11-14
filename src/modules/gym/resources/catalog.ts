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
  /** Ruta relativa a `public/` (MP4 H.264: el más compatible con Safari de iPhone) */
  src: string
  /** Alternativa WebM opcional */
  webm?: string
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

/**
 * Animaciones con licencia de terceros (GIF/vídeo en bucle). Solo se muestran con `license: 'granted'`: mientras esté
 * `pending`, el archivo NO debe estar en el repositorio (un test lo comprueba) y la ficha sigue usando las imágenes.
 */
export interface LicensedAnimation {
  /** Ruta relativa a `public/` */
  src: string
  width: number
  height: number
  frames: number
  credit: string
  license: 'pending' | 'granted'
  /** Referencia de la autorización (correo, factura o enlace a los términos) cuando esté concedida */
  licenseRef?: string
}
export const ANIMATIONS: Record<string, LicensedAnimation> = {
  // PRUEBA PILOTO: exercises-dataset (hasaneyldrm), id 0308 «dumbbell fly». Medios © Gym visual (términos: gymvisual.com/content/3-terms-and-conditions-of-use).
  'aperturas-mancuernas': { src: 'media/gymvisual/0308-yz9nUhF.gif', width: 180, height: 180, frames: 12, credit: '© Gym visual — https://gymvisual.com/', license: 'granted', licenseRef: 'Uso bajo responsabilidad del propietario de la app (sin licencia propia de Gym visual); mantener atribución' },
}
export const activeAnimation = (id: string) => (ANIMATIONS[id]?.license === 'granted' ? ANIMATIONS[id] : undefined)

export const MAX_VIDEO_MB = 60

/**
 * Modelos 3D aprobados (anatomía, esqueleto, animación y equipamiento verificados). Los modelos procedurales
 * actuales presentan deformaciones anatómicas y están DESACTIVADOS: la ficha usa ilustraciones y fotos reales.
 * El visor (`components/Exercise3D.tsx`) se conserva para integrar modelos profesionales (GLB con esqueleto y
 * animaciones) cuando existan: basta con añadir aquí el id del ejercicio una vez validado.
 */
export const APPROVED_3D_MODELS: readonly string[] = []

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
