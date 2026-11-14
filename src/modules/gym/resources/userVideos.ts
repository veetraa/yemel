/** Vídeos propios del usuario por ejercicio: archivo privado en IndexedDB (no sale del iPhone ni entra en la copia) o enlace directo a un archivo de vídeo. */
import { dbDelete, dbGet, dbPut } from '../../../shared/lib/db'

export type UserVideo =
  | { exerciseId: string; kind: 'file'; blob: Blob; createdAt: number }
  | { exerciseId: string; kind: 'link'; url: string; createdAt: number }

export const getUserVideo = (exerciseId: string) => dbGet<UserVideo>('gymvideos', exerciseId)
export const saveUserVideo = (v: UserVideo) => dbPut('gymvideos', v.exerciseId, v)
export const removeUserVideo = (exerciseId: string) => dbDelete('gymvideos', exerciseId)

/** Solo enlaces http(s) a un archivo de vídeo reproducible en la app (mp4, mov, m4v, webm). */
export function videoUrl(u: string): string | null {
  const t = u.trim()
  if (!t) return null
  try {
    const x = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return null
    return /\.(mp4|m4v|mov|webm)$/i.test(x.pathname) ? x.toString() : null
  } catch { return null }
}
