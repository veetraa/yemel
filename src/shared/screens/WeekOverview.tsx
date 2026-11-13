/**
 * Semana y recuperación (pantalla GLOBAL de solo lectura + descansos).
 * La semana se compone de tres fuentes independientes: cada una se edita en SU sección.
 */
import { useState } from 'react'
import { Icon } from '../components/Icon'
import { WeekdayChips } from '../components/fields'
import { Button, Header, Label, Sheet } from '../components/ui'
import { WEEKDAYS } from '../lib/utils'
import { SLOT_LABEL, errorsOf, validatePlan, type PlanIssue } from '../services/planningService'
import { useNav } from '../../nav'
import { useStore } from '../../store'
import type { SlotType } from '../../types'

const TONE: Record<SlotType, string> = { gym: 'bg-white text-black', combat: 'bg-accent text-black', recovery: 'bg-s3 text-white', rest: 'bg-s1 text-dim border border-line' }
const LEVEL = { error: 'text-danger', warning: 'text-[#ffb340]', info: 'text-mute' } as const

export function WeekOverview() {
  const { plan, profile, planRoutine, setRestDays, resetWeek, showToast } = useStore()
  const { pop, go } = useNav()
  const [reset, setReset] = useState(false)
  const [blocked, setBlocked] = useState<PlanIssue[]>([])
  const issues = validatePlan(plan, profile, planRoutine)
  const count = (t: SlotType) => plan.slots.filter((s) => s.type === t).length
  const gymN = plan.slots.filter((s) => s.routineDayId).length
  const rec = count('recovery') + count('rest')

  return (
    <div className="h-full flex flex-col">
      <Header title="Semana y recuperación" onBack={pop} />
      <div className="scroll flex-1 px-6 pb-10">
        <p className="text-mute text-[14.5px] leading-relaxed">Vista global. Los días de <b className="text-white">gimnasio</b> se editan en Gym, las sesiones de <b className="text-white">combate</b> en Combat, y aquí eliges tus días de <b className="text-white">descanso completo</b>. Cualquier cambio se comprueba contra las reglas de recuperación.</p>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Count label="Gimnasio" n={gymN} target={profile.weeklyGoal} />
          <Count label="Combate" n={count('combat')} target={profile.contactSessionsPerWeek} />
          <Count label="Recuperación" n={rec} target={profile.recoveryDaysPerWeek ?? 2} min />
        </div>

        <div className="mt-7">
          {plan.slots.map((s) => (
            <div key={s.day} className="flex items-center gap-4 py-3.5 border-b border-line/70 last:border-0">
              <div className="w-12 text-[12px] font-semibold uppercase tracking-wider text-mute">{WEEKDAYS[s.day].slice(0, 3)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[16px] tracking-tight truncate">{s.label}{s.type === 'combat' && s.routineDayId ? <span className="text-mute font-normal text-[13px]"> + gimnasio</span> : null}</div>
                <div className="text-[12.5px] text-mute mt-0.5 leading-snug">{s.focus ?? SLOT_LABEL[s.type]}</div>
              </div>
              <span className={`text-[10.5px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 ${TONE[s.type]}`}>{SLOT_LABEL[s.type]}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4">
          <Button size="sm" variant="secondary" onClick={() => go('gym', 'routines')}><Icon name="gym" size={16} /> Editar días de gym</Button>
          <Button size="sm" variant="secondary" onClick={() => go('combat', 'overview')}><Icon name="glove" size={16} /> Editar combate</Button>
        </div>

        <Label className="mt-9">Días de descanso completo</Label>
        <div className="mt-3"><WeekdayChips value={profile.restDays ?? []} onChange={(v) => { const r = setRestDays(v); if (r.ok) { setBlocked([]); showToast('Descansos actualizados') } else setBlocked(errorsOf(r.issues)) }} /></div>
        <p className="text-[12px] text-dim mt-2 leading-snug">Los demás días libres son de recuperación activa (movilidad). Necesitas al menos un descanso completo.</p>
        {blocked.length > 0 && (
          <div className="mt-4 rounded-xl bg-danger/10 px-3.5 py-3" role="alert">
            <div className="text-[12px] font-bold uppercase tracking-wider text-danger">No se puede aplicar</div>
            {blocked.map((i, n) => <div key={n} className="text-[14px] mt-1 leading-snug">{i.message}</div>)}
          </div>
        )}

        <Label className="mt-10">Comprobación de la semana</Label>
        {issues.length === 0 ? (
          <div className="mt-2 flex items-center gap-2 text-accent font-semibold"><Icon name="check" size={18} stroke={2.6} /> Semana equilibrada</div>
        ) : (
          <ul className="mt-2 space-y-2">
            {[...issues].sort((a, b) => ['error', 'warning', 'info'].indexOf(a.level) - ['error', 'warning', 'info'].indexOf(b.level)).map((i, n) => (
              <li key={n} className={`text-[14px] leading-snug flex gap-2.5 ${LEVEL[i.level]}`}><span className="shrink-0">{i.level === 'error' ? '✕' : i.level === 'warning' ? '⚠' : 'ℹ'}</span><span className="text-[#d8d8dc]">{i.message}</span></li>
            ))}
          </ul>
        )}
        <Button variant="ghost" size="md" className="w-full mt-8 border border-line" onClick={() => setReset(true)}>Restaurar semana por defecto</Button>
      </div>
      <Sheet open={reset} onClose={() => setReset(false)} title="¿Restaurar la semana?">
        <p className="text-mute leading-relaxed">Vuelve a la semana del propietario: GYM A/B/C (lun, jue, sáb), combate (mar, vie) y descanso el domingo. Tu historial no se toca.</p>
        <div className="mt-5 flex gap-2"><Button variant="secondary" className="flex-1" onClick={() => setReset(false)}>Cancelar</Button><Button className="flex-1" onClick={() => { resetWeek(); setReset(false); showToast('Semana restaurada') }}>Restaurar</Button></div>
      </Sheet>
    </div>
  )
}

function Count({ label, n, target, min }: { label: string; n: number; target?: number; min?: boolean }) {
  const ok = target === undefined || (min ? n >= target : n === target)
  return (
    <div className="bg-s1 rounded-2xl px-3.5 py-3">
      <div className={`num text-[24px] font-bold leading-none ${ok ? '' : 'text-[#ffb340]'}`}>{n}{target !== undefined && <span className="text-mute text-base">/{target}{min ? '+' : ''}</span>}</div>
      <Label className="mt-1.5 !text-[10px]">{label}</Label>
    </div>
  )
}
