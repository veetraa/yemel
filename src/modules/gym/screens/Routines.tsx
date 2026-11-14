import { Icon } from '../../../shared/components/Icon'
import { Button, Chip, Empty, Label } from '../../../shared/components/ui'
import { WEEKDAYS_SHORT, formatDateShort, uid } from '../../../shared/lib/utils'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'
import type { Routine } from '../../../types'
import { activeRoutine } from '../services/workoutService'

/** Rutinas de gimnasio (subsección de GYM). Solo musculación: nada de combate aquí. */
export function RoutinesPanel() {
  const { routines, settings, saveRoutine } = useStore()
  const { push } = useNav()
  const act = activeRoutine(routines, settings)

  const create = () => {
    const now = Date.now()
    const r: Routine = { id: uid(), name: 'Nueva rutina', days: [{ id: uid(), name: 'Día 1', weekdays: [], exercises: [] }], createdAt: now, updatedAt: now }
    saveRoutine(r)
    push({ name: 'gym.editRoutine', id: r.id })
  }

  return (
    <div className="scroll h-full pb-8">
      <div className="px-6 flex gap-2 pt-4">
        <Button size="md" onClick={() => push({ name: 'gym.import' })} className="flex-1"><Icon name="upload" size={18} /> Importar</Button>
        <Button size="md" variant="secondary" onClick={create} className="flex-1"><Icon name="plus" size={18} /> Crear</Button>
      </div>

      {act && act.days.length > 0 && (
        <div className="px-6 mt-7">
          <Label>Mis días de gimnasio</Label>
          <div className="mt-3 flex justify-between">
            {WEEKDAYS_SHORT.map((l, i) => {
              const d = act.days.find((x) => x.weekdays.includes(i))
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <span className={`w-9 h-9 rounded-full grid place-items-center text-[11px] font-bold ${d ? 'bg-white text-black' : 'bg-s2 text-dim'}`} title={d?.name}>{d ? d.name.replace(/^GYM\s*/i, '').trim().charAt(0).toUpperCase() : ''}</span>
                  <span className="text-[10.5px] font-semibold text-dim">{l}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="px-6 mt-8">
        <Label>Mis rutinas</Label>
        {routines.length === 0 ? (
          <Empty icon="list" title="Sin rutinas todavía" text="Importa o crea una.">
            <Button variant="secondary" size="md" onClick={() => push({ name: 'gym.import' })}>Ver cómo importar</Button>
          </Empty>
        ) : (
          <div className="mt-2">
            {routines.map((r) => {
              const total = r.days.reduce((a, d) => a + d.exercises.length, 0)
              const days = [...new Set(r.days.flatMap((d) => d.weekdays))].sort()
              return (
                <button key={r.id} onClick={() => push({ name: 'gym.routine', id: r.id })} className="w-full text-left py-4 border-b border-line/70 last:border-0 active:bg-s1">
                  <div className="flex items-center gap-2">
                    <div className="text-[19px] font-bold tracking-tight truncate">{r.name}</div>
                    {act?.id === r.id && <Chip active className="!h-6 !text-[11px]">ACTIVA</Chip>}
                    <Icon name="chev" size={16} className="text-dim ml-auto shrink-0" />
                  </div>
                  <div className="text-[13px] text-mute mt-1">
                    {r.days.length} días · {total} ejercicios{r.goal ? ` · ${r.goal}` : ''} · {formatDateShort(r.updatedAt)}
                  </div>
                  {days.length > 0 && (
                    <div className="flex gap-1.5 mt-2.5">
                      {WEEKDAYS_SHORT.map((l, i) => (
                        <span key={i} className={`w-6 h-6 rounded-full text-[10.5px] font-bold grid place-items-center ${days.includes(i) ? 'bg-s3 text-white' : 'text-dim'}`}>{l}</span>
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
