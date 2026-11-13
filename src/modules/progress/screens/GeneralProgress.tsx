import { useMemo, useState } from 'react'
import { StackedBars } from '../../../shared/components/Charts'
import { Chip, Empty, Label, Row } from '../../../shared/components/ui'
import { Icon } from '../../../shared/components/Icon'
import { formatDateShort, formatDuration, formatNumber, formatVolume, toDisplay } from '../../../shared/lib/utils'
import { weeklyLoads } from '../../../shared/services/fatigueService'
import { sessionDuration, sessionVolume } from '../../gym/services/workoutService'
import { isCombat } from '../../combat/services/combatService'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'

type Filter = 'all' | 'gym' | 'combat' | 'recovery'

/** Historial general: la única vista que reúne todas las áreas, con filtros por área. */
export function GeneralProgress() {
  const { sessions, activities, settings } = useStore()
  const { push } = useNav()
  const [f, setF] = useState<Filter>('all')
  const loads = useMemo(() => weeklyLoads(sessions, activities, 6), [sessions, activities])
  const items = useMemo(() => [
    ...sessions.map((s) => ({ key: s.id, ts: s.endedAt, area: 'gym' as const, title: s.dayName, sub: `${formatDuration(sessionDuration(s))} · ${formatVolume(toDisplay(sessionVolume(s), settings.unit)).replace(' kg', ` ${settings.unit}`)}`, go: () => push({ name: 'gym.session', id: s.id }) })),
    ...activities.map((a) => ({ key: a.id, ts: a.ts, area: (a.kind === 'recovery' ? 'recovery' : isCombat(a) ? 'combat' : 'combat') as 'combat' | 'recovery', title: a.kind === 'recovery' ? 'Recuperación activa' : `${a.sport}${a.disciplines?.length ? ` · ${a.disciplines.slice(0, 2).join(', ')}` : ''}`, sub: `${a.minutes} min · RPE ${a.rpe}${a.sparring ? ' · sparring' : ''}`, go: undefined as undefined | (() => void) })),
  ].sort((a, b) => b.ts - a.ts), [sessions, activities, settings.unit, push])
  const shown = items.filter((i) => f === 'all' || i.area === f).slice(0, 40)
  const AREA = { gym: 'GYM', combat: 'CMB', recovery: 'REC' }
  const hasLoad = loads.some((w) => w.total > 0)
  if (!items.length) return <div className="scroll h-full"><Empty icon="chart" title="Aún no hay datos" text="Cuando registres entrenamientos de gimnasio, combate o recuperación aparecerán aquí." /></div>
  return (
    <div className="scroll h-full pb-10"><div className="px-6 pt-5">
      {hasLoad && (
        <>
          <Label>Carga semanal total</Label>
          <div className="mt-3"><StackedBars data={loads.map((w, i) => ({ label: i === loads.length - 1 ? 'Ahora' : `${new Date(w.start).getDate()}/${new Date(w.start).getMonth() + 1}`, a: w.gym, b: w.combat + w.other, highlight: i === loads.length - 1 }))} /></div>
          <div className="flex gap-4 text-[12px] text-mute mt-1"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-white/40 inline-block" />Gimnasio</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-glow inline-block" />Combate y otras</span></div>
          <p className="text-[12px] text-dim mt-1.5 leading-snug">Carga interna = minutos × RPE de todas tus disciplinas. Sin RPE en gimnasio se asume 6.</p>
        </>
      )}
      <Label className="mt-10">Historial general</Label>
      <div className="flex gap-2 overflow-x-auto scroll mt-3 -mx-6 px-6 pb-1">
        {([['all', 'Todo'], ['gym', 'Gym'], ['combat', 'Combat'], ['recovery', 'Recuperación']] as const).map(([k, l]) => <Chip key={k} active={f === k} onClick={() => setF(k)}>{l}</Chip>)}
      </div>
      <div className="mt-2">
        {shown.map((i) => (
          <Row key={i.key} onClick={i.go}>
            <span className="num text-[10.5px] font-bold text-dim w-9">{AREA[i.area]}</span>
            <div className="flex-1 min-w-0"><div className="font-semibold truncate">{i.title}</div><div className="text-[12.5px] text-mute mt-0.5">{formatDateShort(i.ts)} · {i.sub}</div></div>
            {i.go && <Icon name="chev" size={16} className="text-dim" />}
          </Row>
        ))}
        {!shown.length && <p className="text-mute text-center py-10">Nada en esta categoría.</p>}
      </div>
      <p className="text-[12px] text-dim mt-4">{formatNumber(items.length, 0)} registros en total.</p>
    </div></div>
  )
}
