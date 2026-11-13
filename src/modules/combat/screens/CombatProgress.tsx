import { useMemo, useState } from 'react'
import { BarChart } from '../../../shared/components/Charts'
import { Icon } from '../../../shared/components/Icon'
import { Chip, Label } from '../../../shared/components/ui'
import { formatNumber } from '../../../shared/lib/utils'
import { weeklyLoads } from '../../../shared/services/fatigueService'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'
import type { CombatSport } from '../../../types'
import { SportHistory } from '../components/SportHistory'
import { SPORT_SHORT, sportSummary } from '../services/combatLibraryService'
import { COMBAT_SECTIONS, combatSummary } from '../services/combatService'

/** Progreso de COMBAT: estadísticas por disciplina, carga semanal de combate e historial por deporte. */
export function CombatProgress() {
  const { activities, sessions } = useStore()
  const { go } = useNav()
  const [sport, setSport] = useState<CombatSport>('MMA')
  const all = combatSummary(activities, 30)
  const loads = useMemo(() => weeklyLoads(sessions, activities, 8), [sessions, activities])
  if (!all.sessions && !activities.some((a) => a.kind === 'combat')) return (
    <div className="scroll h-full"><div className="text-center px-6 py-16"><div className="mx-auto w-14 h-14 rounded-full bg-s2 grid place-items-center text-mute"><Icon name="glove" size={26} /></div><div className="text-lg font-bold mt-4">Aún no hay datos de combate</div><p className="text-mute text-[15px] leading-relaxed mt-2">Registra tu primera sesión en Combat y aquí verás tu volumen, intensidad y evolución por disciplina.</p><button onClick={() => go('combat', 'overview')} className="mt-5 h-12 px-6 rounded-2xl bg-accent text-black font-bold">Ir a Combat</button></div></div>
  )
  return (
    <div className="scroll h-full pb-10"><div className="px-6 pt-5">
      <div className="grid grid-cols-4 gap-3">
        <Mini v={all.sessions} l="Sesiones 30d" /><Mini v={all.minutes} l="Minutos" /><Mini v={all.sparringSessions} l="Sparring" /><Mini v={all.avgRpe === undefined ? '—' : formatNumber(all.avgRpe)} l="RPE medio" />
      </div>
      <Label className="mt-10">Carga de combate semanal</Label>
      <div className="mt-3"><BarChart unit="UA" data={loads.map((w, i) => ({ label: i === loads.length - 1 ? 'Ahora' : `${new Date(w.start).getDate()}/${new Date(w.start).getMonth() + 1}`, value: Math.round(w.combat), highlight: i === loads.length - 1 }))} /></div>
      <p className="text-[12px] text-dim mt-1 leading-snug">Carga interna de combate = minutos × RPE de tus sesiones.</p>

      <Label className="mt-10">Por disciplina · 30 días</Label>
      <div className="mt-2">
        {COMBAT_SECTIONS.map((s) => {
          const c = sportSummary(activities, s, 30)
          return (
            <div key={s} className="flex items-center gap-3 py-3.5 border-b border-line/70 last:border-0">
              <div className="flex-1 font-semibold">{s}</div>
              <div className="num text-[13px] text-mute">{c.sessions} ses. · {c.minutes} min{c.avgRpe !== undefined ? ` · RPE ${formatNumber(c.avgRpe)}` : ''}</div>
            </div>
          )
        })}
      </div>

      <Label className="mt-10">Historial</Label>
      <div className="flex gap-2 overflow-x-auto scroll mt-3 -mx-6 px-6 pb-1">{COMBAT_SECTIONS.map((s) => <Chip key={s} active={s === sport} onClick={() => setSport(s)}>{SPORT_SHORT[s]}</Chip>)}</div>
      <div className="mt-4"><SportHistory sport={sport} /></div>
    </div></div>
  )
}
const Mini = ({ v, l }: { v: number | string; l: string }) => (<div><div className="num text-[22px] font-bold leading-none">{v}</div><Label className="mt-1.5 !text-[10px]">{l}</Label></div>)
