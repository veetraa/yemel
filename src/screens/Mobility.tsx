import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Button, Header, Label } from '../components/ui'
import { MOBILITY_ROUTINE, RECOVERY_RPE } from '../services/recoveryService'
import { formatClock } from '../lib/utils'
import { useNav } from '../nav'
import { useStore } from '../store'

/** Recuperación activa: movilidad suave. Cuenta como actividad de baja carga (RPE 2). */
export function MobilityScreen() {
  const { addActivity, showToast } = useStore()
  const { pop } = useNav()
  const [done, setDone] = useState<number[]>([])
  const seconds = MOBILITY_ROUTINE.filter((_, i) => done.includes(i)).reduce((a, d) => a + d.seconds, 0)
  const toggle = (i: number) => setDone(done.includes(i) ? done.filter((x) => x !== i) : [...done, i])

  const finish = () => {
    const minutes = Math.max(1, Math.round(seconds / 60))
    addActivity({ ts: Date.now(), sport: 'Movilidad', minutes, rpe: RECOVERY_RPE, kind: 'recovery', note: `${done.length} de ${MOBILITY_ROUTINE.length} ejercicios` })
    showToast('Recuperación registrada')
    pop()
  }

  return (
    <div className="h-full flex flex-col">
      <Header title="Recuperación activa" onBack={pop} />
      <div className="scroll flex-1 px-6 pb-8">
        <p className="text-mute text-[15px] leading-relaxed">Movilidad suave y respiración, sin buscar fatiga. Marca lo que vayas haciendo; si hoy no te apetece todo, no pasa nada.</p>
        <Label className="mt-8">Ejercicios · {MOBILITY_ROUTINE.length}</Label>
        <div className="mt-1">
          {MOBILITY_ROUTINE.map((d, i) => (
            <button key={d.name} onClick={() => toggle(i)} aria-pressed={done.includes(i)} className="w-full flex items-center gap-4 py-4 border-b border-line/70 last:border-0 text-left">
              <span className={`w-9 h-9 rounded-full grid place-items-center shrink-0 transition ${done.includes(i) ? 'bg-accent text-black' : 'bg-s2 text-dim'}`}>{done.includes(i) ? <Icon name="check" size={18} stroke={3} /> : <span className="num text-sm font-bold">{i + 1}</span>}</span>
              <span className="flex-1 min-w-0"><span className="block font-semibold">{d.name}</span><span className="block text-[13px] text-mute mt-0.5 leading-snug">{d.detail}</span></span>
              <span className="num text-[13px] text-dim">{formatClock(d.seconds)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="px-6 pt-3 pb-safe pb-4 border-t border-line/70">
        <Button className="w-full" disabled={!done.length} onClick={finish}>COMPLETAR · {Math.max(1, Math.round(seconds / 60))} min</Button>
      </div>
    </div>
  )
}
