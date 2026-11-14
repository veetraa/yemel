import { useMemo, useState } from 'react'
import { ExerciseFigure } from '../components/ExerciseFigure'
import { Exercise3D } from '../components/Exercise3D'
import { HowToSheet } from '../components/HowToSheet'
import { Icon } from '../../../shared/components/Icon'
import { Hint } from '../../../shared/components/Hint'
import { Button, Chip, Header, Label } from '../../../shared/components/ui'
import { MUSCLES, exerciseById, searchExercises } from '../data/exercises'
import { exerciseSeries } from '../services/workoutService'
import { formatDateShort, formatNumber, toDisplay } from '../../../shared/lib/utils'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'

/** Biblioteca de ejercicios de fuerza (subsección de GYM). */
export function LibraryPanel() {
  const { push } = useNav()
  const [q, setQ] = useState('')
  const [m, setM] = useState<string | undefined>()
  const list = useMemo(() => searchExercises(q, m), [q, m])
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-3">
        <Hint id="gym-library" className="mb-3">Toca un ejercicio para ver su modelo 3D y cómo se hace.</Hint>
        <div className="flex items-center gap-2 bg-s2 rounded-xl h-11 px-3">
          <Icon name="search" size={18} className="text-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio, músculo o equipo" className="bg-transparent flex-1" />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto scroll py-3 px-6">
        {MUSCLES.map((x) => <Chip key={x} active={m === x} onClick={() => setM(m === x ? undefined : x)}>{x}</Chip>)}
      </div>
      <div className="scroll flex-1 px-6 pb-8">
        <Label className="mb-1">{list.length} ejercicios</Label>
        {list.map((e) => (
          <button key={e.id} onClick={() => push({ name: 'gym.exercise', id: e.id })} className="w-full flex items-center gap-4 py-3 border-b border-line/70 last:border-0 text-left active:bg-s1">
            <div className="w-16 h-16 rounded-2xl bg-s1 grid place-items-center shrink-0"><ExerciseFigure anim={e.anim} primary={e.primary} animated={false} className="w-14 h-14" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-snug">{e.name}</div>
              <div className="text-[13px] text-mute mt-0.5">{e.primary}</div>
              <div className="text-[12px] text-dim mt-0.5 truncate">{e.equipment.join(' · ')}</div>
            </div>
            <Icon name="chev" size={16} className="text-dim" />
          </button>
        ))}
        {!list.length && <p className="text-mute text-center py-12">Sin resultados.</p>}
      </div>
    </div>
  )
}

export function ExerciseDetail({ id }: { id: string }) {
  const { pop } = useNav()
  const { sessions, settings } = useStore()
  const e = exerciseById(id)
  const series = useMemo(() => (e ? exerciseSeries(sessions, e.name, e.id) : []), [sessions, e])
  const [howTo, setHowTo] = useState(false)
  if (!e) return null
  const best = series.length ? series.reduce((a, b) => (b.e1rm > a.e1rm ? b : a)) : null
  const last = series[series.length - 1]
  const u = settings.unit
  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} />
      <div className="scroll flex-1 pb-10">
        <Exercise3D key={e.id} anim={e.anim} primary={e.primary} secondary={e.secondary} />
        <div className="px-6 mt-6">
          <h1 className="display text-[44px]">{e.name}</h1>
          <Button variant="secondary" size="md" className="w-full mt-4 tracking-[0.06em]" onClick={() => setHowTo(true)}><Icon name="play" size={16} /> CÓMO SE HACE</Button>

          <div className="mt-6 grid grid-cols-1 gap-5">
            <div>
              <Label>Músculo principal</Label>
              <div className="mt-2"><Chip active className="!bg-accent !text-black">{e.primary}</Chip></div>
            </div>
            {e.secondary.length > 0 && (
              <div>
                <Label>Músculos secundarios</Label>
                <div className="mt-2 flex flex-wrap gap-2">{e.secondary.map((s) => <Chip key={s}>{s}</Chip>)}</div>
              </div>
            )}
            <div>
              <Label>Equipamiento</Label>
              <div className="mt-2 flex flex-wrap gap-2">{e.equipment.map((s) => <Chip key={s}>{s}</Chip>)}</div>
            </div>
          </div>

          {best && last && (
            <div className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <div className="num text-[28px] font-bold leading-none">{formatNumber(toDisplay(last.topWeight, u))}<span className="text-sm text-mute ml-1">{u}</span></div>
                <Label className="mt-1.5">Último · {formatDateShort(last.ts)}</Label>
              </div>
              <div>
                <div className="num text-[28px] font-bold leading-none">{formatNumber(toDisplay(best.e1rm, u))}<span className="text-sm text-mute ml-1">{u}</span></div>
                <Label className="mt-1.5">1RM estimado</Label>
              </div>
            </div>
          )}

          <Label className="mt-10">Cómo hacerlo</Label>
          <ol className="mt-3 space-y-4">
            {e.steps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="num w-6 shrink-0 text-glow font-bold text-lg leading-snug">{i + 1}</span>
                <span className="text-[15.5px] leading-relaxed text-[#d8d8dc]">{s}</span>
              </li>
            ))}
          </ol>

          <Label className="mt-10">Consejos</Label>
          <ul className="mt-3 space-y-2.5">
            {e.tips.map((t, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-mute"><Icon name="info" size={18} className="shrink-0 mt-0.5 text-dim" />{t}</li>
            ))}
          </ul>
        </div>
      </div>
      <HowToSheet id={e.id} open={howTo} onClose={() => setHowTo(false)} />
    </div>
  )
}
