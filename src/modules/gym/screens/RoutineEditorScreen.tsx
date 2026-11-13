import { useState } from 'react'
import { RoutineForm } from '../components/RoutineForm'
import { Button, Header } from '../../../shared/components/ui'
import { composeWeek, errorsOf, guardWeek, type PlanIssue } from '../../../shared/services/planningService'
import { useNav } from '../../../nav'
import { useStore } from '../../../store'

export function RoutineEditorScreen({ id }: { id: string }) {
  const { routines, saveRoutine, showToast, planRoutine, combatPlan, profile } = useStore()
  const { pop } = useNav()
  const orig = routines.find((r) => r.id === id)
  const [draft, setDraft] = useState(orig)
  const [blocked, setBlocked] = useState<PlanIssue[]>([])
  if (!orig || !draft) return null
  const valid = draft.name.trim() && draft.days.length

  const save = () => {
    // Si es la rutina activa, los días de la semana se validan contra las reglas de recuperación globales
    if (planRoutine?.id === orig.id) {
      const g = guardWeek(composeWeek(orig, combatPlan, profile), composeWeek(draft, combatPlan, profile), profile, draft)
      if (!g.ok) return setBlocked(errorsOf(g.issues))
    }
    saveRoutine({ ...draft, name: draft.name.trim() })
    showToast('Rutina guardada')
    pop()
  }
  return (
    <div className="h-full flex flex-col">
      <Header title="Editar rutina" onBack={pop} />
      <div className="scroll flex-1 px-6 pt-2 pb-8">
        <RoutineForm routine={draft} onChange={(r) => { setDraft(r); setBlocked([]) }} />
        {blocked.length > 0 && (
          <div className="mt-6 rounded-xl bg-danger/10 px-3.5 py-3" role="alert">
            <div className="text-[12px] font-bold uppercase tracking-wider text-danger">No se puede guardar</div>
            {blocked.map((i, n) => <div key={n} className="text-[14px] mt-1 leading-snug">{i.message}</div>)}
            <div className="text-[12.5px] text-mute mt-1.5">Los días de la semana de esta rutina rompen las reglas de recuperación. Ajusta los días y vuelve a guardar.</div>
          </div>
        )}
      </div>
      <div className="px-6 pt-3 pb-safe pb-4 border-t border-line/70 bg-bg">
        <Button className="w-full" disabled={!valid} onClick={save}>GUARDAR CAMBIOS</Button>
      </div>
    </div>
  )
}
