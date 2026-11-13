import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { NumInput, SubLabel, TextInput } from '../../components/fields'
import { Button, Label, Sheet } from '../../components/ui'
import { EXERCISES, exerciseById } from '../../data/exercises'
import { GOAL_KIND_LABEL, METRICS, METRIC_LABEL, METRIC_UNIT, bodySeries, currentWeight, goalProgress, latestMetric } from '../../lib/profile'
import { exerciseSeries } from '../../lib/stats'
import { formatNumber, uid } from '../../lib/utils'
import { useStore } from '../../store'
import type { BodyMetric, Goal, GoalKind } from '../../types'

const KINDS = Object.keys(GOAL_KIND_LABEL) as GoalKind[]
const STRENGTH_EX = EXERCISES.filter((e) => ['press-banca', 'sentadilla', 'peso-muerto', 'press-militar', 'dominadas', 'remo-barra', 'hip-thrust', 'prensa', 'jalon-pecho', 'curl-barra'].includes(e.id))

function Bar({ pct, done }: { pct: number; done?: boolean }) {
  return <div className="h-1.5 bg-s3 rounded-full overflow-hidden mt-2.5"><div className={`h-full rounded-full transition-all duration-700 ${done ? 'bg-accent' : 'bg-white'}`} style={{ width: `${Math.max(2, pct * 100)}%` }} /></div>
}

export function GoalsSection() {
  const { profile, body, sessions, updateProfile, showToast } = useStore()
  const [edit, setEdit] = useState<Goal | null>(null)
  const [adding, setAdding] = useState(false)
  const ctx = { profile, body, sessions }
  const wSeries = bodySeries(body, 'weight')
  const cw = currentWeight(profile, body)
  const target = profile.targetWeightKg
  // El peso objetivo del perfil se muestra como objetivo; su punto de partida es la primera medición registrada
  const autoStart = wSeries[0]?.v
  const hasWeightGoal = profile.goals.some((g) => g.metric === 'weight')

  const rows = profile.goals.map((g) => ({ g, p: goalProgress(g, ctx) }))
  return (
    <>
      {target !== undefined && !hasWeightGoal && (
        <div className="bg-s1 rounded-2xl p-4">
          <div className="flex justify-between items-baseline"><div className="font-bold">Peso objetivo</div><div className="num font-bold">{cw !== undefined ? formatNumber(cw) : '—'} <span className="text-mute font-semibold">→ {formatNumber(target)} kg</span></div></div>
          {autoStart !== undefined && cw !== undefined && autoStart !== target
            ? <Bar pct={Math.min(1, Math.max(0, (cw - autoStart) / (target - autoStart)))} done={Math.abs(cw - target) < 0.05} />
            : <p className="text-[12.5px] text-dim mt-2">Registra tu peso en el historial corporal para ver el progreso.</p>}
        </div>
      )}
      {rows.map(({ g, p }) => (
        <button key={g.id} onClick={() => setEdit(g)} className="w-full text-left bg-s1 rounded-2xl p-4 active:bg-s2">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0"><Label>{GOAL_KIND_LABEL[g.kind]}</Label><div className="font-bold text-[17px] leading-snug mt-0.5">{g.title}</div></div>
            <div className="text-right shrink-0"><div className="num text-[22px] font-bold leading-none">{Math.round(p.pct * 100)}<span className="text-mute text-sm">%</span></div></div>
          </div>
          <Bar pct={p.pct} done={p.done} />
          <div className="flex justify-between text-[12px] text-mute mt-2 num tracking-normal">
            <span>{formatNumber(g.start)} {g.unit}</span>
            <span className="text-white font-semibold">{p.current !== undefined ? `${formatNumber(p.current)} ${g.unit}` : 'Sin datos aún'}</span>
            <span>{formatNumber(g.target)} {g.unit}</span>
          </div>
        </button>
      ))}
      {!rows.length && target === undefined && <p className="text-[14px] text-mute leading-relaxed">Define objetivos medibles y verás aquí tu progreso real, calculado con tu historial corporal y tus entrenamientos.</p>}
      <Button variant="secondary" size="md" className="w-full" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Añadir objetivo</Button>

      <GoalSheet open={adding} onClose={() => setAdding(false)} onSave={(g) => { updateProfile({ goals: [...profile.goals, g] }); setAdding(false); showToast('Objetivo añadido') }} />
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.title}>
        {edit && (
          <div className="space-y-4">
            {edit.metric === 'manual' && <NumInput label="Valor actual" unit={edit.unit} decimal value={edit.current} onChange={(n) => { const g = { ...edit, current: n }; setEdit(g); updateProfile({ goals: profile.goals.map((x) => (x.id === g.id ? g : x)) }) }} hint="Actualízalo cuando midas un avance" />}
            {edit.metric !== 'manual' && <p className="text-[13.5px] text-mute leading-relaxed">El progreso se calcula automáticamente con {edit.metric === 'e1rm' ? 'tu 1RM estimado en tus entrenamientos' : 'tus mediciones del historial corporal'}.</p>}
            <div className="grid grid-cols-2 gap-3">
              <NumInput label="Inicio" unit={edit.unit} decimal value={edit.start} onChange={(n) => { if (n === undefined) return; const g = { ...edit, start: n }; setEdit(g); updateProfile({ goals: profile.goals.map((x) => (x.id === g.id ? g : x)) }) }} />
              <NumInput label="Meta" unit={edit.unit} decimal value={edit.target} onChange={(n) => { if (n === undefined) return; const g = { ...edit, target: n }; setEdit(g); updateProfile({ goals: profile.goals.map((x) => (x.id === g.id ? g : x)) }) }} />
            </div>
            <Button variant="danger" className="w-full" onClick={() => { updateProfile({ goals: profile.goals.filter((x) => x.id !== edit.id) }); setEdit(null) }}><Icon name="trash" size={17} /> Eliminar objetivo</Button>
          </div>
        )}
      </Sheet>
    </>
  )
}

function GoalSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (g: Goal) => void }) {
  const { body, sessions } = useStore()
  const [kind, setKind] = useState<GoalKind>('strength')
  const [title, setTitle] = useState('')
  const [metric, setMetric] = useState<BodyMetric>('arm')
  const [exId, setExId] = useState('press-banca')
  const [unit, setUnit] = useState('')
  const [start, setStart] = useState<number | undefined>()
  const [target, setTarget] = useState<number | undefined>()

  const mode: 'weight' | 'body' | 'e1rm' | 'manual' = kind === 'weight' ? 'weight' : kind === 'strength' ? 'e1rm' : kind === 'muscle' ? 'body' : 'manual'
  const bm: BodyMetric = mode === 'weight' ? 'weight' : metric
  const known = useMemo(() => {
    if (mode === 'weight' || mode === 'body') return latestMetric(body, bm)
    if (mode === 'e1rm') { const e = exerciseById(exId)!; const s = exerciseSeries(sessions, e.name, e.id); return s.length ? Math.round(Math.max(...s.map((p) => p.e1rm)) * 2) / 2 : undefined }
    return undefined
  }, [mode, bm, body, sessions, exId])
  const u = mode === 'e1rm' ? 'kg' : mode === 'manual' ? unit : METRIC_UNIT[bm]
  const s0 = start ?? known
  const defTitle = mode === 'e1rm' ? `${exerciseById(exId)!.name}: 1RM ${target ?? ''} kg` : mode === 'weight' ? `Llegar a ${target ?? ''} kg` : mode === 'body' ? `${METRIC_LABEL[bm]} a ${target ?? ''} ${u}` : GOAL_KIND_LABEL[kind]
  const valid = s0 !== undefined && target !== undefined && s0 !== target && (mode !== 'manual' || !!unit.trim())

  const reset = () => { setStart(undefined); setTarget(undefined); setTitle(''); setUnit('') }
  return (
    <Sheet open={open} onClose={onClose} title="Nuevo objetivo">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => <button key={k} onClick={() => { setKind(k); reset() }} aria-pressed={kind === k} className={`h-9 px-3.5 rounded-full text-[13.5px] font-semibold ${kind === k ? 'bg-white text-black' : 'bg-s2 text-mute'}`}>{GOAL_KIND_LABEL[k]}</button>)}
        </div>
        {mode === 'body' && <div><SubLabel>Medida que seguirá este objetivo</SubLabel><div className="flex flex-wrap gap-2">{METRICS.map((m) => <button key={m} onClick={() => { setMetric(m); setStart(undefined) }} className={`h-9 px-3.5 rounded-full text-[13.5px] font-semibold ${metric === m ? 'bg-white text-black' : 'bg-s2 text-mute'}`}>{METRIC_LABEL[m]}</button>)}</div></div>}
        {mode === 'e1rm' && <div><SubLabel>Ejercicio</SubLabel><div className="flex flex-wrap gap-2">{STRENGTH_EX.map((e) => <button key={e.id} onClick={() => { setExId(e.id); setStart(undefined) }} className={`h-9 px-3.5 rounded-full text-[13.5px] font-semibold ${exId === e.id ? 'bg-white text-black' : 'bg-s2 text-mute'}`}>{e.name}</button>)}</div></div>}
        {mode === 'manual' && <div className="space-y-3"><TextInput label="Qué quieres lograr" value={title} onChange={setTitle} placeholder={kind === 'endurance' ? 'Correr 5 km' : kind === 'mobility' ? 'Tocar el suelo con las manos' : 'Mi meta'} /><TextInput label="Unidad" value={unit} onChange={setUnit} placeholder={kind === 'endurance' ? 'min, km…' : kind === 'mobility' ? 'cm, °…' : 'reps, min…'} /></div>}
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Punto de partida" unit={u} decimal value={s0} onChange={setStart} hint={known !== undefined && start === undefined ? 'Tu último dato' : mode !== 'manual' && known === undefined ? 'Aún no hay datos: introdúcelo tú' : undefined} />
          <NumInput label="Meta" unit={u} decimal value={target} onChange={setTarget} />
        </div>
        {mode !== 'manual' && <TextInput label="Nombre (opcional)" value={title} onChange={setTitle} placeholder={defTitle} />}
        <Button className="w-full" disabled={!valid} onClick={() => {
          onSave({ id: uid(), kind, title: title.trim() || defTitle, metric: mode === 'weight' ? 'weight' : mode === 'body' ? bm : mode === 'e1rm' ? 'e1rm' : 'manual', exerciseId: mode === 'e1rm' ? exId : undefined, unit: u, start: s0!, target: target!, current: mode === 'manual' ? s0 : undefined, createdAt: Date.now() })
          reset()
        }}>AÑADIR OBJETIVO</Button>
      </div>
    </Sheet>
  )
}
