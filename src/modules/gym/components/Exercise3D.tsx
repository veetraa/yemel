import { useEffect, useRef, useState } from 'react'
import { Chip } from '../../../shared/components/ui'
import { TEMPLATES } from '../data/poses'
import { ExerciseFigure } from './ExerciseFigure'
import type { Viewer } from '../resources/scene3d'

const hasWebGL = () => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

/**
 * Ficha 3D interactiva: la figura 2D se muestra al instante y, cuando el visor 3D (carga diferida) está listo,
 * lo sustituye. Sin WebGL o si falla la carga, se queda la figura animada de siempre.
 */
export function Exercise3D({ anim, primary }: { anim: string; primary?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const viewer = useRef<Viewer | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    let off = false
    setReady(false)
    if (!hasWebGL()) return
    void import('../resources/scene3d').then(({ createViewer }) => {
      if (off || !host.current) return
      try {
        const v = createViewer(host.current, anim, TEMPLATES[anim] ?? TEMPLATES.squat, primary, () => setPlaying(v.isPlaying()))
        viewer.current = v; setPlaying(true); setReady(true)
      } catch { /* sin 3D: se mantiene la figura 2D */ }
    }).catch(() => { /* recurso no disponible: se mantiene la figura 2D */ })
    return () => { off = true; viewer.current?.dispose(); viewer.current = null }
  }, [anim, primary])

  const v = () => viewer.current
  return (
    <>
      <div className="mx-6 rounded-3xl bg-s1 aspect-[4/3] grid place-items-center overflow-hidden relative">
        {!ready && <ExerciseFigure anim={anim} primary={primary} className="w-[88%] h-[92%]" />}
        <div ref={host} className={`absolute inset-0 ${ready ? '' : 'invisible'}`} />
        <span className="absolute left-4 bottom-3 text-[11px] font-semibold uppercase tracking-wider text-dim pointer-events-none">{ready ? 'Modelo 3D' : 'Ejecución'}</span>
      </div>
      {ready && (
        <div className="mx-6 mt-3 flex gap-2 overflow-x-auto scroll" role="group" aria-label="Controles del modelo 3D">
          <Chip active className="!px-3.5" onClick={() => (playing ? v()?.pause() : v()?.play())}>{playing ? 'Pausar' : 'Reanudar'}</Chip>
          <Chip className="!px-3.5" onClick={() => v()?.restart()}>Reiniciar</Chip>
          <Chip className="!px-3.5" onClick={() => v()?.showPose('A')}>Inicio</Chip>
          <Chip className="!px-3.5" onClick={() => v()?.showPose('B')}>Final</Chip>
        </div>
      )}
    </>
  )
}
