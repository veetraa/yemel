import { useState } from 'react'
import { useStore } from '../store'
import { formatDateShort, formatNumber } from '../lib/utils'
import { INTENSITY_LABEL, combatSummary, isCombat } from '../services/combatService'
import type { Activity } from '../types'
import { Icon } from './Icon'
import { Button, Label, Sheet } from './ui'

/** Resumen de combate (30 días) y diario de sesiones */
export function CombatHistory() {
  const { activities, deleteActivity, showToast } = useStore()
  const [sel, setSel] = useState<Activity | null>(null)
  const cs = combatSummary(activities, 30)
  const list = activities.filter((a) => a.kind !== 'recovery').slice(0, 8)
  const max = Math.max(1, ...cs.byDiscipline.map((d) => d.count))
  return (
    <>
      <Label className="mt-12">Combate · 30 días</Label>
      <div className="grid grid-cols-4 gap-3 mt-3">
        <Mini v={cs.sessions} l="Sesiones" />
        <Mini v={cs.minutes} l="Minutos" />
        <Mini v={cs.sparringSessions} l="Sparring" />
        <Mini v={cs.avgRpe === undefined ? '—' : formatNumber(cs.avgRpe)} l="RPE medio" />
      </div>
      {cs.byDiscipline.length > 0 && (
        <div className="mt-5 space-y-2.5">
          {cs.byDiscipline.slice(0, 6).map((d) => (
            <div key={d.discipline} className="flex items-center gap-3"><div className="w-32 text-[13.5px] font-semibold truncate">{d.discipline}</div>
              <div className="flex-1 h-2 bg-s2 rounded-full overflow-hidden"><div className="h-full bg-accent/80 rounded-full" style={{ width: `${(d.count / max) * 100}%` }} /></div>
              <div className="num w-6 text-right text-[13.5px] font-bold">{d.count}</div></div>
          ))}
        </div>
      )}
      {cs.topTechniques.length > 0 && <p className="text-[13px] text-mute mt-4 leading-relaxed"><span className="text-white font-semibold">Más trabajadas:</span> {cs.topTechniques.map((t) => `${t.technique} (${t.count})`).join(' · ')}</p>}
      <div className="mt-3">
        {list.map((a) => (
          <button key={a.id} onClick={() => setSel(a)} className="w-full flex items-center gap-3 py-3.5 border-b border-line/70 last:border-0 text-left active:bg-s1">
            <div className="flex-1 min-w-0"><div className="font-semibold truncate">{a.disciplines?.length ? a.disciplines.join(', ') : a.sport}</div>
              <div className="text-[12.5px] text-mute mt-0.5">{formatDateShort(a.ts)} · {a.minutes} min · RPE {a.rpe}{a.sparring ? ' · sparring' : ''}</div></div>
            <Icon name="chev" size={16} className="text-dim" />
          </button>
        ))}
      </div>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.sport} · ${formatDateShort(sel.ts)}` : undefined}>
        {sel && (
          <div className="space-y-4 text-[14.5px]">
            <div className="grid grid-cols-3 gap-3"><Mini v={sel.minutes} l="Minutos" /><Mini v={sel.rpe} l="RPE" /><Mini v={sel.intensity ? INTENSITY_LABEL[sel.intensity] : '—'} l="Intensidad" /></div>
            {isCombat(sel) && <p className="text-mute">{sel.sparring ? `Sparring${sel.sparringRounds ? ` · ${sel.sparringRounds} rondas` : ''}` : 'Sin sparring'}</p>}
            {sel.disciplines && <Row t="Disciplinas" v={sel.disciplines.join(', ')} />}
            {sel.techniques && <Row t="Técnicas" v={sel.techniques.join(', ')} />}
            {sel.skills && <Row t="Habilidades" v={sel.skills.join(', ')} />}
            {sel.note && <Row t="Observaciones" v={sel.note} />}
            <Button variant="danger" className="w-full" onClick={() => { deleteActivity(sel.id); setSel(null); showToast('Sesión eliminada') }}><Icon name="trash" size={17} /> Eliminar sesión</Button>
          </div>
        )}
      </Sheet>
    </>
  )
}

const Mini = ({ v, l }: { v: number | string; l: string }) => (
  <div><div className="num text-[22px] font-bold leading-none">{v}</div><Label className="mt-1.5 !text-[10px]">{l}</Label></div>
)
const Row = ({ t, v }: { t: string; v: string }) => (<div><Label>{t}</Label><div className="mt-1 leading-snug">{v}</div></div>)
