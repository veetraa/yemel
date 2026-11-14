import { useEffect, useRef, useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Chip } from '../../../shared/components/ui'

export interface DemoSource { src: string; webm?: string; poster?: string }
const SPEEDS = [0.5, 1, 1.5] as const

/**
 * Reproductor de la demostración de un ejercicio: sin reproducción automática, con reproducir/pausar, repetir,
 * velocidad 0,5× / 1× / 1,5× y bucle. Usa `playsInline` para reproducirse dentro de la página en Safari de iPhone.
 * El vídeo solo se descarga al pulsar reproducir (preload="none" con póster, o "metadata" sin póster).
 */
export function DemoPlayer({ video, name, onFail }: { video: DemoSource; name: string; onFail?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const [loop, setLoop] = useState(true)
  useEffect(() => { if (ref.current) ref.current.playbackRate = speed }, [speed])
  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) void v.play(); else v.pause() }
  const replay = () => { const v = ref.current; if (!v) return; v.currentTime = 0; v.playbackRate = speed; void v.play() }
  const base = import.meta.env.BASE_URL
  return (
    <>
      <div className="mx-6 rounded-3xl bg-black aspect-[4/3] overflow-hidden relative" data-testid="demo-player">
        <video ref={ref} playsInline loop={loop} preload={video.poster ? 'none' : 'metadata'} poster={video.poster ? `${base}${video.poster}` : undefined}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onRateChange={(e) => e.currentTarget.playbackRate !== speed && (e.currentTarget.playbackRate = speed)} onError={onFail}
          onClick={toggle} className="w-full h-full object-contain" aria-label={`Demostración: ${name}`}>
          <source src={`${base}${video.src}`} type="video/mp4" />
          {video.webm && <source src={`${base}${video.webm}`} type="video/webm" />}
        </video>
        {!playing && (
          <button onClick={toggle} aria-label="Reproducir" className="absolute inset-0 grid place-items-center"><span className="w-16 h-16 rounded-full bg-white/90 text-black grid place-items-center"><Icon name="play" size={26} /></span></button>
        )}
      </div>
      <div className="mx-6 mt-3 space-y-3" role="group" aria-label="Controles del vídeo">
        <div className="flex gap-2 overflow-x-auto scroll">
          <Chip active className="!px-3.5" onClick={toggle}>{playing ? 'Pausar' : 'Reproducir'}</Chip>
          <Chip className="!px-3.5" onClick={replay}>Repetir</Chip>
          <Chip active={loop} className="!px-3.5" onClick={() => setLoop(!loop)}>Bucle</Chip>
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label="Velocidad">
          {SPEEDS.map((s) => <Chip key={s} active={speed === s} className="!px-3.5" onClick={() => setSpeed(s)}>{`${String(s).replace('.', ',')}×`}</Chip>)}
        </div>
      </div>
    </>
  )
}
