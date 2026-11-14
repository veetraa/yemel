import { useMemo, useState } from 'react'
import { LineChart } from '../../../shared/components/Charts'
import { Icon } from '../../../shared/components/Icon'
import { Hint } from '../../../shared/components/Hint'
import { Header, Label, Stat } from '../../../shared/components/ui'
import { formatDateShort, formatNumber, normalize, toDisplay } from '../../../shared/lib/utils'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'
import { exerciseHistoryLog, loadSummaries } from '../services/workoutService'

/** Historial de cargas de gimnasio (subsección de GYM): qué has levantado en cada ejercicio. */
export function LoadsPanel() {
  const { sessions, settings } = useStore()
  const { push, go } = useNav()
  const [q, setQ] = useState('')
  const u = settings.unit
  const all = useMemo(() => loadSummaries(sessions), [sessions])
  const list = all.filter((l) => !q.trim() || normalize(`${l.name} ${l.muscle}`).includes(normalize(q)))
  return (
    <div className="scroll h-full pb-8">
      <div className="px-6 pt-4">
        <Hint id="gym-loads" className="mb-3">Los pesos se registran al entrenar. Aquí ves tu historial por ejercicio.</Hint>
        <div className="flex items-center gap-2 bg-s2 rounded-xl h-11 px-3">
          <Icon name="search" size={18} className="text-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" className="bg-transparent flex-1" />
        </div>
        {all.length === 0 ? (
          <div className="text-center px-6 py-14">
            <div className="mx-auto w-14 h-14 rounded-full bg-s2 grid place-items-center text-mute"><Icon name="chart" size={26} /></div>
            <div className="text-lg font-bold mt-4">Aún no hay pesos</div>
            <p className="text-mute text-[15px] leading-relaxed mt-2">Los pesos que registres al entrenar aparecerán aquí.</p>
            <button onClick={() => go('gym', 'today')} className="mt-5 h-12 px-6 rounded-2xl bg-accent text-black font-bold">Comenzar entrenamiento</button>
          </div>
        ) : (
          <>
            <Label className="mt-6 mb-1">{list.length} ejercicios</Label>
            {list.map((l) => (
              <button key={l.key} onClick={() => push({ name: 'gym.loads', key: l.key })} className="w-full flex items-center gap-3 py-3.5 border-b border-line/70 last:border-0 text-left active:bg-s1">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{l.name}</div>
                  <div className="text-[12.5px] text-mute mt-0.5">{l.muscle} · {l.count} sesión{l.count > 1 ? 'es' : ''} · {formatDateShort(l.lastTs)}</div>
                </div>
                <div className="text-right"><div className="num font-bold">{formatNumber(toDisplay(l.last.weight, u))} <span className="text-mute text-xs">{u}</span> × {l.last.reps}</div><div className="text-[11.5px] text-dim num">1RM ≈ {formatNumber(toDisplay(l.best.e1rm, u), 0)}</div></div>
                <Icon name="chev" size={16} className="text-dim" />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export function LoadsDetail({ keyId }: { keyId: string }) {
  const { sessions, settings } = useStore()
  const { pop } = useNav()
  const u = settings.unit
  const log = useMemo(() => exerciseHistoryLog(sessions, keyId), [sessions, keyId])
  const sum = loadSummaries(sessions).find((l) => l.key === keyId)
  if (!sum) return <div className="h-full"><Header onBack={pop} /></div>
  const points = [...log].reverse().map((e) => ({ ts: e.ts, v: toDisplay(e.e1rm, u) }))
  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} />
      <div className="scroll flex-1 px-6 pb-10">
        <Label>{sum.muscle}</Label>
        <h1 className="display text-[44px] mt-1.5">{sum.name}</h1>
        <div className="grid grid-cols-3 gap-4 mt-7">
          <Stat label="Último" value={`${formatNumber(toDisplay(sum.last.weight, u))}×${sum.last.reps}`} />
          <Stat label="Mejor 1RM" value={formatNumber(toDisplay(sum.best.e1rm, u), 0)} unit={u} />
          <Stat label="Sesiones" value={sum.count} />
        </div>
        {points.length >= 2 && <div className="mt-8"><Label>1RM estimado</Label><div className="mt-3"><LineChart unit={u} points={points} /></div></div>}
        <Label className="mt-10">Registro de cargas</Label>
        <div className="mt-1">
          {log.map((e) => (
            <div key={e.sessionId} className="py-3.5 border-b border-line/70 last:border-0">
              <div className="flex justify-between text-[12.5px] text-mute"><span>{formatDateShort(e.ts)} · {e.dayName}</span><span className="num">1RM ≈ {formatNumber(toDisplay(e.e1rm, u), 0)}</span></div>
              <div className="flex flex-wrap gap-2 mt-2">{e.sets.map((s, i) => <span key={i} className="num text-[14px] font-bold bg-s2 rounded-lg px-2.5 py-1">{formatNumber(toDisplay(s.weight, u))}<span className="text-mute font-semibold"> × {s.reps}</span></span>)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
