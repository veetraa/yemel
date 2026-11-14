import { useEffect, useRef, useState } from 'react'
import { Chip, Label } from '../../../shared/components/ui'
import { TEMPLATES } from '../data/poses'
import type { PhaseKind, Viewer, ViewName } from '../resources/sceneAnatomy'

const hasWebGL = () => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}
const KIND: Record<PhaseKind, string> = { concentric: 'Fase concéntrica', eccentric: 'Fase excéntrica', hold: 'Pausa' }
const VIEWS: [ViewName | 'libre', string][] = [['libre', 'Libre'], ['lateral', 'Lateral'], ['frontal', 'Frontal'], ['superior', 'Superior']]

/**
 * Ficha 3D interactiva: la figura 2D se muestra al instante y, cuando el visor 3D (carga diferida) está listo,
 * lo sustituye. Sin WebGL o si falla la carga, se queda la figura animada de siempre.
 */
export function ExerciseAnatomy({ anim, main, sec, onFail }: { anim: string; main: string[]; sec: string[]; onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const viewer = useRef<Viewer | null>(null)
  const speedRef = useRef(1)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [phase, setPhase] = useState(0)
  const [kind, setKind] = useState<PhaseKind | null>(null)
  const [view, setView] = useState<ViewName | 'libre'>('libre')
  const [speed, setSpeed] = useState(1)
  const key = `${main.join('|')}#${sec.join('|')}`

  useEffect(() => {
    let off = false
    setReady(false)
    if (!hasWebGL()) { onFail(); return }
    // El cuerpo 3D se genera la primera vez (se guarda en memoria); mientras tanto se ve la figura 2D
    // El modelo anatómico (GLB) se descarga la primera vez; mientras tanto se ve «Cargando…»
    void import('../resources/sceneAnatomy').then(({ createViewer }) => {
      if (off || !host.current) return
      return createViewer(host.current, anim, TEMPLATES[anim] ?? TEMPLATES.squat, main, sec, () => setPlaying(viewer.current?.isPlaying() ?? true)).then((v) => {
        if (off) { v.dispose(); return }
        viewer.current = v; v.setSpeed(speedRef.current); setPlaying(true); setReady(true)
      })
    }).catch(() => { if (!off) onFail() })
    return () => { off = true; viewer.current?.dispose(); viewer.current = null }
  }, [anim, key]) // eslint-disable-line react-hooks/exhaustive-deps

  // La barra de progreso sigue a la animación
  useEffect(() => {
    if (!ready) return
    const t = setInterval(() => { const v = viewer.current; if (v) { setPhase(v.phase()); setKind(v.kind()) } }, 100)
    return () => clearInterval(t)
  }, [ready])

  const v = () => viewer.current
  return (
    <>
      <div className="mx-6 rounded-3xl bg-s1 aspect-[4/3] grid place-items-center overflow-hidden relative">
        {!ready && <div className="text-center text-dim"><div className="w-8 h-8 mx-auto rounded-full border-2 border-white/20 border-t-white/70 animate-spin" /><div className="text-[13px] mt-3">Cargando modelo anatómico…</div></div>}
        <div ref={host} className={`absolute inset-0 ${ready ? 'bg-[radial-gradient(ellipse_at_50%_38%,#2b2e35_0%,#0b0c0f_78%)]' : 'invisible'}`} />
        <span className="absolute left-4 bottom-3 text-[11px] font-semibold uppercase tracking-wider text-dim pointer-events-none">{ready ? 'Modelo anatómico 3D' : ''}</span>
      </div>
      {ready && (
        <div className="mx-6 mt-3 space-y-3" role="group" aria-label="Controles del modelo 3D">
          <div className="flex gap-2 overflow-x-auto scroll">
            <Chip active className="!px-3.5" onClick={() => (playing ? v()?.pause() : v()?.play())}>{playing ? 'Pausar' : 'Reanudar'}</Chip>
            <Chip className="!px-3.5" onClick={() => v()?.restart()}>Reiniciar</Chip>
            <Chip className="!px-3.5" onClick={() => v()?.showPose('A')}>Inicio</Chip>
            <Chip className="!px-3.5" onClick={() => v()?.showPose('B')}>Final</Chip>
          </div>
          <div>
            <div className="flex items-center justify-between"><Label>Movimiento</Label><span className="text-[12px] font-semibold text-glow">{kind ? KIND[kind] : ''}</span></div>
            <input type="range" min={0} max={1000} value={Math.round(phase * 1000)} aria-label="Fase del movimiento"
              onChange={(e) => { const u = Number(e.target.value) / 1000; setPhase(u); v()?.setPhase(u); setKind(v()?.kind() ?? null) }}
              className="w-full mt-1.5 accent-white h-6" />
          </div>
          <div className="flex gap-2" role="radiogroup" aria-label="Velocidad">
            {[0.5, 1, 1.5].map((s) => <Chip key={s} active={speed === s} className="!px-3.5" onClick={() => { setSpeed(s); speedRef.current = s; v()?.setSpeed(s) }}>{`${String(s).replace('.', ',')}×`}</Chip>)}
          </div>
          <div className="flex gap-2 overflow-x-auto scroll" aria-label="Perspectiva">
            {VIEWS.map(([k, l]) => <Chip key={k} active={view === k} className="!px-3.5" onClick={() => { setView(k); k === 'libre' ? v()?.resetView() : v()?.setView(k) }}>{l}</Chip>)}
          </div>
        </div>
      )}
    </>
  )
}
