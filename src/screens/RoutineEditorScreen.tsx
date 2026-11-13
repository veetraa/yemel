import { useState } from 'react'
import { RoutineForm } from '../components/RoutineForm'
import { Button, Header } from '../components/ui'
import { useNav } from '../nav'
import { useStore } from '../store'

export function RoutineEditorScreen({ id }: { id: string }) {
  const { routines, saveRoutine, showToast } = useStore()
  const { pop } = useNav()
  const orig = routines.find((r) => r.id === id)
  const [draft, setDraft] = useState(orig)
  if (!orig || !draft) return null
  const valid = draft.name.trim() && draft.days.length
  return (
    <div className="h-full flex flex-col">
      <Header title="Editar rutina" onBack={pop} />
      <div className="scroll flex-1 px-6 pt-2 pb-8"><RoutineForm routine={draft} onChange={setDraft} /></div>
      <div className="px-6 pt-3 pb-safe pb-4 border-t border-line/70 bg-bg">
        <Button className="w-full" disabled={!valid} onClick={() => { saveRoutine({ ...draft, name: draft.name.trim() }); showToast('Rutina guardada'); pop() }}>GUARDAR CAMBIOS</Button>
      </div>
    </div>
  )
}
