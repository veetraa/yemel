import { useState } from 'react'
import { Icon } from '../../../shared/components/Icon'
import { Button, Label, Sheet } from '../../../shared/components/ui'
import { formatDateShort, formatNumber } from '../../../shared/lib/utils'
import { useStore } from '../../../store'
import type { Activity, CombatSport } from '../../../types'
import { sportActivities, sportSummary } from '../services/combatLibraryService'
import { INTENSITY_LABEL } from '../services/combatService'

/** Historial y resumen de UNA disciplina de combate (o de todas si no se indica). */
export function SportHistory({ sport, limit = 12 }: { sport: CombatSport; limit?: number }) {
  const { activities, deleteActivity, showToast } = useStore()
  const [sel, setSel] = useState<Activity | null>(null)
  const list = sportActivities(activities, sport)
  const cs = sportSummary(activities, sport, 30)
  const max = Math.max(1, ...cs.topTechniques.map((t) => t.count))
  if (!list.length) return (
    <div className="text-center px-6 py-12">
      <div className="mx-auto w-14 h-14 rounded-full bg-s2 grid place-items-center text-mute"><Icon name="glove" size={26} /></div>
      <div className="text-lg font-bold mt-4">Sin sesiones de {sport}</div>
      <p className="text-mute text-[15px] leading-relaxed mt-2">Tu historial aparecerá aquí.</p>
    </div>
  )
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <Mini v={cs.sessions} l="Sesiones 30d" /><Mini v={cs.minutes} l="Minutos" /><Mini v={cs.sparringSessions} l="Sparring" /><Mini v={cs.avgRpe === undefined ? '—' : formatNumber(cs.avgRpe)} l="RPE medio" />
      </div>
      {cs.topTechniques.length > 0 && (
        <div className="mt-6"><Label>Técnicas más trabajadas</Label>
          <div className="mt-3 space-y-2.5">{cs.topTechniques.map((t) => (
            <div key={t.technique} className="flex items-center gap-3"><div className="w-36 text-[13.5px] font-semibold truncate">{t.technique}</div>
              <div className="flex-1 h-2 bg-s2 rounded-full overflow-hidden"><div className="h-full bg-glow/80 rounded-full" style={{ width: `${(t.count / max) * 100}%` }} /></div>
              <div className="num w-6 text-right text-[13.5px] font-bold">{t.count}</div></div>
          ))}</div></div>
      )}
      <Label className="mt-8">Sesiones</Label>
      <div className="mt-1">
        {list.slice(0, limit).map((a) => (
          <button key={a.id} onClick={() => setSel(a)} className="w-full flex items-center gap-3 py-3.5 border-b border-line/70 last:border-0 text-left active:bg-s1">
            <div className="flex-1 min-w-0"><div className="font-semibold truncate">{a.techniques?.length ? a.techniques.slice(0, 2).join(', ') : sport}</div>
              <div className="text-[12.5px] text-mute mt-0.5">{formatDateShort(a.ts)} · {a.minutes} min · RPE {a.rpe}{a.sparring ? ' · sparring' : ''}</div></div>
            <Icon name="chev" size={16} className="text-dim" />
          </button>
        ))}
      </div>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.sport} · ${formatDateShort(sel.ts)}` : undefined}>
        {sel && (
          <div className="space-y-4 text-[14.5px]">
            <div className="grid grid-cols-3 gap-3"><Mini v={sel.minutes} l="Minutos" /><Mini v={sel.rpe} l="RPE" /><Mini v={sel.intensity ? INTENSITY_LABEL[sel.intensity] : '—'} l="Intensidad" /></div>
            <p className="text-mute">{sel.sparring ? `Sparring${sel.sparringRounds ? ` · ${sel.sparringRounds} rondas` : ''}` : 'Sin sparring'}</p>
            {sel.disciplines && <Row t="Áreas" v={sel.disciplines.join(', ')} />}
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
