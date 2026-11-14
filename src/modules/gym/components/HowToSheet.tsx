import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Button, Sheet } from '../../../shared/components/ui'
import { MAX_VIDEO_MB, resourceById } from '../resources/catalog'
import { getUserVideo, removeUserVideo, saveUserVideo, videoUrl, type UserVideo } from '../resources/userVideos'

/** Reproductor integrado «CÓMO SE HACE». Solo muestra el vídeo del propio ejercicio; si no hay, estado no disponible + añadir. */
export function HowToSheet({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const res = resourceById(id)
  const [mine, setMine] = useState<UserVideo | undefined>()
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const vid = useRef<HTMLVideoElement>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) { setFailed(false); setErr(''); void getUserVideo(id).then(setMine) } }, [open, id])

  // Origen del vídeo: recurso oficial del ejercicio, o el propio del usuario
  useEffect(() => {
    if (!open) return
    if (res?.video) { setSrc(`${import.meta.env.BASE_URL}${res.video.src}`); return }
    if (mine?.kind === 'link') { setSrc(mine.url); return }
    if (mine?.kind === 'file') { const u = URL.createObjectURL(mine.blob); setSrc(u); return () => URL.revokeObjectURL(u) }
    setSrc(null)
  }, [open, res, mine])

  const onFile = async (f?: File) => {
    if (!f) return
    if (!f.type.startsWith('video/')) return setErr('El archivo no es un vídeo.')
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) return setErr(`El vídeo supera ${MAX_VIDEO_MB} MB.`)
    const v: UserVideo = { exerciseId: id, kind: 'file', blob: f, createdAt: Date.now() }
    await saveUserVideo(v); setMine(v); setErr(''); setFailed(false)
  }
  const onLink = async () => {
    const u = videoUrl(url)
    if (!u) return setErr('Pega un enlace directo a un archivo de vídeo (.mp4, .mov, .webm).')
    const v: UserVideo = { exerciseId: id, kind: 'link', url: u, createdAt: Date.now() }
    await saveUserVideo(v); setMine(v); setUrl(''); setErr(''); setFailed(false)
  }
  const replay = () => { const v = vid.current; if (v) { v.currentTime = 0; void v.play() } }

  return (
    <Sheet open={open} onClose={onClose} title={res?.name}>
      {src && !failed ? (
        <div className="space-y-4">
          <video ref={vid} key={src} src={src} poster={res?.video?.poster ? `${import.meta.env.BASE_URL}${res.video.poster}` : undefined}
            controls playsInline preload="metadata" onError={() => setFailed(true)}
            className="mx-auto block w-auto max-w-full max-h-[56dvh] rounded-2xl bg-black" aria-label={`Vídeo: ${res?.name ?? ''}`} />
          <div className="flex gap-2">
            <Button variant="secondary" size="md" className="flex-1" onClick={replay}><Icon name="play" size={16} /> Repetir</Button>
            {!res?.video && <Button variant="secondary" size="md" className="flex-1" onClick={async () => { await removeUserVideo(id); setMine(undefined) }}><Icon name="trash" size={16} /> Quitar</Button>}
          </div>
          {res?.video && <p className="text-[12px] text-dim leading-snug">{res.video.credit} · {res.video.license}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-s2 grid place-items-center text-mute"><Icon name="video" size={26} /></div>
            <div className="text-lg font-bold mt-4">Vídeo no disponible</div>
            {failed && <p className="text-mute text-[14px] mt-2">No se pudo reproducir el vídeo guardado.</p>}
          </div>
          <input ref={file} type="file" accept="video/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
          <Button className="w-full" onClick={() => file.current?.click()}><Icon name="upload" size={18} /> Añadir vídeo</Button>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…o enlace a un archivo .mp4" inputMode="url" autoCapitalize="none" autoCorrect="off"
            className="w-full h-12 rounded-xl bg-s2 px-4 text-[15px]" />
          {url.trim() && <Button variant="secondary" size="md" className="w-full" onClick={onLink}>Guardar enlace</Button>}
          {err && <p className="text-danger text-[13px]" role="alert">{err}</p>}
          <p className="text-[12px] text-dim leading-snug">Máx. {MAX_VIDEO_MB} MB. El archivo se queda solo en tu iPhone.</p>
        </div>
      )}
    </Sheet>
  )
}
