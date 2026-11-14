import { Icon } from '../../../shared/components/Icon'
import { Label } from '../../../shared/components/ui'
import { DEFAULT_PROFILE } from '../../../shared/services/profileService'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'

/** Primeros pasos: perfil → rutina → primer entrenamiento. Se puede omitir y se oculta al completarse. */
export function SetupGuide() {
  const { settings, updateSettings, profile, body, routines, sessions } = useStore()
  const { go } = useNav()
  const steps = [
    { done: !!profile.name.trim() && (!!profile.birthDate || body.length > 0 || profile.heightCm !== DEFAULT_PROFILE.heightCm), title: 'Completa tu perfil', sub: 'Nombre, edad, altura y peso', run: () => go('profile') },
    { done: routines.some((r) => r.id !== 'hybrid-default'), title: 'Añade o importa una rutina', sub: 'Tienes una inicial; importa la tuya de ChatGPT o créala', run: () => go('gym', 'routines') },
    { done: sessions.length > 0, title: 'Empieza tu primer entrenamiento', sub: 'Elige un día y pulsa ▶', run: () => go('gym', 'today') },
  ]
  const left = steps.filter((s) => !s.done).length
  if (settings.setupDismissed || left === 0) return null
  return (
    <section className="px-6 mt-7" aria-label="Primeros pasos">
      <div className="bg-s1 rounded-[28px] p-5">
        <div className="flex items-center">
          <Label className="flex-1">Primeros pasos · {steps.length - left}/{steps.length}</Label>
          <button onClick={() => updateSettings({ setupDismissed: true })} className="text-[12px] font-semibold text-mute active:text-white">Omitir</button>
        </div>
        <ul className="mt-3 divide-y divide-line/70">
          {steps.map((s, i) => (
            <li key={i}>
              <button onClick={s.run} className="w-full flex items-center gap-3 py-3 text-left active:opacity-70">
                <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 text-[13px] font-bold ${s.done ? 'bg-accent text-black' : 'bg-s2 text-mute'}`}>{s.done ? <Icon name="check" size={14} stroke={3.2} /> : i + 1}</span>
                <div className="flex-1 min-w-0"><div className={`font-semibold text-[15px] ${s.done ? 'text-mute line-through' : ''}`}>{s.title}</div><div className="text-[12.5px] text-mute mt-0.5">{s.sub}</div></div>
                <Icon name="chev" size={16} className="text-dim" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
