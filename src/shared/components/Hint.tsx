import type { ReactNode } from 'react'
import { useStore } from '../../store'
import { Icon } from './Icon'

/** Ayuda contextual breve: se cierra con la X y no vuelve a salir (se puede reactivar en Perfil → Ajustes de la app). */
export function Hint({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const { settings, updateSettings } = useStore()
  if (settings.hintsSeen?.includes(id)) return null
  return (
    <div role="note" className={`bg-s1 rounded-2xl pl-3.5 pr-1.5 py-2.5 flex items-start gap-2.5 text-[13.5px] leading-snug text-mute ${className}`}>
      <Icon name="info" size={17} className="shrink-0 mt-0.5 text-glow" />
      <div className="flex-1 py-0.5">{children}</div>
      <button aria-label="Cerrar ayuda" onClick={() => updateSettings({ hintsSeen: [...(settings.hintsSeen ?? []), id] })} className="w-8 h-8 grid place-items-center text-dim shrink-0 active:text-white"><Icon name="x" size={16} /></button>
    </div>
  )
}
