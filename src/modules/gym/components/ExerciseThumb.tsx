import { useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { exerciseById } from '../data/exercises'
import { useLibraryIndex } from '../library/hooks'
import { matchExact, thumbOf } from '../library/library'
import { ExerciseFigure } from './ExerciseFigure'

/** Miniatura de un ejercicio: ilustración de la biblioteca (solo la suya); si no hay, la figura propia o un icono. */
export function ExerciseThumb({ exerciseId, name, className = 'w-10 h-10' }: { exerciseId?: string; name: string; className?: string }) {
  const index = useLibraryIndex()
  const [broken, setBroken] = useState(false)
  const id = exerciseId ?? matchExact(name)?.id
  const core = exerciseById(id)
  const src = id && index ? thumbOf(index.find((i) => i.id === id) ?? { id, i: 0 }) : null
  if (src && !broken) return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} className={`${className} object-cover rounded-lg`} />
  if (core) return <ExerciseFigure anim={core.anim} primary={core.primary} animated={false} className={className} />
  return <Icon name="bolt" size={18} className="text-dim" />
}
