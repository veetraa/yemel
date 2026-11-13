import { Icon } from '../components/Icon'
import { Button, Chip, Empty, Header, Label } from '../components/ui'
import { activeRoutine } from '../services/workoutService'
import { WEEKDAYS_SHORT, formatDateShort, uid } from '../lib/utils'
import { useNav } from '../nav'
import { useStore } from '../store'
import type { Routine } from '../types'
import { SLOT_SHORT, validatePlan, errorsOf } from '../services/planningService'

export function RoutinesScreen() {
  const { routines, settings, saveRoutine, plan, profile, planRoutine } = useStore()
  const planIssues = validatePlan(plan, profile, planRoutine).filter((i) => i.level !== 'info')
  const { push } = useNav()
  const act = activeRoutine(routines, settings)

  const create = () => {
    const now = Date.now()
    const r: Routine = { id: uid(), name: 'Nueva rutina', days: [{ id: uid(), name: 'Día 1', weekdays: [], exercises: [] }], createdAt: now, updatedAt: now }
    saveRoutine(r)
    push({ name: 'editRoutine', id: r.id })
  }

  return (
    <div className="scroll h-full pb-8">
      <Header title="Rutinas" large />
      <div className="px-6 flex gap-2 mt-1">
        <Button size="md" onClick={() => push({ name: 'import' })} className="flex-1"><Icon name="upload" size={18} /> Importar</Button>
        <Button size="md" variant="secondary" onClick={create} className="flex-1"><Icon name="plus" size={18} /> Crear</Button>
      </div>

      <div className="px-6 mt-8">
        <button onClick={() => push({ name: 'plan' })} className="w-full text-left bg-s1 rounded-2xl p-4 active:bg-s2">
          <div className="flex items-center"><div className="flex-1"><div className="font-bold">Mi semana</div><div className="text-[12.5px] text-mute mt-0.5">{planIssues.length ? `${errorsOf(planIssues).length ? 'Reglas rotas' : 'Avisos'}: ${planIssues.length}` : 'Equilibrada · gimnasio, combate y recuperación'}</div></div><Icon name="chev" size={18} className="text-dim" /></div>
          <div className="flex justify-between mt-3">
            {plan.slots.map((s) => (
              <div key={s.day} className="flex flex-col items-center gap-1.5">
                <span className={`w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold ${s.type === 'gym' ? 'bg-white text-black' : s.type === 'combat' ? 'bg-accent text-black' : s.type === 'recovery' ? 'bg-s3 text-white' : 'bg-s2 text-dim'}`}>{SLOT_SHORT[s.type]}</span>
                <span className="text-[10.5px] font-semibold text-dim">{WEEKDAYS_SHORT[s.day]}</span>
              </div>
            ))}
          </div>
        </button>
      </div>

      <div className="px-6 mt-4">
        <button onClick={() => push({ name: 'library' })} className="w-full flex items-center gap-3 py-3 text-left">
          <div className="w-11 h-11 rounded-2xl bg-s2 grid place-items-center text-accent"><Icon name="play" size={20} /></div>
          <div className="flex-1">
            <div className="font-semibold">Biblioteca de ejercicios</div>
            <div className="text-[13px] text-mute">Animaciones, músculos y técnica</div>
          </div>
          <Icon name="chev" size={18} className="text-dim" />
        </button>
      </div>

      <div className="px-6 mt-8">
        <Label>Mis rutinas</Label>
        {routines.length === 0 ? (
          <Empty icon="list" title="Sin rutinas todavía" text="Importa una rutina creada con ChatGPT o crea la tuya desde cero.">
            <Button variant="secondary" size="md" onClick={() => push({ name: 'import' })}>Ver cómo importar</Button>
          </Empty>
        ) : (
          <div className="mt-2">
            {routines.map((r) => {
              const total = r.days.reduce((a, d) => a + d.exercises.length, 0)
              const days = [...new Set(r.days.flatMap((d) => d.weekdays))].sort()
              return (
                <button key={r.id} onClick={() => push({ name: 'routine', id: r.id })} className="w-full text-left py-4 border-b border-line/70 last:border-0 active:bg-s1">
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
