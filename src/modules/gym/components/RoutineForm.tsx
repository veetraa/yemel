import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { MUSCLES, exerciseById, matchExercise, searchExercises } from '../data/exercises'
import type { Routine, RoutineDay, RoutineExercise } from '../../../types'
import { WEEKDAYS_SHORT, uid } from '../../../shared/lib/utils'
import { ExerciseFigure } from './ExerciseFigure'
import { Icon } from '../../../shared/components/Icon'
import { Button, Label, Sheet } from '../../../shared/components/ui'
import { useStore } from '../../../store'
import { combatDays } from '../../../shared/services/planningService'

function NumField({ value, onChange, step = 1, min = 0, max = 9999, decimal = false, suffix, label }: { value: number | undefined; onChange: (n: number | undefined) => void; step?: number; min?: number; max?: number; decimal?: boolean; suffix?: string; label: string }) {
  const [raw, setRaw] = useState<string | null>(null)
  const shown = raw ?? (value === undefined ? '' : String(value))
  return (
    <label className="block">
      <Label className="mb-1.5">{label}</Label>
      <div className="flex items-center bg-s2 rounded-xl h-11 px-3">
        <input
          inputMode={decimal ? 'decimal' : 'numeric'} value={shown}
          onChange={(e) => {
            const t = e.target.value.replace(',', '.')
            if (!/^\d*\.?\d*$/.test(t)) return
            setRaw(t)
            if (t === '' || t === '.') return onChange(undefined)
            const n = Math.min(max, Math.max(min, parseFloat(t)))
            onChange(n)
          }}
          onBlur={() => setRaw(null)} onFocus={(e) => e.target.select()}
          className="num bg-transparent w-full font-semibold text-[17px]" aria-label={label} data-step={step}
        />
        {suffix && <span className="text-mute text-sm ml-1">{suffix}</span>}
      </div>
    </label>
  )
}

const inputCls = 'w-full bg-s2 rounded-xl h-11 px-3 font-semibold placeholder:text-dim'

function ExerciseEditor({ ex, onChange, onDelete, onMove, first, last }: { ex: RoutineExercise; onChange: (e: RoutineExercise) => void; onDelete: () => void; onMove: (d: -1 | 1) => void; first: boolean; last: boolean }) {
  const [open, setOpen] = useState(false)
  const lib = exerciseById(ex.exerciseId)
  const set = (p: Partial<RoutineExercise>) => onChange({ ...ex, ...p })
  return (
    <div className="border-b border-line/70 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 py-3 text-left">
        <div className="w-11 h-11 rounded-xl bg-s1 grid place-items-center shrink-0 overflow-hidden">
          {lib ? <ExerciseFigure anim={lib.anim} primary={lib.primary} animated={false} className="w-10 h-10" /> : <Icon name="bolt" size={18} className="text-dim" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{ex.name}</div>
          <div className="text-[13px] text-mute num tracking-normal">
            {ex.sets} × {ex.reps} · {ex.rest}s{ex.recommendedWeight ? ` · ${ex.recommendedWeight} kg` : ''} · {ex.muscle}
          </div>
        </div>
        <Icon name={open ? 'up' : 'down'} size={18} className="text-dim" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pb-4 grid grid-cols-2 gap-3">
              <label className="col-span-2 block">
                <Label className="mb-1.5">Ejercicio</Label>
                <input className={inputCls} value={ex.name} onChange={(e) => { const l = matchExercise(e.target.value); set({ name: e.target.value, exerciseId: l?.id }) }} />
              </label>
              <label className="col-span-2 block">
                <Label className="mb-1.5">Músculo</Label>
                <select className={inputCls} value={ex.muscle} onChange={(e) => set({ muscle: e.target.value })}>
                  {[...new Set([ex.muscle, 'General', ...MUSCLES])].map((m) => <option key={m}>{m}</option>)}
                </select>
              </label>
              <NumField label="Series" value={ex.sets} min={1} max={20} onChange={(n) => set({ sets: n ?? 1 })} />
              <label className="block">
                <Label className="mb-1.5">Repeticiones</Label>
                <input className={inputCls} value={ex.reps} onChange={(e) => set({ reps: e.target.value })} placeholder="8-10" />
              </label>
              <NumField label="Descanso" suffix="s" value={ex.rest} max={1200} onChange={(n) => set({ rest: n ?? 0 })} />
              <NumField label="Peso sugerido" suffix="kg" decimal value={ex.recommendedWeight} onChange={(n) => set({ recommendedWeight: n })} />
              <label className="col-span-2 block">
                <Label className="mb-1.5">Notas</Label>
                <input className={inputCls} value={ex.notes ?? ''} onChange={(e) => set({ notes: e.target.value || undefined })} placeholder="Opcional" />
              </label>
              <div className="col-span-2 flex gap-2">
                <Button variant="secondary" size="sm" disabled={first} onClick={() => onMove(-1)}><Icon name="up" size={16} /> Subir</Button>
                <Button variant="secondary" size="sm" disabled={last} onClick={() => onMove(1)}><Icon name="down" size={16} /> Bajar</Button>
                <Button variant="danger" size="sm" className="ml-auto" onClick={onDelete}><Icon name="trash" size={16} /> Quitar</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: RoutineExercise) => void }) {
  const [q, setQ] = useState('')
  const [m, setM] = useState<string | undefined>()
  const list = searchExercises(q, m)
  const add = (name: string, id?: string, muscle = 'General', rest = 90) =>
    onPick({ id: uid(), exerciseId: id, name, muscle, sets: 3, reps: '8-12', rest })
  return (
    <Sheet open={open} onClose={onClose} title="Añadir ejercicio">
      <div className="flex items-center gap-2 bg-s2 rounded-xl h-11 px-3">
        <Icon name="search" size={18} className="text-mute" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar o escribir uno nuevo" className="bg-transparent flex-1" />
      </div>
      <div className="flex gap-2 overflow-x-auto scroll py-3 -mx-5 px-5">
        {MUSCLES.map((x) => (
          <button key={x} onClick={() => setM(m === x ? undefined : x)} className={`h-8 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap ${m === x ? 'bg-white text-black' : 'bg-s2 text-mute'}`}>{x}</button>
        ))}
      </div>
      {q.trim() && !list.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
        <button onClick={() => add(q.trim())} className="w-full text-left py-3 text-accent font-semibold border-b border-line/70">+ Usar «{q.trim()}» como ejercicio propio</button>
      )}
      {list.map((e) => (
        <button key={e.id} onClick={() => add(e.name, e.id, e.primary, e.primary === 'Core' || e.step === 0 ? 60 : 90)} className="w-full flex items-center gap-3 py-2.5 text-left border-b border-line/70 last:border-0 active:bg-s2">
          <div className="w-11 h-11 rounded-xl bg-s2 grid place-items-center"><ExerciseFigure anim={e.anim} primary={e.primary} animated={false} className="w-10 h-10" /></div>
          <div className="flex-1"><div className="font-semibold">{e.name}</div><div className="text-[13px] text-mute">{e.primary} · {e.equipment.join(', ')}</div></div>
          <Icon name="plus" size={18} className="text-mute" />
        </button>
      ))}
    </Sheet>
  )
}

export function RoutineForm({ routine, onChange }: { routine: Routine; onChange: (r: Routine) => void }) {
  const { profile, plan } = useStore()
  const combat = combatDays(plan)
  const [picker, setPicker] = useState<string | null>(null)
  const setDay = (id: string, p: Partial<RoutineDay>) => onChange({ ...routine, days: routine.days.map((d) => (d.id === id ? { ...d, ...p } : d)) })

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <label className="block"><Label className="mb-1.5">Nombre de la rutina</Label>
          <input className={`${inputCls} !h-12 text-lg`} value={routine.name} onChange={(e) => onChange({ ...routine, name: e.target.value })} /></label>
        <label className="block"><Label className="mb-1.5">Objetivo</Label>
          <input className={inputCls} value={routine.goal ?? ''} placeholder="Hipertrofia, fuerza…" onChange={(e) => onChange({ ...routine, goal: e.target.value || undefined })} /></label>
      </div>

      {routine.days.map((d, di) => (
        <section key={d.id}>
          <div className="flex items-center gap-2">
            <input className="flex-1 bg-transparent text-[20px] font-bold tracking-tight min-w-0" value={d.name} onChange={(e) => setDay(d.id, { name: e.target.value })} aria-label="Nombre del día" />
            <button aria-label="Eliminar día" onClick={() => onChange({ ...routine, days: routine.days.filter((x) => x.id !== d.id) })} className="w-9 h-9 grid place-items-center rounded-full text-dim active:bg-s2"><Icon name="trash" size={18} /></button>
          </div>
          <div className="flex gap-1.5 mt-2">
            {WEEKDAYS_SHORT.map((l, i) => {
              const on = d.weekdays.includes(i)
              return (
                <button key={i} onClick={() => setDay(d.id, { weekdays: on ? d.weekdays.filter((x) => x !== i) : [...d.weekdays, i].sort() })}
                  className={`relative w-9 h-9 rounded-full text-[13px] font-bold ${on ? 'bg-accent text-black' : profile.availableDays.length && !profile.availableDays.includes(i) ? 'bg-s1 text-dim' : 'bg-s2 text-mute'}`} aria-label={`Día de la semana ${l}`} aria-pressed={on}>{l}{combat.includes(i) && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-accent bg-bg rounded px-0.5">JJ</span>}</button>
              )
            })}
          </div>
          <div className="mt-3">
            {d.exercises.map((ex, ei) => (
              <ExerciseEditor key={ex.id} ex={ex} first={ei === 0} last={ei === d.exercises.length - 1}
                onChange={(n) => setDay(d.id, { exercises: d.exercises.map((x) => (x.id === ex.id ? n : x)) })}
                onDelete={() => setDay(d.id, { exercises: d.exercises.filter((x) => x.id !== ex.id) })}
                onMove={(dir) => {
                  const arr = [...d.exercises]; const j = ei + dir; if (j < 0 || j >= arr.length) return
                  ;[arr[ei], arr[j]] = [arr[j], arr[ei]]; setDay(d.id, { exercises: arr })
                }} />
            ))}
          </div>
          <Button variant="secondary" size="md" className="w-full mt-3" onClick={() => setPicker(d.id)}><Icon name="plus" size={18} /> Añadir ejercicio</Button>
          {di < routine.days.length - 1 && <div className="h-px bg-line mt-8" />}
        </section>
      ))}

      <Button variant="ghost" size="md" className="w-full border border-dashed border-line" onClick={() => onChange({ ...routine, days: [...routine.days, { id: uid(), name: `Día ${routine.days.length + 1}`, weekdays: [], exercises: [] }] })}>
        <Icon name="plus" size={18} /> Añadir día
      </Button>

      <ExercisePicker open={picker !== null} onClose={() => setPicker(null)} onPick={(e) => {
        const d = routine.days.find((x) => x.id === picker)
        if (d) setDay(d.id, { exercises: [...d.exercises, e] })
        setPicker(null)
      }} />
    </div>
  )
}
