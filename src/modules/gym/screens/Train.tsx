import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ExerciseFigure } from '../components/ExerciseFigure'
import { Icon } from '../../../shared/components/Icon'
import { Hint } from '../../../shared/components/Hint'
import { ExercisePicker } from '../components/RoutineForm'
import { Button, Header, Label, Sheet, Toggle } from '../../../shared/components/ui'
import { exerciseById, matchExercise } from '../data/exercises'
import { beep, unlockAudio } from '../../../shared/lib/audio'
import { readiness } from '../../../shared/services/recoveryService'
import { estimateMinutes } from '../services/workoutService'
import { todayPlan } from '../../../shared/services/planningService'
import { history, recommendWeight } from '../services/progressionService'
import { isPR } from '../services/workoutService'
import { clamp, formatClock, formatNumber, fromDisplay, haptic, toDisplay, uid } from '../../../shared/lib/utils'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'
import type { ExerciseLog, SetLog, Unit } from '../../../types'

function useNow(enabled: boolean, ms = 250) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), ms)
    const vis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [enabled, ms])
  return now
}


// ───────────────────────── Selector ─────────────────────────
export function Picker() {
  const { settings, profile, adjustment, startWorkout, planRoutine, ctx } = useStore()
  const [adapt, setAdapt] = useState(settings.adaptToRecovery)
  const { go } = useNav()
  const routine = planRoutine
  const plan = todayPlan(ctx)

  return (
    <div className="scroll h-full pb-8">
      <div className="px-6 pt-3">
        <Hint id="gym-today" className="mb-3">Elige un día y pulsa ▶ para empezar. Sin rutina, usa «Entrenamiento libre».</Hint>
        {routine ? (
          <>
            <Label className="mt-2">{routine.name}</Label>
            {adjustment.active && (
              <div className="mt-4 bg-s1 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1"><Label>Ajuste del entrenador</Label></div>
                  <Toggle on={adapt} onChange={setAdapt} />
                </div>
                <ul className="mt-2 space-y-1.5">{adjustment.notes.map((n, i) => <li key={i} className="text-[13.5px] leading-snug text-mute">{n}</li>)}</ul>
              </div>
            )}
            <div className="mt-2">
              {routine.days.map((d) => {
                const rec = plan.routineDay?.id === d.id
                const est = estimateMinutes(d)
                const limit = profile.sessionMinutes
                const long = !!limit && est > limit
                return (
                  <div key={d.id} className="border-b border-line/70">
                    <button onClick={() => startWorkout(routine, d, { adapt })} disabled={!d.exercises.length}
                      className="w-full text-left py-4 flex items-center gap-4 active:bg-s1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[18px] font-bold tracking-tight truncate">{d.name}</span>
                          {rec && <span className="text-[10.5px] font-bold bg-accent text-black rounded-full px-2 py-0.5">{plan.done ? 'HECHO HOY' : 'HOY'}</span>}
                        </div>
                        <div className="text-[13px] text-mute mt-1">{d.exercises.length} ejercicios · ~{est} min{long ? ` · tu límite: ${limit} min` : ''}</div>
                      </div>
                      <div className="w-11 h-11 rounded-full bg-accent text-black grid place-items-center"><Icon name="play" size={18} /></div>
                    </button>
                    {long && <button onClick={() => startWorkout(routine, d, { adapt, fitMinutes: limit })} className="mb-3 -mt-1 text-[13px] font-semibold text-glow">Empezar acortado a {limit} min →</button>}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p className="text-mute text-[15px] leading-relaxed mt-2">Aún no tienes rutinas. Añade una o entrena libre.</p>
        )}
        <div className="mt-8 space-y-2">
          <Button variant="secondary" className="w-full" onClick={() => startWorkout(undefined, undefined)}><Icon name="plus" size={18} /> Entrenamiento libre</Button>
          {!routine && <Button className="w-full" onClick={() => go('gym', 'routines')}><Icon name="plus" size={18} /> Añadir rutina</Button>}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── Entrenamiento ─────────────────────────
export function Workout() {
  const { active, updateActive, finishWorkout, cancelWorkout, sessions, settings, profile, weight, wellness, adjustment, showToast } = useStore()
  const [notesOpen, setNotesOpen] = useState(false)
  const { go, push } = useNav()
  const [info, setInfo] = useState(false)
  const [finish, setFinish] = useState(false)
  const [adding, setAdding] = useState(false)
  const [, force] = useState(0)
  const firedRef = useRef<number | null>(null)
  const hasRest = !!active?.restEnd
  const now = useNow(true, hasRest ? 200 : 1000)

  // Pantalla encendida durante el entrenamiento
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const req = async () => { try { lock = (await navigator.wakeLock?.request('screen')) ?? null } catch { /* no soportado */ } }
    void req()
    const vis = () => { if (document.visibilityState === 'visible') void req() }
    document.addEventListener('visibilitychange', vis)
    return () => { document.removeEventListener('visibilitychange', vis); void lock?.release() }
  }, [])

  // Fin del descanso
  const remaining = active?.restEnd ? Math.ceil((active.restEnd - now) / 1000) : 0
  useEffect(() => {
    if (!active?.restEnd || remaining > 0 || firedRef.current === active.restEnd) return
    firedRef.current = active.restEnd
    if (settings.sound) beep(3)
    if (settings.vibrate) haptic(200)
    updateActive((a) => ({ ...a, restEnd: undefined, restTotal: undefined }))
    showToast('Descanso terminado')
  }, [active?.restEnd, remaining, settings, updateActive, showToast])

  const ex = active?.exercises[active.index]
  const lib = ex ? exerciseById(ex.exerciseId) ?? matchExercise(ex.name) : undefined
  const prev = useMemo(() => (ex ? history(sessions, { exerciseId: ex.exerciseId, name: ex.name, targetReps: ex.targetReps })[0]?.log : undefined), [sessions, ex?.name, ex?.exerciseId]) // eslint-disable-line react-hooks/exhaustive-deps
  const rec = useMemo(() => (ex ? recommendWeight({ exerciseId: ex.exerciseId, name: ex.name, targetReps: ex.targetReps, recommendedWeight: ex.plannedWeight }, sessions, { bodyWeight: weight, experience: profile.experience, holdProgress: readiness(wellness).level === 'low' || adjustment.setDelta < 0 }) : null), [sessions, weight, profile.experience, wellness, adjustment.setDelta, ex?.name, ex?.exerciseId, ex?.targetReps, ex?.plannedWeight]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null
  const total = active.exercises.reduce((a, e) => a + e.sets.length, 0)
  const doneCount = active.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0)
  const elapsed = Math.floor((now - active.startedAt) / 1000)
  const unit = settings.unit

  const patchEx = (i: number, fn: (e: ExerciseLog) => ExerciseLog) =>
    updateActive((a) => ({ ...a, exercises: a.exercises.map((e, j) => (j === i ? fn(e) : e)) }))

  const setSet = (si: number, p: Partial<SetLog>, propagateWeight = false) =>
    patchEx(active.index, (e) => ({
      ...e,
      sets: e.sets.map((s, k) => {
        if (k === si) return { ...s, ...p }
        if (propagateWeight && p.weight !== undefined && k > si && !s.done && s.weight === e.sets[si].weight) return { ...s, weight: p.weight }
        return s
      }),
    }))

  const toggleDone = (si: number) => {
    if (!ex) return
    unlockAudio()
    const s = ex.sets[si]
    if (s.done) {
      setSet(si, { done: false })
      return
    }
    haptic(15)
    const pr = isPR(sessions, { id: ex.exerciseId, name: ex.name }, s.weight, s.reps)
    const isLastOfAll = active.index === active.exercises.length - 1 && ex.sets.every((x, k) => k === si || x.done)
    updateActive((a) => ({
      ...a,
      exercises: a.exercises.map((e, j) => j !== a.index ? e : { ...e, sets: e.sets.map((x, k) => (k === si ? { ...x, done: true } : x)) }),
      restEnd: isLastOfAll || ex.rest <= 0 ? undefined : Date.now() + ex.rest * 1000,
      restTotal: isLastOfAll || ex.rest <= 0 ? undefined : ex.rest,
    }))
    if (pr) { showToast('🏆 ¡Nuevo récord personal!'); haptic(60) }
  }

  const exDone = ex ? ex.sets.every((s) => s.done) : false
  const next = active.exercises[active.index + 1]
  const goto = (i: number) => updateActive((a) => ({ ...a, index: clamp(i, 0, a.exercises.length - 1) }))

  const doFinish = () => {
    const s = finishWorkout()
    setFinish(false)
    go('gym', 'today')
    if (s) push({ name: 'gym.summary', id: s.id })
    else showToast('Entrenamiento descartado (sin series completadas)')
  }

  if (!ex) {
    return (
      <div className="h-full flex flex-col">
        <Header title={active.dayName} right={<Button size="sm" variant="danger" onClick={() => cancelWorkout()}>Cancelar</Button>} />
        <div className="px-6 pt-4"><p className="text-mute">Añade un ejercicio.</p>
          <Button className="w-full mt-5" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Añadir ejercicio</Button></div>
        <ExercisePicker open={adding} onClose={() => setAdding(false)} onPick={(e) => { setAdding(false); updateActive((a) => ({ ...a, exercises: [...a.exercises, { id: uid(), exerciseId: e.exerciseId, name: e.name, muscle: e.muscle, targetReps: e.reps, rest: e.rest, sets: Array.from({ length: e.sets }, () => ({ weight: 0, reps: 10, done: false })) }] })) }} />
      </div>
    )
  }

  const restPct = active.restEnd && active.restTotal ? clamp(1 - (active.restEnd - now) / (active.restTotal * 1000), 0, 1) : 0

  return (
    <div className="h-full flex flex-col relative">
      {/* Cabecera */}
      <div className="pt-safe px-6 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="num text-[26px] font-bold leading-none">{formatClock(elapsed)}</div>
            <div className="text-[12px] text-mute mt-1 truncate">{active.dayName} · {doneCount}/{total} series</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setFinish(true)}>Terminar</Button>
        </div>
        <div className="flex gap-1 mt-4">
          {active.exercises.map((e, i) => {
            const d = e.sets.every((s) => s.done)
            const part = e.sets.some((s) => s.done)
            return <button key={e.id} aria-label={`Ejercicio ${i + 1}`} onClick={() => goto(i)} className="flex-1 py-2 -my-2"><div className={`h-1 rounded-full ${d ? 'bg-glow' : part ? 'bg-glow/45' : i === active.index ? 'bg-white' : 'bg-s3'}`} /></button>
          })}
        </div>
      </div>

      {active.adjustNotes && (
        <button onClick={() => setNotesOpen(!notesOpen)} className="mx-6 mb-2 text-left bg-s1 rounded-xl px-3.5 py-2.5 text-[12.5px] text-mute leading-snug">
          <span className="text-glow font-semibold">Ajustado por tu entrenador</span>{notesOpen ? '' : ' · toca para ver'}
          {notesOpen && <ul className="mt-1.5 space-y-1">{active.adjustNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        </button>
      )}
      <div className="scroll flex-1 px-6" style={{ paddingBottom: hasRest ? 190 : 24 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={ex.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
            <div className="flex items-start gap-4 mt-2">
              <div className="flex-1 min-w-0">
                <Label>Ejercicio {active.index + 1} de {active.exercises.length}</Label>
                <h2 className="text-[27px] leading-[1.1] font-bold tracking-tight mt-1.5">{ex.name}</h2>
                <div className="text-mute text-[14px] mt-1.5">{ex.muscle} · {ex.sets.filter((s) => s.done).length}/{ex.sets.length} series · {ex.targetReps} reps · {ex.rest}s descanso</div>
              </div>
              {lib && (
                <button onClick={() => setInfo(true)} className="w-[92px] h-[92px] rounded-3xl bg-s1 grid place-items-center shrink-0 relative overflow-hidden active:bg-s2" aria-label="Ver técnica">
                  <ExerciseFigure anim={lib.anim} primary={lib.primary} className="w-[84px] h-[84px]" />
                  <span className="absolute bottom-1.5 inset-x-0 text-center text-[10px] font-semibold uppercase tracking-wider text-dim">Técnica</span>
                </button>
              )}
            </div>

            <Hint id="workout" className="mt-4">Ajusta peso y reps con − / +. Marca ✓ al terminar cada serie: el descanso empieza solo. «Siguiente» cambia de ejercicio y «Terminar» guarda el entrenamiento.</Hint>

            {rec && (rec.kind !== 'none' || rec.weight === null) ? (
              <div className="mt-4 flex gap-3 items-start text-[13.5px] leading-snug">
                <div className="mt-0.5 w-6 h-6 rounded-full bg-glow/15 text-glow grid place-items-center shrink-0"><Icon name="star" size={13} stroke={2.4} /></div>
                <div className="text-mute"><span className="text-white font-semibold">{rec!.weight !== null && rec!.weight > 0 ? `Usa ${formatNumber(toDisplay(rec!.weight, unit))} ${unit}` : 'Sin referencia'}{rec!.reps ? ` × ${rec!.reps}` : ''}.</span> {rec!.reason}</div>
              </div>
            ) : null}
            {ex.notes && <div className="mt-3 text-[13.5px] text-dim italic leading-snug">“{ex.notes}”</div>}

            {/* Series */}
            <div className="mt-6">
              <div className="grid grid-cols-[28px_1fr_1fr_52px] gap-2 px-0.5 mb-2">
                <Label className="text-center">Nº</Label><Label className="text-center">Peso ({unit})</Label><Label className="text-center">Reps</Label><Label className="text-center">Hecha</Label>
              </div>
              <div className="space-y-2">
                {ex.sets.map((s, i) => (
                  <SetRow key={i} index={i} set={s} unit={unit} step={lib?.step || 2.5} prev={prev?.sets[i]} onChange={(p, prop) => setSet(i, p, prop)} onToggle={() => toggleDone(i)} />
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="ghost" size="sm" onClick={() => patchEx(active.index, (e) => ({ ...e, sets: [...e.sets, { ...e.sets[e.sets.length - 1], done: false }] }))}><Icon name="plus" size={16} /> Serie</Button>
                {ex.sets.length > 1 && <Button variant="ghost" size="sm" onClick={() => patchEx(active.index, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}><Icon name="minus" size={16} /> Serie</Button>}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setAdding(true)}>Añadir ejercicio</Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3 mt-8">
          <Button variant="secondary" className="flex-1" disabled={active.index === 0} onClick={() => goto(active.index - 1)}><Icon name="back" size={18} /> Anterior</Button>
          {next ? (
            <Button variant={exDone ? 'primary' : 'secondary'} className="flex-1" onClick={() => goto(active.index + 1)}>Siguiente <Icon name="chev" size={18} /></Button>
          ) : (
            <Button className="flex-1" onClick={() => setFinish(true)}>Terminar <Icon name="check" size={18} stroke={2.6} /></Button>
          )}
        </div>
        {exDone && next && <p className="text-center text-[13px] text-mute mt-3">Siguiente: <span className="text-white font-semibold">{next.name}</span></p>}
      </div>

      {/* Descanso */}
      <AnimatePresence>
        {hasRest && (
          <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="absolute inset-x-0 bottom-0 z-20 bg-s1 border-t border-line rounded-t-3xl px-6 pt-5 pb-5 shadow-[0_-20px_40px_rgba(0,0,0,.6)]">
            <div className="flex items-end justify-between">
              <div>
                <Label>Descanso</Label>
                <div className="num text-[56px] leading-none font-bold mt-1">{formatClock(Math.max(0, remaining))}</div>
              </div>
              <div className="text-right text-[13px] text-mute pb-1.5 max-w-[150px] leading-snug">
                {exDone && next ? <>Luego:<br /><span className="text-white font-semibold">{next.name}</span></> : <>Serie {Math.min(ex.sets.length, ex.sets.filter((s) => s.done).length + 1)} de {ex.sets.length}</>}
              </div>
            </div>
            <div className="h-1 bg-s3 rounded-full mt-4 overflow-hidden"><div className="h-full bg-glow rounded-full transition-[width] duration-200" style={{ width: `${restPct * 100}%` }} /></div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Button variant="secondary" size="md" onClick={() => updateActive((a) => ({ ...a, restEnd: (a.restEnd ?? Date.now()) - 15000 }))}>−15s</Button>
              <Button variant="secondary" size="md" onClick={() => updateActive((a) => ({ ...a, restEnd: (a.restEnd ?? Date.now()) + 15000, restTotal: (a.restTotal ?? 0) + 15 }))}>+15s</Button>
              <Button size="md" onClick={() => { updateActive((a) => ({ ...a, restEnd: undefined, restTotal: undefined })); if (exDone && next) goto(active.index + 1) }}>{exDone && next ? 'Siguiente' : 'Saltar'}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={info} onClose={() => setInfo(false)}>
        {lib && (
          <>
            <div className="rounded-3xl bg-bg aspect-[4/3] grid place-items-center"><ExerciseFigure anim={lib.anim} primary={lib.primary} className="w-[88%] h-[92%]" /></div>
            <h3 className="text-xl font-bold mt-4">{lib.name}</h3>
            <div className="text-mute text-sm mt-1">{lib.primary}{lib.secondary.length ? ` · ${lib.secondary.join(', ')}` : ''} · {lib.equipment.join(', ')}</div>
            <ol className="mt-4 space-y-3">{lib.steps.map((s, i) => <li key={i} className="flex gap-3 text-[15px] leading-relaxed"><span className="text-glow font-bold num">{i + 1}</span><span className="text-[#d8d8dc]">{s}</span></li>)}</ol>
            <p className="text-mute text-[14px] mt-4 leading-relaxed">{lib.tips[0]}</p>
          </>
        )}
      </Sheet>

      <Sheet open={finish} onClose={() => setFinish(false)} title="¿Terminar entrenamiento?">
        <p className="text-mute leading-relaxed">{doneCount === 0 ? 'Sin series completadas: no se guardará nada.' : `${doneCount} de ${total} series · ${formatClock(elapsed)}. Las series sin marcar no se guardan.`}</p>
        <div className="mt-5 space-y-2">
          <Button className="w-full" onClick={doFinish}>{doneCount ? 'Terminar y guardar' : 'Salir'}</Button>
          <Button variant="secondary" className="w-full" onClick={() => setFinish(false)}>Seguir entrenando</Button>
          {doneCount > 0 && <Button variant="danger" className="w-full" onClick={() => { cancelWorkout(); setFinish(false) }}>Descartar entrenamiento</Button>}
        </div>
      </Sheet>

      <ExercisePicker open={adding} onClose={() => setAdding(false)} onPick={(e) => {
        setAdding(false)
        const n: ExerciseLog = { id: uid(), exerciseId: e.exerciseId, name: e.name, muscle: e.muscle, targetReps: e.reps, rest: e.rest, sets: Array.from({ length: e.sets }, () => ({ weight: 0, reps: 10, done: false })) }
        updateActive((a) => ({ ...a, exercises: [...a.exercises, n], index: a.exercises.length }))
        force((x) => x + 1)
      }} />
    </div>
  )
}

function Stepper({ value, onChange, step, decimal, label }: { value: number; onChange: (n: number) => void; step: number; decimal?: boolean; label: string }) {
  const [raw, setRaw] = useState<string | null>(null)
  const shown = raw ?? (Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100))
  const set = (n: number) => onChange(Math.max(0, Math.round(n * 100) / 100))
  return (
    <div className="flex items-center bg-s2 rounded-2xl h-14 overflow-hidden">
      <button aria-label={`Menos ${label}`} onClick={() => { haptic(5); set(value - step) }} className="w-9 h-full grid place-items-center text-mute active:bg-s3 shrink-0"><Icon name="minus" size={16} stroke={2.4} /></button>
      <input
        inputMode={decimal ? 'decimal' : 'numeric'} aria-label={label} value={shown}
        onFocus={(e) => e.target.select()} onBlur={() => setRaw(null)}
        onChange={(e) => {
          const t = e.target.value.replace(',', '.')
          if (!/^\d*\.?\d*$/.test(t)) return
          setRaw(t)
          const n = parseFloat(t)
          if (!Number.isNaN(n)) onChange(n)
        }}
        className="num bg-transparent flex-1 min-w-0 w-full text-center text-[24px] font-bold"
      />
      <button aria-label={`Más ${label}`} onClick={() => { haptic(5); set(value + step) }} className="w-9 h-full grid place-items-center text-mute active:bg-s3 shrink-0"><Icon name="plus" size={16} stroke={2.4} /></button>
    </div>
  )
}

function SetRow({ index, set, unit, step, prev, onChange, onToggle }: { index: number; set: SetLog; unit: Unit; step: number; prev?: SetLog; onChange: (p: Partial<SetLog>, propagate?: boolean) => void; onToggle: () => void }) {
  const lbStep = step >= 2.5 ? 5 : 2.5
  return (
    <div>
      <div className={`grid grid-cols-[28px_1fr_1fr_52px] gap-2 items-center transition-opacity ${set.done ? 'opacity-60' : ''}`}>
        <span className="num text-center font-bold text-mute text-lg">{index + 1}</span>
        <Stepper label="peso" decimal value={toDisplay(set.weight, unit)} step={unit === 'kg' ? step : lbStep} onChange={(n) => onChange({ weight: fromDisplay(n, unit) }, true)} />
        <Stepper label="repeticiones" value={set.reps} step={1} onChange={(n) => onChange({ reps: Math.round(n) })} />
        <button onClick={onToggle} aria-label={set.done ? 'Desmarcar serie' : 'Completar serie'} aria-pressed={set.done}
          className={`h-14 rounded-2xl grid place-items-center transition active:scale-95 ${set.done ? 'bg-accent text-black' : 'bg-s3 text-dim'}`}>
          <Icon name="check" size={24} stroke={3} />
        </button>
      </div>
      {prev && <div className="text-[11.5px] text-dim ml-9 mt-1 num tracking-normal">Anterior: {formatNumber(toDisplay(prev.weight, unit))} {unit} × {prev.reps}</div>}
    </div>
  )
}
