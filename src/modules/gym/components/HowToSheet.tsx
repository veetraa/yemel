import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Button, Label, Sheet } from '../../../shared/components/ui'
import { imagesOf, type LibExercise } from '../library/library'
import { MAX_VIDEO_MB, VIDEOS } from '../resources/catalog'
import { getUserVideo, removeUserVideo, saveUserVideo, videoUrl, type UserVideo } from '../resources/userVideos'

/**
 * «CÓMO SE HACE». Con vídeo (oficial con licencia verificada o propio): reproductor integrado, sin reproducción
 * automática y cargado solo al abrir. Sin vídeo: imágenes de referencia (inicio/final) e instrucciones.
 */
export function HowToSheet({ id, name, lib, steps, open, onClose }: { id: string; name: string; lib: LibExercise | null; steps: string[]; open: boolean; onClose: () => void }) {
  const official = VIDEOS[id] ?? lib?.video ?? null
  const [mine, setMine] = useState<UserVideo | undefined>()
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const vid = useRef<HTMLVideoElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const img = imagesOf(lib)

  useEffect(() => { if (open) { setFailed(false); setErr(''); setAdding(false); void getUserVideo(id).then(setMine) } }, [open, id])

  // Origen del vídeo: oficial del propio ejercicio, o el propio del usuario
  useEffect(() => {
    if (!open) return
    if (official) { setSrc(`${import.meta.env.BASE_URL}${official.src}`); return }
    if (mine?.kind === 'link') { setSrc(mine.url); return }
    if (mine?.kind === 'file') { const u = URL.createObjectURL(mine.blob); setSrc(u); return () => URL.revokeObjectURL(u) }
    setSrc(null)
  }, [open, official, mine])

  const onFile = async (f?: File) => {
    if (!f) return
    if (!f.type.startsWith('video/')) return setErr('El archivo no es un vídeo.')
    if (f.size > MAX_VIDEO_MB * 1024 * 1024) return setErr(`El vídeo supera ${MAX_VIDEO_MB} MB.`)
    const v: UserVideo = { exerciseId: id, kind: 'file', blob: f, createdAt: Date.now() }
    await saveUserVideo(v); setMine(v); setErr(''); setFailed(false); setAdding(false)
  }
  const onLink = async () => {
    const u = videoUrl(url)
    if (!u) return setErr('Pega un enlace directo a un archivo de vídeo (.mp4, .mov, .webm).')
    const v: UserVideo = { exerciseId: id, kind: 'link', url: u, createdAt: Date.now() }
    await saveUserVideo(v); setMine(v); setUrl(''); setErr(''); setFailed(false); setAdding(false)
  }
  const replay = () => { const v = vid.current; if (v) { v.currentTime = 0; void v.play() } }
  const playing = src && !failed

  return (
    <Sheet open={open} onClose={onClose} title={name}>
      <div className="space-y-4">
        {playing ? (
          <>
            <video ref={vid} key={src} src={src} controls playsInline preload="metadata" onError={() => setFailed(true)}
              className="mx-auto block w-auto max-w-full max-h-[56dvh] rounded-2xl bg-black" aria-label={`Vídeo: ${name}`} />
            <div className="flex gap-2">
              <Button variant="secondary" size="md" className="flex-1" onClick={replay}><Icon name="play" size={16} /> Repetir</Button>
              {!official && <Button variant="secondary" size="md" className="flex-1" onClick={async () => { await removeUserVideo(id); setMine(undefined) }}><Icon name="trash" size={16} /> Quitar</Button>}
            </div>
            {official && <p className="text-[12px] text-dim leading-snug">{official.credit} · {official.license}</p>}
          </>
        ) : (
          <>
            {img && (
              <div className={`grid gap-2 ${img.end ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {[img.start ?? img.main, img.end].filter(Boolean).map((s, i) => (
                  <figure key={s} className="rounded-2xl overflow-hidden bg-white/95 relative aspect-square">
                    <img src={s} alt={`${name}: ${i ? 'posición final' : 'posición inicial'}`} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                    {img.end && <figcaption className="absolute left-2 bottom-2 text-[10.5px] font-bold uppercase tracking-wider bg-black/60 text-white rounded-full px-2 py-0.5">{i ? 'Final' : 'Inicio'}</figcaption>}
                  </figure>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-mute text-[13.5px]"><Icon name="video" size={18} className="text-dim" />{failed ? 'No se pudo reproducir el vídeo guardado.' : 'Vídeo no disponible para este ejercicio.'}</div>
            {steps.length > 0 && (
              <div>
                <Label>Instrucciones</Label>
                <ol className="mt-3 space-y-3">{steps.slice(0, 7).map((s, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><span className="num w-5 shrink-0 text-glow font-bold">{i + 1}</span><span className="text-[#d8d8dc]">{s}</span></li>)}</ol>
              </div>
            )}
          </>
        )}

        {!official && !playing && (
          adding ? (
            <div className="space-y-3 pt-1">
              <input ref={file} type="file" accept="video/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
              <Button className="w-full" onClick={() => file.current?.click()}><Icon name="upload" size={18} /> Elegir vídeo del iPhone</Button>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…o enlace a un archivo .mp4" inputMode="url" autoCapitalize="none" autoCorrect="off" className="w-full h-12 rounded-xl bg-s2 px-4 text-[15px]" />
              {url.trim() && <Button variant="secondary" size="md" className="w-full" onClick={onLink}>Guardar enlace</Button>}
              {err && <p className="text-danger text-[13px]" role="alert">{err}</p>}
              <p className="text-[12px] text-dim leading-snug">Máx. {MAX_VIDEO_MB} MB. El archivo se queda solo en tu iPhone.</p>
            </div>
          ) : (
            <Button variant="secondary" size="md" className="w-full" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Añadir mi propio vídeo</Button>
          )
        )}
      </div>
    </Sheet>
  )
}
