import { useMemo, useState } from 'react'
import { BarChart, LineChart, StackedBars } from '../components/Charts'
import { weeklyLoads } from '../lib/coach'
import { Icon } from '../components/Icon'
import { Chip, Empty, Header, Label, Row, Stat } from '../components/ui'
import { exerciseSeries, personalRecords, sessionDuration, sessionVolume, setsByMuscle, weeklySeries } from '../lib/stats'
import { formatDateShort, formatDuration, formatNumber, formatVolume, toDisplay } from '../lib/utils'
import { useNav } from '../nav'
import { useStore } from '../store'

export function ProgressScreen() {
  const { sessions, settings, activities } = useStore()
  const { push, setTab } = useNav()
  const unit = settings.unit
  const weeks = useMemo(() => weeklySeries(sessions, 8), [sessions])
  const loads = useMemo(() => weeklyLoads(sessions, activities, 6), [sessions, activities])
  const prs = useMemo(() => personalRecords(sessions), [sessions])
  const muscles = useMemo(() => setsByMuscle(sessions, 30), [sessions])
  const exercises = useMemo(() => {
    const seen = new Map<string, { key: string; name: string; id?: string }>()
    for (const s of sessions) for (const e of s.exercises) {
      const k = e.exerciseId ?? e.name.toLowerCase()
      if (!seen.has(k) && e.sets.some((x) => x.weight > 0)) seen.set(k, { key: k, name: e.name, id: e.exerciseId })
    }
    return [...seen.values()]
  }, [sessions])
  const [sel, setSel] = useState<string | null>(null)
  const current = exercises.find((e) => e.key === sel) ?? exercises[0]
  const series = useMemo(() => (current ? exerciseSeries(sessions, current.name, current.id) : []), [sessions, current])

  if (!sessions.length) {
    return (
      <div className="scroll h-full"><Header title="Progreso" large />
        <Empty icon="chart" title="Aún no hay datos" text="Completa tu primer entrenamiento y aquí verás tu volumen, récords y progresión por ejercicio.">
          <button onClick={() => setTab('train')} className="h-12 rounded-2xl bg-accent text-black font-bold">Ir a entrenar</button>
        </Empty>
      </div>
    )
  }

  const totalMs = sessions.reduce((a, s) => a + sessionDuration(s), 0)
  const totalVol = sessions.reduce((a, s) => a + sessionVolume(s), 0)
  const delta = series.length > 1 ? series[series.length - 1].e1rm - series[0].e1rm : 0
  const maxSets = Math.max(1, ...muscles.map((m) => m.sets))

  return (
    <div className="scroll h-full pb-10">
      <Header title="Progreso" large />
      <div className="px-6">
        <div className="grid grid-cols-3 gap-4 mt-1">
          <Stat label="Sesiones" value={sessions.length} />
          <Stat label="Tiempo" value={formatDuration(totalMs).replace(' min', '')} unit={totalMs < 3600000 ? 'min' : ''} />
          <Stat label="Volumen" value={formatVolume(totalVol).split(' ')[0]} unit={formatVolume(totalVol).split(' ')[1]} />
        </div>

        <Label className="mt-12">Volumen semanal</Label>
        <div className="mt-3">
          <BarChart unit="kg" data={weeks.map((w, i) => ({ label: i === weeks.length - 1 ? 'Ahora' : `${new Date(w.start).getDate()}/${new Date(w.start).getMonth() + 1}`, value: toDisplay(w.volume, unit), highlight: i === weeks.length - 1 }))} />
        </div>
        <p className="text-[12px] text-dim mt-1">Kilos totales movidos ({unit}) por semana: series completadas × peso × repeticiones.</p>

        {loads.some((w) => w.total > 0) && (
          <>
            <Label className="mt-12">Carga semanal</Label>
            <div className="mt-3"><StackedBars data={loads.map((w, i) => ({ label: i === loads.length - 1 ? 'Ahora' : `${new Date(w.start).getDate()}/${new Date(w.start).getMonth() + 1}`, a: w.gym, b: w.other, highlight: i === loads.length - 1 }))} /></div>
            <div className="flex gap-4 text-[12px] text-mute mt-1"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-[#4b4b53] inline-block" />Gimnasio</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" />Jiu-Jitsu y otras</span></div>
            <p className="text-[12px] text-dim mt-1.5 leading-snug">Minutos × esfuerzo (RPE). Si no indicas el RPE de una sesión de gimnasio se asume 6.</p>
          </>
        )}

        {current && (
          <>
            <Label className="mt-12">Progresión por ejercicio</Label>
            <div className="flex gap-2 overflow-x-auto scroll mt-3 -mx-6 px-6 pb-1">
              {exercises.slice(0, 20).map((e) => <Chip key={e.key} active={e.key === current.key} onClick={() => setSel(e.key)}>{e.name}</Chip>)}
            </div>
            {series.length >= 2 ? (
              <div className="mt-5">
                <div className="flex items-baseline gap-2">
                  <span className="num text-[34px] font-bold leading-none">{formatNumber(toDisplay(series[series.length - 1].e1rm, unit))}</span>
                  <span className="text-mute text-sm font-semibold">{unit} · 1RM estimado</span>
                  <span className={`ml-auto text-sm font-bold ${delta >= 0 ? 'text-accent' : 'text-danger'}`}>{delta >= 0 ? '+' : ''}{formatNumber(toDisplay(delta, unit))} {unit}</span>
                </div>
                <div className="mt-3"><LineChart unit={unit} points={series.map((p) => ({ ts: p.ts, v: toDisplay(p.e1rm, unit) }))} /></div>
              </div>
            ) : (
              <p className="text-mute text-[14.5px] mt-4 leading-relaxed">Necesitas al menos dos sesiones con «{current.name}» para ver la curva. Mejor serie hasta ahora: {formatNumber(toDisplay(series[0]?.topWeight ?? 0, unit))} {unit} × {series[0]?.reps}.</p>
            )}
          </>
        )}

        {muscles.length > 0 && (
          <>
            <Label className="mt-12">Series por músculo · 30 días</Label>
            <div className="mt-4 space-y-3">
              {muscles.slice(0, 8).map((m) => (
                <div key={m.muscle} className="flex items-center gap-3">
                  <div className="w-24 text-[14px] font-semibold truncate">{m.muscle}</div>
                  <div className="flex-1 h-2 bg-s2 rounded-full overflow-hidden"><div className="h-full bg-white/80 rounded-full" style={{ width: `${(m.sets / maxSets) * 100}%` }} /></div>
                  <div className="num w-7 text-right text-[14px] font-bold">{m.sets}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {prs.length > 0 && (
          <>
            <Label className="mt-12 flex items-center gap-1.5"><Icon name="trophy" size={14} /> Récords personales</Label>
            <div className="mt-2">
              {prs.slice(0, 6).map((p) => (
                <Row key={p.key}>
                  <div className="flex-1 min-w-0"><div className="font-semibold truncate">{p.name}</div><div className="text-[12.5px] text-mute">{p.muscle} · {formatDateShort(p.ts)}</div></div>
                  <div className="num font-bold text-right">{formatNumber(toDisplay(p.weight, unit))} <span className="text-mute text-xs">{unit}</span> × {p.reps}</div>
                </Row>
              ))}
            </div>
          </>
        )}

        <Label className="mt-12">Historial</Label>
        <div className="mt-2">
          {sessions.slice(0, 30).map((s) => (
            <Row key={s.id} onClick={() => push({ name: 'session', id: s.id })}>
              <div className="flex-1 min-w-0"><div className="font-semibold truncate">{s.dayName}</div><div className="text-[12.5px] text-mute">{new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(s.endedAt)} · {formatDuration(sessionDuration(s))}</div></div>
              <div className="num font-bold">{formatVolume(toDisplay(sessionVolume(s), unit)).replace(' kg', ` ${unit}`)}</div>
              <Icon name="chev" size={16} className="text-dim" />
            </Row>
          ))}
        </div>
      </div>
    </div>
  )
}
