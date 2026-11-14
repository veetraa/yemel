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
  credit: string
  license: 'pending' | 'granted'
  /** Referencia de la autorización (correo, factura o enlace a los términos) cuando esté concedida */
  licenseRef?: string
}
/**
 * Animaciones de exercises-dataset (hasaneyldrm) © Gym visual, 180×180: id del ejercicio de la app → id en ese dataset,
 * emparejados a mano y revisados fotograma a fotograma. Términos: gymvisual.com/content/3-terms-and-conditions-of-use.
 * Sin equivalente exacto (se usa el modelo 3D básico): hip-thrust, plancha, press-landmine.
 */
export const GYMVISUAL: Record<string, string> = {
  'press-banca': '0025',
  'press-banca-inclinado': '0047',
  'press-inclinado-mancuernas': '0314',
  'press-mancuernas': '0289',
  'press-pecho-maquina': '0577',
  'flexiones': '0662',
  'cruces-polea': '1269',
  'fondos': '0251',
  'dominadas': '0652',
  'jalon-pecho': '0150',
  'remo-barra': '0027',
  'remo-mancuerna': '0292',
  'remo-polea': '0861',
  'peso-muerto': '0032',
  'face-pull': '0233',
  'press-militar': '1457',
  'press-hombro-mancuernas': '0405',
  'elevaciones-laterales': '0334',
  'elevaciones-frontales': '0310',
  'pajaros': '0380',
  'encogimientos': '0406',
  'curl-barra': '0031',
  'curl-mancuernas': '0294',
  'curl-martillo': '0313',
  'curl-polea': '0868',
  'extension-triceps-polea': '0201',
  'press-frances': '0060',
  'sentadilla': '0043',
  'sentadilla-goblet': '1760',
  'prensa': '0739',
  'zancadas': '0336',
  'sentadilla-bulgara': '0410',
  'extension-cuadriceps': '0585',
  'curl-femoral': '0586',
  'peso-muerto-rumano': '0085',
  'puente-gluteos': '3013',
  'gemelos-pie': '0417',
  'gemelos-sentado': '0594',
  'remo-apoyado': '0327',
  'step-ups': '0431',
  'farmer-walk': '2133',
  'pallof-press': '0979',
  'crunch': '0274',
  'elevacion-piernas': '0472',
  'aperturas-mancuernas': '0308'
}
const GV_REF = 'Uso bajo responsabilidad del propietario de la app (sin licencia propia de Gym visual)'
export const ANIMATIONS: Record<string, LicensedAnimation> = Object.fromEntries(Object.entries(GYMVISUAL).map(([id]) => [id, { src: `media/gymvisual/${id}.gif`, width: 180, height: 180, credit: '© Gym visual — https://gymvisual.com/', license: 'granted' as const, licenseRef: GV_REF }]))
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
