import { useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Button, Label } from '../../../shared/components/ui'
import { INTENSITY_LABEL } from '../services/combatService'
import { WEEKDAYS, formatNumber } from '../../../shared/lib/utils'
import { nextCombat } from '../../../shared/services/planningService'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'
import { CombatSheet } from '../components/CombatSheet'
import { SessionEditor } from '../components/SessionEditor'
import { combatSummary } from '../services/combatService'

/** Resumen de COMBAT: próxima sesión, mi semana de combate y balance de 30 días. */
export function CombatOverview() {
  const { ctx, combatPlan, activities, adjustment } = useStore()
  const { push } = useNav()
  const [log, setLog] = useState(false)
  const [editDay, setEditDay] = useState<number | null>(null)
  const next = nextCombat(ctx)
  const cs = combatSummary(activities, 30)
  // Indicador global de recuperación que afecta al combate (compartido, solo lectura)
  const recovery = adjustment.codes.filter((c) => c === 'LOW_READINESS' || c === 'HIGH_LOAD' || c === 'HARD_STREAK')

  return (
    <div className="scroll h-full pb-8">
      <div className="px-6 pt-5">
        <Label>Próxima sesión</Label>
        {next ? (
          <>
            <div className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{next.slot.label}</div>
            <div className="text-mute mt-1 text-[15px] leading-snug">{next.label}{next.offset > 1 ? '' : ''}{next.slot.focus ? ` · ${next.slot.focus}` : ''}</div>
            <div className="flex flex-wrap gap-2 mt-3">
              {next.slot.intensity && <span className="text-[12px] font-semibold bg-s2 rounded-full px-3 py-1">Intensidad prevista: {INTENSITY_LABEL[next.slot.intensity].toLowerCase()}</span>}
              {next.slot.combat?.sparring && <span className="text-[12px] font-semibold text-accent border border-accent/50 rounded-full px-3 py-1">Sparring según nivel</span>}
              {next.slot.combat?.disciplines.map((d) => <span key={d} className="text-[12px] text-mute bg-s2 rounded-full px-3 py-1">{d}</span>)}
            </div>
          </>
        ) : <div className="mt-2 text-[22px] font-bold">Sin sesiones planificadas</div>}
        <Button className="w-full mt-5 tracking-[0.06em]" onClick={() => setLog(true)}><Icon name="plus" size={20} stroke={2.4} /> REGISTRAR SESIÓN</Button>
        {recovery.length > 0 && <p className="mt-4 text-[13px] text-[#ffb340] leading-snug flex gap-2"><Icon name="info" size={16} className="shrink-0 mt-0.5" />Tu indicador de recuperación pide moderar la intensidad hoy: elige técnica y ritmo suave.</p>}
      </div>

      <div className="px-6 mt-9">
        <div className="flex items-end justify-between"><Label>Mi semana de combate</Label><button onClick={() => push({ name: 'combat.import' })} className="text-[12px] font-semibold text-accent">Importar</button></div>
        <div className="mt-2">
          {WEEKDAYS.map((name, day) => {
            const s = combatPlan.sessions.find((x) => x.day === day)
            return (
              <button key={day} onClick={() => setEditDay(day)} className="w-full flex items-center gap-4 py-3.5 border-b border-line/70 last:border-0 text-left active:bg-s1">
                <div className="w-12 text-[12px] font-semibold uppercase tracking-wider text-mute">{name.slice(0, 3)}</div>
                {s ? (
                  <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-bold truncate">{s.label}</span>{s.sparring && <span className="text-[10px] font-bold text-accent border border-accent/50 rounded px-1.5 py-0.5">SPARRING</span>}</div>
                    <div className="text-[12.5px] text-mute mt-0.5">{s.sport} · {INTENSITY_LABEL[s.intensity].toLowerCase()}{s.minutes ? ` · ${s.minutes} min` : ''}</div></div>
                ) : <div className="flex-1 text-[14px] text-dim">Libre</div>}
                <Icon name={s ? 'chev' : 'plus'} size={16} className="text-dim" />
              </button>
            )
          })}
        </div>
        <p className="text-[12px] text-dim mt-3 leading-snug">Cada cambio se comprueba contra tus reglas de recuperación globales (días de descanso, días seguidos, piernas antes de combate).</p>
      </div>

      <div className="px-6 mt-9">
        <Label>Últimos 30 días</Label>
        <div className="grid grid-cols-4 gap-3 mt-3">
          <Mini v={cs.sessions} l="Sesiones" /><Mini v={cs.minutes} l="Minutos" /><Mini v={cs.sparringSessions} l="Sparring" /><Mini v={cs.avgRpe === undefined ? '—' : formatNumber(cs.avgRpe)} l="RPE medio" />
        </div>
      </div>

      <CombatSheet open={log} onClose={() => setLog(false)} />
      <SessionEditor day={editDay} open={editDay !== null} onClose={() => setEditDay(null)} />
    </div>
  )
}

const Mini = ({ v, l }: { v: number | string; l: string }) => (<div><div className="num text-[22px] font-bold leading-none">{v}</div><Label className="mt-1.5 !text-[10px]">{l}</Label></div>)
