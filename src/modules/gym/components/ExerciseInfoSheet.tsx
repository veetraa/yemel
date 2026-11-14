import { useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Label, Sheet } from '../../../shared/components/ui'
import { exerciseById } from '../data/exercises'
import { useLibraryExercise } from '../library/hooks'
import { imagesOf } from '../library/library'
import { ExerciseFigure } from './ExerciseFigure'

/** Ficha rápida durante el entrenamiento: imagen de referencia, músculos, instrucciones y errores (no sustituye al registro). */
export function ExerciseInfoSheet({ exerciseId, name, open, onClose }: { exerciseId?: string; name: string; open: boolean; onClose: () => void }) {
  const core = exerciseById(exerciseId)
  const lib = useLibraryExercise(open ? exerciseId : undefined)
  const img = imagesOf(lib)
  const [end, setEnd] = useState(false)
  const steps = (lib?.steps?.length ? lib.steps : core?.steps) ?? []
  const primary = core?.primary ?? lib?.primary
  const secondary = core?.secondary ?? lib?.secondary ?? []
  const equipment = core?.equipment ?? lib?.equipment ?? []
  const src = img ? (end && img.end ? img.end : img.start ?? img.main) : undefined
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="rounded-3xl bg-bg aspect-[4/3] grid place-items-center overflow-hidden" onClick={() => img?.end && setEnd(!end)}>
        {src ? <img src={src} alt={`${name}: ${end ? 'posición final' : 'posición inicial'}`} decoding="async" className="w-full h-full object-contain bg-white/95" /> : core ? <ExerciseFigure anim={core.anim} primary={core.primary} className="w-[88%] h-[92%]" /> : <div className="text-dim text-[13px]">{lib === undefined ? 'Cargando…' : 'Sin imagen de referencia'}</div>}
      </div>
      {img?.end && <p className="text-[12px] text-dim text-center mt-2">Toca la imagen para ver {end ? 'el inicio' : 'el final'}</p>}
      <h3 className="text-xl font-bold mt-4">{name}</h3>
      {primary && <div className="text-mute text-sm mt-1">{primary}{secondary.length ? ` · ${secondary.join(', ')}` : ''}{equipment.length ? ` · ${equipment.join(', ')}` : ''}</div>}
      {steps.length > 0 && <ol className="mt-4 space-y-3">{steps.slice(0, 6).map((s, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><span className="text-glow font-bold num">{i + 1}</span><span className="text-[#d8d8dc]">{s}</span></li>)}</ol>}
      {lib && lib.mistakes.length > 0 && (
        <>
          <Label className="mt-6">Errores que evitar</Label>
          <ul className="mt-3 space-y-2.5">{lib.mistakes.slice(0, 3).map((x, i) => <li key={i} className="flex gap-3 text-[14.5px] leading-snug"><Icon name="x" size={17} className="shrink-0 mt-0.5 text-danger" /><span><span className="text-white font-semibold">{x.m}</span> <span className="text-mute">{x.c}</span></span></li>)}</ul>
        </>
      )}
    </Sheet>
  )
}
