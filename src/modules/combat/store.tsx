/**
 * Proveedor propio de COMBAT para los vídeos del usuario (archivos privados en IndexedDB o enlaces).
 * Los archivos NO salen del dispositivo y no se incluyen en la copia de seguridad (solo los enlaces).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { registerBackup } from '../../shared/lib/backupRegistry'
import { dbAll, dbClear, dbDelete, dbPut } from '../../shared/lib/db'
import { uid } from '../../shared/lib/utils'
import type { CombatSport, CombatVideo } from '../../types'

interface MediaStore {
  videos: CombatVideo[]
  addFile: (sport: CombatSport, title: string, file: Blob, techniqueId?: string) => Promise<void>
  addLink: (sport: CombatSport, title: string, url: string, techniqueId?: string) => void
  removeVideo: (id: string) => void
}
const Ctx = createContext<MediaStore>(null as unknown as MediaStore)
export const useCombatMedia = () => useContext(Ctx)

export const normalizeUrl = (u: string): string | null => {
  const t = u.trim()
  if (!t) return null
  try { const x = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`); return x.protocol === 'http:' || x.protocol === 'https:' ? x.toString() : null } catch { return null }
}

export function CombatMediaProvider({ children }: { children: ReactNode }) {
  const [videos, setVideos] = useState<CombatVideo[]>([])

  useEffect(() => { void dbAll<CombatVideo>('videos').then((v) => setVideos(v.sort((a, b) => b.createdAt - a.createdAt))) }, [])

  const addFile = useCallback(async (sport: CombatSport, title: string, file: Blob, techniqueId?: string) => {
    const v: CombatVideo = { id: uid(), sport, title: title.trim() || 'Vídeo', kind: 'file', blob: file, techniqueId, createdAt: Date.now() }
    await dbPut('videos', v.id, v)
    setVideos((cur) => [v, ...cur])
  }, [])
  const addLink = useCallback((sport: CombatSport, title: string, url: string, techniqueId?: string) => {
    const v: CombatVideo = { id: uid(), sport, title: title.trim() || 'Enlace', kind: 'link', url, techniqueId, createdAt: Date.now() }
    void dbPut('videos', v.id, v)
    setVideos((cur) => [v, ...cur])
  }, [])
  const removeVideo = useCallback((id: string) => { void dbDelete('videos', id); setVideos((cur) => cur.filter((v) => v.id !== id)) }, [])

  // Copia de seguridad: solo enlaces (los archivos de vídeo son demasiado grandes y se quedan en el dispositivo)
  useEffect(() => registerBackup({
    key: 'combatVideos',
    export: () => videos.filter((v) => v.kind === 'link'),
    import: (data, mode) => {
      const incoming = (Array.isArray(data) ? data : []) as CombatVideo[]
      // Los archivos de vídeo no viajan en la copia: nunca se borran al restaurar; solo se reemplazan los enlaces
      setVideos((cur) => {
        const base = mode === 'replace' ? cur.filter((v) => v.kind === 'file') : cur
        const dropped = mode === 'replace' ? cur.filter((v) => v.kind === 'link') : []
        void (async () => { for (const v of dropped) await dbDelete('videos', v.id); for (const v of incoming) await dbPut('videos', v.id, v) })()
        return [...incoming, ...base.filter((c) => !incoming.some((x) => x.id === c.id))]
      })
    },
    reset: async () => { await dbClear('videos'); setVideos([]) },
  }), [videos])

  const value = useMemo(() => ({ videos, addFile, addLink, removeVideo }), [videos, addFile, addLink, removeVideo])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
