import { useState } from 'react'
import { ExerciseFigure } from '../components/ExerciseFigure'
import { Icon } from '../../../shared/components/Icon'
import { Button, Chip, Header, Label, Sheet } from '../../../shared/components/ui'
import { exerciseById } from '../data/exercises'
import { saveTextFile } from '../../../shared/lib/files'
import { routineToJson } from '../services/gymImportService'
import { WeekdayChips } from '../../../shared/components/fields'
import { combatDays, errorsOf, type PlanIssue } from '../../../shared/services/planningService'
import { estimateMinutes } from '../services/workoutService'
import { WEEKDAYS_SHORT } from '../../../shared/lib/utils'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'

export function RoutineDetail({ id }: { id: string }) {
  const { routines, settings, updateSettings, deleteRoutine, startWorkout, active, showToast, setGymDays, plan } = useStore()
  const { pop, push, go } = useNav()
  const [blocked, setBlocked] = useState<PlanIssue[]>([])
  const [confirm, setConfirm] = useState(false)
  const r = routines.find((x) => x.id === id)
  if (!r) return null
  const isActive = settings.activeRoutineId === r.id

  const startDay = (dayId: string) => {
    if (active) return showToast('Ya tienes un entrenamiento en curso')
    startWorkout(r, r.days.find((d) => d.id === dayId))
    go('gym', 'today')
  }

  return (
    <div className="h-full flex flex-col">
      <Header onBack={pop} right={
        <button onClick={() => push({ name: 'gym.editRoutine', id: r.id })} className="h-10 px-4 rounded-full bg-s2 text-sm font-semibold flex items-center gap-1.5 active:bg-s3"><Icon name="edit" size={16} /> Editar</button>
      } />
      <div className="scroll flex-1 px-6 pb-10">
        <h1 className="display text-[44px]">{r.name}</h1>
        <div className="flex flex-wrap gap-2 mt-3">
          {r.goal && <Chip>{r.goal}</Chip>}
          <Chip>{r.days.length} días</Chip>
          {isActive ? <Chip active>Activa</Chip> : <Chip onClick={() => { updateSettings({ activeRoutineId: r.id }); showToast('Rutina activa cambiada') }}>Marcar como activa</Chip>}
        </div>
        {r.description && <p className="text-mute mt-4 text-[15px] leading-relaxed">{r.description}</p>}

        {r.days.map((d) => (
          <section key={d.id} className="mt-10">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-[20px] font-bold tracking-tight">{d.name}</h2>
                <div className="text-[13px] text-mute mt-1">
                  {d.exercises.length} ejercicios · ~{estimateMinutes(d)} min
                  {d.weekdays.length > 0 && ` · ${d.weekdays.map((i) => WEEKDAYS_SHORT[i]).join(' ')}`}
                </div>
              </div>
              <Button size="sm" onClick={() => startDay(d.id)} disabled={!d.exercises.length}><Icon name="bolt" size={15} stroke={2.4} /> Entrenar</Button>
            </div>
            {isActive ? (
              <div className="mt-3">
                <WeekdayChips value={d.weekdays} mark={combatDays(plan)} onChange={(v) => { const r = setGymDays(d.id, v); if (r.ok) setBlocked([]); else setBlocked(errorsOf(r.issues)) }} />
                <p className="text-[11.5px] text-dim mt-2">Días de la semana de este entrenamiento («JJ» marca días de combate).</p>
              </div>
            ) : <p className="text-[12px] text-dim mt-2">Activa esta rutina para asignar sus días de la semana.</p>}
            <div className="mt-3">
              {d.exercises.map((e) => {
                const lib = exerciseById(e.exerciseId)
                return (
                  <button key={e.id} disabled={!lib} onClick={() => lib && push({ name: 'gym.exercise', id: lib.id })} className="w-full flex items-center gap-3 py-3 border-b border-line/70 last:border-0 text-left">
                    <div className="w-12 h-12 rounded-xl bg-s1 grid place-items-center shrink-0">
                      {lib ? <ExerciseFigure anim={lib.anim} primary={lib.primary} animated={false} className="w-11 h-11" /> : <Icon name="bolt" size={18} className="text-dim" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{e.name}</div>
                      <div className="text-[13px] text-mute num tracking-normal">{e.sets} × {e.reps} · descanso {e.rest}s{e.recommendedWeight ? ` · ${e.recommendedWeight} kg` : ''}</div>
                      {e.notes && <div className="text-[12.5px] text-dim mt-0.5 truncate">{e.notes}</div>}
                    </div>
                    {lib && <Icon name="chev" size={16} className="text-dim" />}
                  </button>
                )
              })}
            </div>
          </section>
        ))}

        {blocked.length > 0 && (
          <div className="mt-8 rounded-xl bg-danger/10 px-3.5 py-3" role="alert">
            <div className="text-[12px] font-bold uppercase tracking-wider text-danger">No se puede aplicar</div>
            {blocked.map((i, n) => <div key={n} className="text-[14px] mt-1 leading-snug">{i.message}</div>)}
            <div className="text-[12.5px] text-mute mt-1.5">Las reglas de recuperación protegen tu semana (gimnasio, combate y descanso).</div>
          </div>
        )}

        <div className="mt-12 flex gap-2">
          <Button size="md" variant="secondary" className="flex-1" onClick={async () => { await saveTextFile(`${r.name.replace(/[^\w-]+/g, '_')}.json`, JSON.stringify(routineToJson(r), null, 2)); showToast('Rutina exportada') }}><Icon name="download" size={17} /> Exportar</Button>
          <Button size="md" variant="danger" className="flex-1" onClick={() => setConfirm(true)}><Icon name="trash" size={17} /> Eliminar</Button>
        </div>
        <Label className="mt-6 text-center">Creada con formato compatible con ChatGPT</Label>
      </div>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Eliminar rutina?">
        <p className="text-mute">Se borrará «{r.name}». Tu historial de entrenamientos se conserva.</p>
        <div className="flex gap-2 mt-5"><Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant="danger" className="flex-1" onClick={() => { deleteRoutine(r.id); setConfirm(false); pop() }}>Eliminar</Button></div>
      </Sheet>
    </div>
  )
}
