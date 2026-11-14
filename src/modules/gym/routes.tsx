/** Rutas y raíz del módulo GYM (musculación). Nada de combate ni de filosofía aquí. */
import { Header } from '../../shared/components/ui'
import { SubTabs } from '../../shared/components/SubTabs'
import { ImportScreen } from '../../shared/screens/ImportScreen'
import { useNav, type Screen } from '../../nav'
import { useStore } from '../../store'
import { LibraryPanel, ExerciseDetail } from './screens/Library'
import { LoadsDetail, LoadsPanel } from './screens/Loads'
import { RoutineDetail } from './screens/RoutineDetail'
import { RoutineEditorScreen } from './screens/RoutineEditorScreen'
import { RoutinesPanel } from './screens/Routines'
import { SessionDetail, SummaryScreen } from './screens/SessionDetail'
import { Picker, Workout } from './screens/Train'

const SUBS = [
  { key: 'today', label: 'Entrenar' },
  { key: 'routines', label: 'Rutinas' },
  { key: 'library', label: 'Ejercicios' },
  { key: 'loads', label: 'Pesos' },
]

export function GymRoot() {
  const { active } = useStore()
  const { sub, setSub } = useNav()
  const key = sub.gym ?? 'today'
  if (active) return <Workout />
  return (
    <div className="h-full flex flex-col">
      <Header title="Gym" large />
      <SubTabs id="gym" items={SUBS} value={key} onChange={(k) => setSub('gym', k)} />
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          {key === 'today' && <Picker />}
          {key === 'routines' && <RoutinesPanel />}
          {key === 'library' && <LibraryPanel />}
          {key === 'loads' && <LoadsPanel />}
        </div>
      </div>
    </div>
  )
}

export function renderGymScreen(s: Screen) {
  switch (s.name) {
    case 'gym.routine': return <RoutineDetail id={s.id} />
    case 'gym.editRoutine': return <RoutineEditorScreen id={s.id} />
    case 'gym.import': return <ImportScreen scope="gym" />
    case 'gym.exercise': return <ExerciseDetail id={s.id} />
    case 'gym.session': return <SessionDetail id={s.id} />
    case 'gym.summary': return <SummaryScreen id={s.id} />
    case 'gym.loads': return <LoadsDetail keyId={s.key} />
  }
  return null
}
