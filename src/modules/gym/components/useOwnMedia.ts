import { useEffect, useState } from 'react'
import { getUserVideo, isImageMedia } from '../resources/userVideos'

export interface OwnMedia { kind: 'image' | 'video'; url: string }

/** Demostración propia del usuario (GIF o vídeo guardado solo en su dispositivo) para un ejercicio. */
export function useOwnMedia(id: string): OwnMedia | null {
  const [m, setM] = useState<OwnMedia | null>(null)
  useEffect(() => {
    let off = false, url: string | null = null
    const load = async () => {
      const v = await getUserVideo(id)
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
      url = null
      if (off || !v) { if (!off) setM(null); return }
      url = v.kind === 'link' ? v.url : URL.createObjectURL(v.blob)
      setM({ kind: isImageMedia(v) ? 'image' : 'video', url })
    }
    void load()
    window.addEventListener('gym-own-media', load)
    return () => { off = true; window.removeEventListener('gym-own-media', load); if (url?.startsWith('blob:')) URL.revokeObjectURL(url) }
  }, [id])
  return m
}
