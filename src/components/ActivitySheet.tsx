import { useState } from 'react'
import { dateKey } from '../lib/profile'
import { useStore } from '../store'
import { MultiChips, NumInput, TextInput } from './fields'
import { Button, Label, Sheet } from './ui'

const RPE_HINT: Record<number, string> = { 1: 'Muy suave', 3: 'Suave', 5: 'Moderado', 7: 'Duro', 9: 'Muy duro', 10: 'Máximo' }

/** Registro de una actividad fuera del gimnasio (Jiu-Jitsu, carrera…) para la carga semanal */
export function ActivitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, addActivity, showToast } = useStore()
  const others = profile.sports.filter((s) => s !== 'Gimnasio')
  const options = others.length ? others : ['Jiu-Jitsu']
  const [sport, setSport] = useState<string[]>([])
  const [minutes, setMinutes] = useState<number | undefined>()
  const [rpe, setRpe] = useState<number>(7)
  const [date, setDate] = useState(dateKey())
  const chosen = sport[0] ?? options[0]
  const mins = minutes ?? (chosen === 'Jiu-Jitsu' ? profile.bjjMinutes : undefined)

  const save = () => {
    if (!mins) return showToast('Indica la duración')
    const ts = new Date(`${date}T12:00:00`).getTime()
    addActivity({ ts: Math.min(ts, Date.now()), sport: chosen, minutes: mins, rpe })
    showToast(`${chosen} registrado`)
    setMinutes(undefined)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Registrar actividad">
      <p className="text-[13.5px] text-mute leading-relaxed">Cuenta para tu carga semanal junto al gimnasio, de modo que el entrenador pueda evitar acumular demasiada fatiga.</p>
      <div className="mt-5 space-y-5">
        <MultiChips single options={options} value={[chosen]} onChange={(v) => setSport(v)} />
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Duración" unit="min" value={mins} onChange={setMinutes} max={600} />
          <TextInput label="Fecha" type="date" value={date} onChange={setDate} />
        </div>
        <div>
          <div className="flex justify-between items-baseline"><Label>Esfuerzo percibido (RPE)</Label><span className="text-[12px] text-mute">{RPE_HINT[rpe] ?? ''}</span></div>
          <div className="grid grid-cols-10 gap-1 mt-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setRpe(n)} aria-pressed={rpe === n} aria-label={`RPE ${n}`} className={`h-11 rounded-lg num text-[14px] font-bold ${rpe === n ? 'bg-accent text-black' : n < rpe ? 'bg-s3 text-white' : 'bg-s2 text-mute'}`}>{n}</button>
            ))}
          </div>
        </div>
        <Button className="w-full" onClick={save}>GUARDAR</Button>
      </div>
    </Sheet>
  )
}
