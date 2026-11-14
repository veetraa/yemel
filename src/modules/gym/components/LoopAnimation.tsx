import { useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import type { LicensedAnimation } from '../resources/catalog'

/** Animación en bucle (GIF) de un ejercicio, sin deformarla: se escala manteniendo la proporción. La atribución está en Perfil → Créditos. */
export function LoopAnimation({ anim, name }: { anim: LicensedAnimation; name: string }) {
  const [failed, setFailed] = useState(false)
  const base = import.meta.env.BASE_URL
  return (
    <div className="mx-6 rounded-3xl bg-white aspect-[4/3] overflow-hidden relative grid place-items-center" data-testid="loop-animation">
      {failed ? (
        <div className="text-center text-neutral-500 px-6"><Icon name="bolt" size={26} className="mx-auto" /><div className="text-[13px] mt-2">Animación no disponible</div></div>
      ) : (
        <img src={`${base}${anim.src}`} width={anim.width} height={anim.height} alt={`Demostración animada: ${name}`} decoding="async" onError={() => setFailed(true)}
          className="h-full w-auto max-w-full object-contain" style={{ aspectRatio: `${anim.width} / ${anim.height}` }} />
      )}
    </div>
  )
}
