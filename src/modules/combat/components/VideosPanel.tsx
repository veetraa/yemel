import { useEffect, useRef, useState } from 'react'
import { TextInput } from '../../../shared/components/fields'
import { Icon } from '../../../shared/components/Icon'
import { Button, Label, Sheet } from '../../../shared/components/ui'
import { formatDateShort } from '../../../shared/lib/utils'
import { useStore } from '../../../store'
import type { CombatSport, CombatVideo } from '../../../types'
import { normalizeUrl, useCombatMedia } from '../store'

const MAX_MB = 400

/** Vídeos propios de una disciplina: archivos privados (se guardan solo en el dispositivo) o enlaces. */
export function VideosPanel({ sport, techniqueId }: { sport: CombatSport; techniqueId?: string }) {
  const { videos, addFile, addLink, removeVideo } = useCombatMedia()
  const { showToast } = useStore()
  const list = videos.filter((v) => v.sport === sport && (!techniqueId || v.techniqueId === techniqueId))
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [play, setPlay] = useState<CombatVideo | null>(null)
  const [src, setSrc] = useState<string>()
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (play?.kind === 'file' && play.blob) { const u = URL.createObjectURL(play.blob); setSrc(u); return () => URL.revokeObjectURL(u) }
    setSrc(undefined)
  }, [play])

  const onFile = async (f?: File) => {
    if (!f) return
    if (f.size > MAX_MB * 1048576) return showToast(`El vídeo supera ${MAX_MB} MB`)
    await addFile(sport, title || f.name.replace(/\.[^.]+$/, ''), f, techniqueId)
    setTitle(''); setAdding(false); showToast('Vídeo guardado en este dispositivo')
  }
  const saveLink = () => {
    const u = normalizeUrl(url)
    if (!u) return showToast('El enlace no es válido')
    addLink(sport, title || new URL(u).hostname, u, techniqueId)
    setTitle(''); setUrl(''); setAdding(false); showToast('Enlace guardado')
  }

  return (
    <>
      <p className="text-[13.5px] text-mute leading-relaxed">Guarda tus vídeos de clase o de referencia. Los archivos se quedan <b className="text-white">solo en tu iPhone</b> (funcionan sin conexión); también puedes guardar enlaces.</p>
      <Button variant="secondary" size="md" className="w-full mt-4" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Añadir vídeo</Button>
      {list.length === 0 ? (
        <div className="text-center px-6 py-10"><div className="mx-auto w-14 h-14 rounded-full bg-s2 grid place-items-center text-mute"><Icon name="video" size={26} /></div><div className="font-bold mt-4">Aún no tienes vídeos de {sport}</div></div>
      ) : (
        <div className="mt-4">
          {list.map((v) => (
            <div key={v.id} className="flex items-center gap-3 py-3.5 border-b border-line/70 last:border-0">
              <button onClick={() => (v.kind === 'link' ? window.open(v.url, '_blank', 'noopener') : setPlay(v))} className="flex-1 flex items-center gap-3 text-left min-w-0">
                <span className="w-12 h-12 rounded-xl bg-s2 grid place-items-center text-glow shrink-0"><Icon name={v.kind === 'file' ? 'play' : 'video'} size={20} /></span>
                <span className="min-w-0"><span className="block font-semibold truncate">{v.title}</span><span className="block text-[12.5px] text-mute">{v.kind === 'file' ? `Archivo · ${v.blob ? Math.round(v.blob.size / 1048576) : '?'} MB` : 'Enlace externo'} · {formatDateShort(v.createdAt)}</span></span>
              </button>
              <button aria-label={`Eliminar ${v.title}`} onClick={() => removeVideo(v.id)} className="w-9 h-9 grid place-items-center text-dim"><Icon name="trash" size={17} /></button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Añadir vídeo">
        <div className="space-y-4">
          <TextInput label="Título" value={title} onChange={setTitle} placeholder="Clase de martes, drill de guardia…" />
          <input ref={file} type="file" accept="video/*" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
          <Button className="w-full" onClick={() => file.current?.click()}><Icon name="upload" size={18} /> Elegir vídeo del iPhone</Button>
          <p className="text-[12px] text-dim leading-snug">Se guarda de forma privada en este dispositivo (máx. {MAX_MB} MB) y no se incluye en la copia de seguridad.</p>
          <div className="h-px bg-line" />
          <TextInput label="…o pega un enlace" value={url} onChange={setUrl} placeholder="https://" />
          <Button variant="secondary" className="w-full" disabled={!url.trim()} onClick={saveLink}>Guardar enlace</Button>
        </div>
      </Sheet>
      <Sheet open={!!play} onClose={() => setPlay(null)} title={play?.title}>
        {src && <video src={src} controls playsInline className="w-full rounded-2xl bg-black max-h-[60dvh]" aria-label={play?.title} />}
        <Label className="mt-3">Archivo guardado solo en este dispositivo</Label>
      </Sheet>
    </>
  )
}
